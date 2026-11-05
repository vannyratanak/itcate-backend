import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * SCORE MAPPING (1-5, higher is better)
 * Every survey question uses an answer scale (GroupOption) whose options are stored best -> worst
 * (e.g. Strongly Agree ... Strongly Disagree), in the order they were added to the scale (GroupOptionWithOption.id).
 * An answer in position i (0 = best) of a scale with n options scores   5 - i * 4 / (n - 1).
 * For the usual 5-point scales that is 5,4,3,2,1; a 4-point scale gives 5, 3.67, 2.33, 1.
 * A response's score is the mean of its answers, rounded to 1 decimal. A scale with a single option
 * (or no answers) gives null. If an admin orders a custom scale worst -> best the scores flip; keep scales best -> worst.
 */
export function positionScore(index: number, size: number): number | null {
  if (size < 2 || index < 0 || index >= size) return null;
  return 5 - (index * 4) / (size - 1);
}

export function meanScore(scores: Array<number | null>): number | null {
  const ok = scores.filter((s): s is number => s !== null);
  if (!ok.length) return null;
  return Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10;
}

export const firstName = (name: string) => (name ?? '').trim().split(/\s+/)[0].slice(0, 30);

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `${group_option_id}:${option_id}` -> 1..5 */
  private async scoreTable() {
    const links = await this.prisma.groupOptionWithOption.findMany({ orderBy: [{ group_option_id: 'asc' }, { id: 'asc' }] });
    const byGroup = new Map<number, number[]>();
    for (const l of links) byGroup.set(l.group_option_id, [...(byGroup.get(l.group_option_id) ?? []), l.option_id]);
    const table = new Map<string, number | null>();
    for (const [g, opts] of byGroup) opts.forEach((o, i) => table.set(`${g}:${o}`, positionScore(i, opts.length)));
    return table;
  }

  private answersWithGroup = {
    include: { survayOption: { include: { menuQuestion: { select: { group_option_id: true } } } } },
  } as const;

  private scoreOf(survay: { survayOption: Array<{ option_id: number; menuQuestion: { group_option_id: number } }> }, table: Map<string, number | null>) {
    return meanScore(survay.survayOption.map((a) => table.get(`${a.menuQuestion.group_option_id}:${a.option_id}`) ?? null));
  }

  /** Public: approved comments only, newest first. Never exposes the surname or phone number. */
  async listPublic() {
    const [rows, table] = await Promise.all([
      this.prisma.survayerMessage.findMany({
        where: { approved: true, message: { not: null } },
        orderBy: { created_at: 'desc' },
        take: 30,
        include: { survay: this.answersWithGroup },
      }),
      this.scoreTable(),
    ]);
    return rows
      .filter((r) => r.message && r.message.trim())
      .map((r) => ({
        id: r.id,
        message: r.message!.trim().slice(0, 2000),
        first_name: firstName(r.survay.name),
        created_at: r.created_at,
        score: this.scoreOf(r.survay, table),
      }));
  }

  /** Public: overall figures for the hero. average = mean score over every answer given (weighted), responses = surveys received. */
  async summary() {
    const [grouped, questions, table, responses, approved] = await Promise.all([
      this.prisma.survayerOption.groupBy({ by: ['menu_id', 'option_id'], _count: { _all: true } }),
      this.prisma.menuQuestion.findMany({ select: { id: true, group_option_id: true } }),
      this.scoreTable(),
      this.prisma.survayer.count(),
      this.prisma.survayerMessage.count({ where: { approved: true, message: { not: null } } }),
    ]);
    const groupOf = new Map(questions.map((q) => [q.id, q.group_option_id]));
    let sum = 0, n = 0;
    for (const g of grouped) {
      const s = table.get(`${groupOf.get(g.menu_id)}:${g.option_id}`);
      if (s == null) continue;
      sum += s * g._count._all; n += g._count._all;
    }
    return { responses, approved, average: n ? Math.round((sum / n) * 10) / 10 : null };
  }

  /** Admin: every survey comment, with the respondent's details. */
  async listAll(approved?: string, page = 1, limit = 20) {
    if (approved !== undefined && approved !== 'true' && approved !== 'false') throw new BadRequestException('approved must be true or false');
    const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
    const pg = Math.max(Math.trunc(page) || 1, 1);
    const where = { message: { not: null }, NOT: { message: '' }, ...(approved ? { approved: approved === 'true' } : {}) };
    const [total, rows, table] = await Promise.all([
      this.prisma.survayerMessage.count({ where }),
      this.prisma.survayerMessage.findMany({ where, orderBy: { created_at: 'desc' }, skip: (pg - 1) * take, take, include: { survay: this.answersWithGroup } }),
      this.scoreTable(),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id, survey_id: r.survay_id, message: r.message, approved: r.approved, created_at: r.created_at,
        name: r.survay.name, phone: r.survay.phoneNumber, score: this.scoreOf(r.survay, table),
      })),
      total, page: pg, limit: take, pages: Math.ceil(total / take),
    };
  }

  async setApproved(id: number, approved: unknown) {
    if (typeof approved !== 'boolean') throw new BadRequestException('approved must be true or false');
    const row = await this.prisma.survayerMessage.findUnique({ where: { id }, select: { id: true, message: true } });
    if (!row) throw new NotFoundException(`review ${id} not found`);
    if (approved && !row.message?.trim()) throw new BadRequestException('this response has no comment to publish');
    await this.prisma.survayerMessage.update({ where: { id }, data: { approved } });
    return { id, approved };
  }
}
