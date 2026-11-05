import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { addDays, bucketPerDay, csvRow, LOW_SCORE, parseRange, round1, scoreFor, startOfUtcDay } from './analytics.helpers';

type Scale = { n: number; positions: Map<number, number>; options: { id: number; name_en: string | null; name_kh: string | null }[] };

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Questions in display order with their answer scale (options ordered as they were attached to the scale). */
  private async questions() {
    const qs = await this.prisma.menuQuestion.findMany({
      orderBy: [{ group_option: { sort_order: 'asc' } }, { id: 'asc' }],
      include: { group_option: { include: { options: { orderBy: { id: 'asc' }, include: { option: true } } } } },
    });
    return qs.map((q) => {
      const options = q.group_option.options.map((o) => ({ id: o.option_id, name_en: o.option.name_en, name_kh: o.option.name_kh }));
      const scale: Scale = { n: options.length, positions: new Map(options.map((o, i) => [o.id, i])), options };
      return { id: q.id, name_en: q.name_en, name_kh: q.name_kh, scale };
    });
  }

  private scoreOf(scale: Scale, optionId: number): number | null {
    const pos = scale.positions.get(optionId);
    return pos === undefined ? null : scoreFor(pos, scale.n);
  }

  /** Average score (1-5) over answers given by the surveys in `where`; null when there are none. */
  private async averageScore(where: object, questions: Awaited<ReturnType<AnalyticsService['questions']>>) {
    const groups = await this.prisma.survayerOption.groupBy({ by: ['menu_id', 'option_id'], where: { survay: where }, _count: { _all: true } });
    const byQ = new Map(questions.map((q) => [q.id, q]));
    let sum = 0, n = 0;
    for (const g of groups) {
      const q = byQ.get(g.menu_id); if (!q) continue;
      const sc = this.scoreOf(q.scale, g.option_id); if (sc === null) continue;
      sum += sc * g._count._all; n += g._count._all;
    }
    return n ? round1(sum / n) : null;
  }

  async overview() {
    const now = new Date();
    const today = startOfUtcDay(now);
    const d7 = addDays(now, -7), d14 = addDays(now, -14);
    const since30 = addDays(today, -29);
    const questions = await this.questions();
    const [total, last7, prev7, avgScore, recent, reservationsToday, reservationsPending, unreadMessages, menuActive, menuHidden, latest] = await Promise.all([
      this.prisma.survayer.count(),
      this.prisma.survayer.count({ where: { created_at: { gte: d7 } } }),
      this.prisma.survayer.count({ where: { created_at: { gte: d14, lt: d7 } } }),
      this.averageScore({}, questions),
      this.prisma.survayer.findMany({ where: { created_at: { gte: since30 } }, select: { created_at: true } }),
      this.prisma.reservation.count({ where: { date: today, status: { in: ['pending', 'confirmed'] } } }),
      this.prisma.reservation.count({ where: { status: 'pending', date: { gte: today } } }),
      this.prisma.contactMessage.count({ where: { status: 'new' } }),
      this.prisma.menuItem.count({ where: { active: true } }),
      this.prisma.menuItem.count({ where: { active: false } }),
      this.prisma.survayer.findMany({ orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, name: true, phoneNumber: true, usedToVisit: true, created_at: true } }),
    ]);
    return {
      surveys: { total, last7, prev7, avgScore },
      reservationsToday, reservationsPending, unreadMessages,
      menu: { active: menuActive, hidden: menuHidden },
      perDay: bucketPerDay(recent.map((r) => r.created_at), since30, now),
      latest,
    };
  }

  async survey(fromQ?: string, toQ?: string) {
    const r = parseRange(fromQ, toQ);
    const where = { created_at: { gte: r.from, lte: r.to } };
    const questions = await this.questions();
    const [responses, answers, returning] = await Promise.all([
      this.prisma.survayer.findMany({ where, select: { created_at: true } }),
      this.prisma.survayerOption.groupBy({ by: ['menu_id', 'option_id'], where: { survay: where }, _count: { _all: true } }),
      this.prisma.survayer.count({ where: { ...where, usedToVisit: true } }),
    ]);
    const count = new Map(answers.map((a) => [`${a.menu_id}:${a.option_id}`, a._count._all]));
    let sum = 0, n = 0;
    const qOut = questions.map((q) => {
      const rows = q.scale.options.map((o) => ({ option_id: o.id, name_en: o.name_en, name_kh: o.name_kh, count: count.get(`${q.id}:${o.id}`) ?? 0 }));
      const answered = rows.reduce((a, o) => a + o.count, 0);
      let qs = 0;
      rows.forEach((o, i) => { qs += scoreFor(i, q.scale.n) * o.count; });
      sum += qs; n += answered;
      const average = answered ? round1(qs / answered) : null;
      return {
        menu_id: q.id, name_en: q.name_en, name_kh: q.name_kh, answered, average,
        low: average !== null && average < LOW_SCORE,
        scale: rows.map((o) => ({ ...o, pct: answered ? Math.round((o.count / answered) * 1000) / 10 : 0 })),
      };
    });
    return {
      from: r.fromStr, to: r.toStr, total: responses.length,
      overallAverage: n ? round1(sum / n) : null,
      lowThreshold: LOW_SCORE,
      newVsReturning: { returning, new: responses.length - returning },
      perDay: bucketPerDay(responses.map((x) => x.created_at), r.from, r.to),
      questions: qOut,
    };
  }

  /** One row per response in the range: id, date, name, phone, usedToVisit, one column per question (English answer), comment. */
  async surveyCsv(fromQ?: string, toQ?: string) {
    const r = parseRange(fromQ, toQ);
    const [questions, rows] = await Promise.all([
      this.questions(),
      this.prisma.survayer.findMany({
        where: { created_at: { gte: r.from, lte: r.to } },
        orderBy: { id: 'asc' },
        include: { survayOption: true, survayMessage: { select: { message: true } } },
      }),
    ]);
    const lines = [csvRow(['id', 'date', 'name', 'phone', 'used_to_visit', ...questions.map((q) => q.name_en ?? `question ${q.id}`), 'comment'])];
    for (const s of rows) {
      const ans = new Map(s.survayOption.map((o) => [o.menu_id, o.option_id]));
      lines.push(csvRow([
        s.id, s.created_at, s.name, s.phoneNumber, s.usedToVisit ? 'yes' : 'no',
        ...questions.map((q) => q.scale.options.find((o) => o.id === ans.get(q.id))?.name_en ?? ''),
        s.survayMessage.map((m) => m.message).filter(Boolean).join(' | '),
      ]));
    }
    return { filename: `survey-${r.fromStr}_${r.toStr}.csv`, body: '﻿' + lines.join('\r\n') + '\r\n' }; // BOM so Excel reads Khmer/UTF-8
  }
}
