import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type Text = { name_en?: string | null; name_kh?: string | null };
type OptionRow = Text & { id?: number };

const txt = (v: unknown, field: string) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.length > 200) throw new BadRequestException(`${field} is invalid (max 200 characters)`);
  return v.trim() || null;
};
// Every question/choice needs at least one language.
const names = (dto: Text, what: string) => {
  const name_en = txt(dto?.name_en, 'name_en');
  const name_kh = txt(dto?.name_kh, 'name_kh');
  if (!name_en && !name_kh) throw new BadRequestException(`${what} needs an English or Khmer name`);
  return { name_en, name_kh };
};

@Injectable()
export class SurveyConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Questions ----
  private async groupExists(id: unknown) {
    if (!Number.isInteger(id) || !(await this.prisma.groupOption.findUnique({ where: { id: id as number } }))) {
      throw new BadRequestException('group_option_id must reference an existing answer scale');
    }
  }

  async createQuestion(dto: Text & { group_option_id?: number }) {
    await this.groupExists(dto?.group_option_id);
    const last = await this.prisma.menuQuestion.aggregate({ _max: { sort_order: true }, where: { group_option_id: dto.group_option_id } });
    return this.prisma.menuQuestion.create({ data: { ...names(dto, 'A question'), group_option_id: dto.group_option_id, sort_order: (last._max.sort_order ?? 0) + 1 } });
  }

  async updateQuestion(id: number, dto: Text & { group_option_id?: number }) {
    const q = await this.prisma.menuQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException(`question ${id} not found`);
    const data: any = names({ name_en: dto.name_en ?? null, name_kh: dto.name_kh ?? null }, 'A question');
    if (dto.group_option_id !== undefined && dto.group_option_id !== q.group_option_id) {
      if (await this.prisma.survayerOption.count({ where: { menu_id: id } })) {
        throw new ConflictException('This question already has answers, so its answer scale cannot change');
      }
      await this.groupExists(dto.group_option_id);
      data.group_option_id = dto.group_option_id;
    }
    return this.prisma.menuQuestion.update({ where: { id }, data });
  }

  async removeQuestion(id: number) {
    if (!(await this.prisma.menuQuestion.findUnique({ where: { id } }))) throw new NotFoundException(`question ${id} not found`);
    const answers = await this.prisma.survayerOption.count({ where: { menu_id: id } });
    if (answers) throw new ConflictException(`${answers} survey answer(s) use this question; delete those responses first`);
    await this.prisma.menuQuestion.delete({ where: { id } });
    return { id };
  }

  // Drag-and-drop ordering. `ids` must be exactly the items being ordered, first to last.
  private async reorder(ids: unknown, existing: number[], what: string) {
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length
      || !ids.every((i) => Number.isInteger(i) && existing.includes(i))) {
      throw new BadRequestException(`ids must list every ${what} exactly once`);
    }
    return ids as number[];
  }

  async reorderQuestions(groupId: number, rawIds: unknown) {
    await this.groupExists(groupId);
    const rows = await this.prisma.menuQuestion.findMany({ where: { group_option_id: groupId }, select: { id: true } });
    const ids = await this.reorder(rawIds, rows.map((r) => r.id), 'question in this scale');
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.menuQuestion.update({ where: { id }, data: { sort_order: i + 1 } })));
    return { ids };
  }

  async reorderScales(rawIds: unknown) {
    const rows = await this.prisma.groupOption.findMany({ select: { id: true } });
    const ids = await this.reorder(rawIds, rows.map((r) => r.id), 'answer scale');
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.groupOption.update({ where: { id }, data: { sort_order: i + 1 } })));
    return { ids };
  }

  // ---- Answer scales (a group plus its ordered choices) ----
  private async scale(id: number) {
    const g = await this.prisma.groupOption.findUnique({
      where: { id },
      include: { options: { orderBy: { id: 'asc' }, include: { option: true } } },
    });
    return g && { ...g, options: g.options.map((o) => o.option) };
  }

  private async cleanRows(rows: unknown) {
    if (!Array.isArray(rows) || rows.length < 2 || rows.length > 10) {
      throw new BadRequestException('An answer scale needs between 2 and 10 choices');
    }
    return rows.map((r: OptionRow) => ({ id: r?.id, ...names(r, 'Each choice') }));
  }

  async createScale(dto: { name?: string; options?: OptionRow[] }) {
    const name = typeof dto?.name === 'string' ? dto.name.trim() : '';
    if (!name || name.length > 100) throw new BadRequestException('name is required (max 100 characters)');
    const rows = await this.cleanRows(dto.options);
    const id = await this.prisma.$transaction(async (tx) => {
      const last = await tx.groupOption.aggregate({ _max: { sort_order: true } });
      const g = await tx.groupOption.create({ data: { name, sort_order: (last._max.sort_order ?? 0) + 1 } });
      for (const r of rows) {
        const o = await tx.option.create({ data: { name_en: r.name_en, name_kh: r.name_kh } });
        await tx.groupOptionWithOption.create({ data: { group_option_id: g.id, option_id: o.id } });
      }
      return g.id;
    });
    return this.scale(id);
  }

  // Replaces the scale's choices. Choices are shared between scales (e.g. "Neutral"), so an edited
  // choice that is also used elsewhere or already answered becomes a NEW option rather than being
  // rewritten under other scales' feet / past responses.
  async updateScale(id: number, dto: { name?: string; options?: OptionRow[] }) {
    const current = await this.scale(id);
    if (!current) throw new NotFoundException(`answer scale ${id} not found`);
    const name = typeof dto?.name === 'string' ? dto.name.trim() : '';
    if (!name || name.length > 100) throw new BadRequestException('name is required (max 100 characters)');
    const rows = await this.cleanRows(dto.options);
    const own = new Map(current.options.map((o) => [o.id, o]));
    for (const r of rows) if (r.id !== undefined && !own.has(r.id)) throw new BadRequestException(`choice ${r.id} is not part of this scale`);
    const keptIds = new Set(rows.filter((r) => r.id !== undefined).map((r) => r.id));
    if (new Set(rows.map((r) => r.id).filter((x) => x !== undefined)).size !== keptIds.size || keptIds.size !== rows.filter((r) => r.id !== undefined).length) {
      throw new BadRequestException('duplicate choice');
    }

    // Choices that were answered under this scale's questions can't be dropped from it.
    for (const o of current.options) {
      if (keptIds.has(o.id)) continue;
      const used = await this.prisma.survayerOption.count({ where: { option_id: o.id, menuQuestion: { group_option_id: id } } });
      if (used) throw new ConflictException(`"${o.name_en || o.name_kh}" has ${used} answer(s); delete those responses first`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupOption.update({ where: { id }, data: { name } });
      // Rebuild links in the requested order (link id order = display order).
      await tx.groupOptionWithOption.deleteMany({ where: { group_option_id: id } });
      for (const r of rows) {
        let optionId = r.id;
        const old = optionId !== undefined ? own.get(optionId) : undefined;
        if (!old) {
          optionId = (await tx.option.create({ data: { name_en: r.name_en, name_kh: r.name_kh } })).id;
        } else if (old.name_en !== r.name_en || old.name_kh !== r.name_kh) {
          const elsewhere = await tx.groupOptionWithOption.count({ where: { option_id: old.id } });
          const answered = await tx.survayerOption.count({ where: { option_id: old.id } });
          optionId = elsewhere || answered
            ? (await tx.option.create({ data: { name_en: r.name_en, name_kh: r.name_kh } })).id
            : (await tx.option.update({ where: { id: old.id }, data: { name_en: r.name_en, name_kh: r.name_kh } })).id;
        }
        await tx.groupOptionWithOption.create({ data: { group_option_id: id, option_id: optionId } });
      }
    });
    return this.scale(id);
  }

  async removeScale(id: number) {
    if (!(await this.scale(id))) throw new NotFoundException(`answer scale ${id} not found`);
    const qs = await this.prisma.menuQuestion.count({ where: { group_option_id: id } });
    if (qs) throw new ConflictException(`${qs} question(s) use this scale; move or delete them first`);
    await this.prisma.$transaction([
      this.prisma.groupOptionWithOption.deleteMany({ where: { group_option_id: id } }),
      this.prisma.groupOption.delete({ where: { id } }),
    ]);
    return { id };
  }
}
