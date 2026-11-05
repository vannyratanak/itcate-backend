import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type FaqDto = { question_en?: unknown; question_kh?: unknown; answer_en?: unknown; answer_kh?: unknown; active?: unknown };

const required = (v: unknown, max: number, field: string): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new BadRequestException(`${field} is required (max ${max} characters)`);
  return v.trim();
};
const optional = (v: unknown, max: number, field: string): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length > max) throw new BadRequestException(`${field} must be text (max ${max} characters)`);
  return v.trim() || null;
};

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.faq.findMany({ where: { active: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] });
  }

  listAll() {
    return this.prisma.faq.findMany({ orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] });
  }

  private clean(dto: FaqDto, creating: boolean) {
    const data: { question_en?: string; question_kh?: string | null; answer_en?: string; answer_kh?: string | null; active?: boolean } = {};
    if (creating || dto?.question_en !== undefined) data.question_en = required(dto?.question_en, 300, 'question_en');
    if (creating || dto?.answer_en !== undefined) data.answer_en = required(dto?.answer_en, 4000, 'answer_en');
    if (dto?.question_kh !== undefined) data.question_kh = optional(dto.question_kh, 300, 'question_kh');
    if (dto?.answer_kh !== undefined) data.answer_kh = optional(dto.answer_kh, 4000, 'answer_kh');
    if (dto?.active !== undefined) {
      if (typeof dto.active !== 'boolean') throw new BadRequestException('active must be true or false');
      data.active = dto.active;
    }
    return data;
  }

  async create(dto: FaqDto) {
    const data = this.clean(dto, true);
    const last = await this.prisma.faq.aggregate({ _max: { sort_order: true } });
    return this.prisma.faq.create({ data: { question_en: data.question_en!, answer_en: data.answer_en!, ...data, sort_order: (last._max.sort_order ?? 0) + 1 } });
  }

  async update(id: number, dto: FaqDto) {
    await this.exists(id);
    const data = this.clean(dto, false);
    if (!Object.keys(data).length) throw new BadRequestException('nothing to update');
    return this.prisma.faq.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.exists(id);
    await this.prisma.faq.delete({ where: { id } });
    return { deleted: id };
  }

  async reorder(ids: unknown) {
    const existing = (await this.prisma.faq.findMany({ select: { id: true } })).map((r) => r.id);
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length || !ids.every((i) => existing.includes(i))) {
      throw new BadRequestException('ids must list every FAQ exactly once');
    }
    await this.prisma.$transaction(ids.map((id: number, i) => this.prisma.faq.update({ where: { id }, data: { sort_order: i + 1 } })));
    return { ids };
  }

  private async exists(id: number) {
    if (!Number.isInteger(id) || !(await this.prisma.faq.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException(`FAQ ${id} not found`);
    }
  }
}
