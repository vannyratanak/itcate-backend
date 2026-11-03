import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type CategoryDto = { name_en?: string; name_kh?: string | null };
type MenuDto = {
  name_en?: string; name_kh?: string | null; description_en?: string | null; description_kh?: string | null;
  category_id?: number; price?: number | string; image_url?: string | null; sort_order?: number; active?: boolean;
};

const optText = (v: unknown, field: string, max: number) => {
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || v.length > max) throw new BadRequestException(`${field} is invalid (max ${max} characters)`);
  return v.trim();
};

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  private order = [{ category: { sort_order: 'asc' as const } }, { category_id: 'asc' as const }, { sort_order: 'asc' as const }, { id: 'asc' as const }];

  // The API keeps returning `category` as the display name (what the front end groups by), plus the id/Khmer name.
  private shape<T extends { category: { name_en: string; name_kh: string | null } }>(item: T) {
    const { category, ...rest } = item;
    return { ...rest, category: category.name_en, category_kh: category.name_kh };
  }

  async listActive() {
    const rows = await this.prisma.menuItem.findMany({ where: { active: true }, orderBy: this.order, include: { category: true } });
    return rows.map((r) => this.shape(r));
  }

  async listAll() {
    const rows = await this.prisma.menuItem.findMany({ orderBy: this.order, include: { category: true } });
    return rows.map((r) => this.shape(r));
  }

  // ---- Categories ----
  async listCategories() {
    const rows = await this.prisma.menuCategory.findMany({ orderBy: [{ sort_order: 'asc' }, { id: 'asc' }], include: { _count: { select: { items: true } } } });
    return rows.map(({ _count, ...c }) => ({ ...c, item_count: _count.items }));
  }

  private cleanCategory(dto: CategoryDto, partial: boolean) {
    const data: { name_en?: string; name_kh?: string | null } = {};
    if (!partial || dto.name_en !== undefined) {
      if (typeof dto.name_en !== 'string' || !dto.name_en.trim() || dto.name_en.length > 60) {
        throw new BadRequestException('name_en is required (max 60 characters)');
      }
      data.name_en = dto.name_en.trim();
    }
    if (dto.name_kh !== undefined) data.name_kh = optText(dto.name_kh, 'name_kh', 60);
    return data;
  }

  private async nameFree(name: string, exceptId?: number) {
    const dup = await this.prisma.menuCategory.findFirst({ where: { name_en: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
    if (dup) throw new ConflictException(`A category named "${dup.name_en}" already exists`);
  }

  async createCategory(dto: CategoryDto) {
    const data = this.cleanCategory(dto, false);
    await this.nameFree(data.name_en!);
    const last = await this.prisma.menuCategory.aggregate({ _max: { sort_order: true } });
    return this.prisma.menuCategory.create({ data: { ...(data as { name_en: string }), sort_order: (last._max.sort_order ?? 0) + 1 } });
  }

  async updateCategory(id: number, dto: CategoryDto) {
    await this.categoryExists(id);
    const data = this.cleanCategory(dto, true);
    if (data.name_en) await this.nameFree(data.name_en, id);
    return this.prisma.menuCategory.update({ where: { id }, data });
  }

  async removeCategory(id: number) {
    await this.categoryExists(id);
    const n = await this.prisma.menuItem.count({ where: { category_id: id } });
    if (n) throw new ConflictException(`${n} menu item(s) use this category; move or delete them first`);
    await this.prisma.menuCategory.delete({ where: { id } });
    return { id };
  }

  async reorderCategories(ids: unknown) {
    const existing = (await this.prisma.menuCategory.findMany({ select: { id: true } })).map((c) => c.id);
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length || !ids.every((i) => existing.includes(i))) {
      throw new BadRequestException('ids must list every category exactly once');
    }
    await this.prisma.$transaction(ids.map((id: number, i) => this.prisma.menuCategory.update({ where: { id }, data: { sort_order: i + 1 } })));
    return { ids };
  }

  private async categoryExists(id: number) {
    if (!Number.isInteger(id) || !(await this.prisma.menuCategory.findUnique({ where: { id } }))) {
      throw new NotFoundException(`category ${id} not found`);
    }
  }

  private clean(dto: MenuDto, partial: boolean) {
    const data: Record<string, unknown> = {};
    if (!partial || dto.name_en !== undefined) {
      if (typeof dto.name_en !== 'string' || !dto.name_en.trim() || dto.name_en.length > 120) {
        throw new BadRequestException('name_en is required (max 120 characters)');
      }
      data.name_en = dto.name_en.trim();
    }
    if (dto.name_kh !== undefined) data.name_kh = optText(dto.name_kh, 'name_kh', 120);
    if (dto.description_en !== undefined) data.description_en = optText(dto.description_en, 'description_en', 1000);
    if (dto.description_kh !== undefined) data.description_kh = optText(dto.description_kh, 'description_kh', 1000);
    if (dto.image_url !== undefined) data.image_url = optText(dto.image_url, 'image_url', 500);
    if (!partial || dto.category_id !== undefined) {
      if (!Number.isInteger(dto.category_id)) throw new BadRequestException('category_id is required');
      data.category_id = dto.category_id;
    }
    if (!partial || dto.price !== undefined) {
      const price = Number(dto.price);
      if (dto.price === '' || dto.price === null || !Number.isFinite(price) || price < 0 || price > 99999999) {
        throw new BadRequestException('price must be a number between 0 and 99999999');
      }
      data.price = Math.round(price * 100) / 100;
    }
    if (dto.active !== undefined) {
      if (typeof dto.active !== 'boolean') throw new BadRequestException('active must be a boolean');
      data.active = dto.active;
    }
    return data;
  }

  // New items (and items moved to another category) go to the end of their category.
  private async nextPosition(categoryId: number) {
    const last = await this.prisma.menuItem.aggregate({ _max: { sort_order: true }, where: { category_id: categoryId } });
    return (last._max.sort_order ?? -1) + 1;
  }

  async reorder(categoryId: unknown, ids: unknown) {
    if (!Number.isInteger(categoryId)) throw new BadRequestException('category_id is required');
    await this.categoryExists(categoryId as number);
    const existing = (await this.prisma.menuItem.findMany({ where: { category_id: categoryId as number }, select: { id: true } })).map((r) => r.id);
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length || !ids.every((i) => existing.includes(i))) {
      throw new BadRequestException('ids must list every item in this category exactly once');
    }
    await this.prisma.$transaction(ids.map((id: number, i) => this.prisma.menuItem.update({ where: { id }, data: { sort_order: i } })));
    return { ids };
  }

  async create(dto: MenuDto) {
    const data = this.clean(dto, false);
    await this.categoryExists(data.category_id as number);
    data.sort_order = await this.nextPosition(data.category_id as number);
    return this.shape(await this.prisma.menuItem.create({ data: data as any, include: { category: true } }));
  }

  async update(id: number, dto: MenuDto) {
    await this.exists(id);
    const data = this.clean(dto, true);
    if (data.category_id !== undefined) {
      await this.categoryExists(data.category_id as number);
      const current = await this.prisma.menuItem.findUnique({ where: { id } });
      if (current && current.category_id !== data.category_id) data.sort_order = await this.nextPosition(data.category_id as number);
    }
    return this.shape(await this.prisma.menuItem.update({ where: { id }, data: data as any, include: { category: true } }));
  }

  async remove(id: number) {
    await this.exists(id);
    await this.prisma.menuItem.delete({ where: { id } });
    return { id };
  }

  private async exists(id: number) {
    if (!Number.isInteger(id) || !(await this.prisma.menuItem.findUnique({ where: { id } }))) {
      throw new NotFoundException(`menu item ${id} not found`);
    }
  }
}
