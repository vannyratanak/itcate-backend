import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type GalleryDto = { url?: unknown; caption_en?: unknown; caption_kh?: unknown; active?: unknown };

const optText = (v: unknown, max: number, field: string): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length > max) throw new BadRequestException(`${field} must be text (max ${max} characters)`);
  return v.trim();
};

// Uploaded files look like /uploads/x.png; absolute http(s) URLs are allowed too. Nothing else (no javascript: etc.).
export const isImageUrl = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 500 && (/^\/uploads\/[\w.\-]+$/.test(v) || /^https?:\/\/[^\s"'<>]+$/.test(v));

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.galleryImage.findMany({ where: { active: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] });
  }

  listAll() {
    return this.prisma.galleryImage.findMany({ orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] });
  }

  private clean(dto: GalleryDto, creating: boolean) {
    const data: { url?: string; caption_en?: string | null; caption_kh?: string | null; active?: boolean } = {};
    if (dto?.url !== undefined || creating) {
      if (!isImageUrl(dto?.url)) throw new BadRequestException('url must be an uploaded image (/uploads/...) or an http(s) link');
      data.url = dto.url as string;
    }
    const en = optText(dto?.caption_en, 200, 'caption_en'); if (en !== undefined) data.caption_en = en;
    const kh = optText(dto?.caption_kh, 200, 'caption_kh'); if (kh !== undefined) data.caption_kh = kh;
    if (dto?.active !== undefined) {
      if (typeof dto.active !== 'boolean') throw new BadRequestException('active must be true or false');
      data.active = dto.active;
    }
    return data;
  }

  async create(dto: GalleryDto) {
    const data = this.clean(dto, true);
    const last = await this.prisma.galleryImage.aggregate({ _max: { sort_order: true } });
    return this.prisma.galleryImage.create({ data: { url: data.url!, ...data, sort_order: (last._max.sort_order ?? 0) + 1 } });
  }

  async update(id: number, dto: GalleryDto) {
    await this.exists(id);
    const data = this.clean(dto, false);
    if (!Object.keys(data).length) throw new BadRequestException('nothing to update');
    return this.prisma.galleryImage.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.exists(id);
    await this.prisma.galleryImage.delete({ where: { id } });
    return { deleted: id };
  }

  async reorder(ids: unknown) {
    const existing = (await this.prisma.galleryImage.findMany({ select: { id: true } })).map((r) => r.id);
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length || !ids.every((i) => existing.includes(i))) {
      throw new BadRequestException('ids must list every gallery image exactly once');
    }
    await this.prisma.$transaction(ids.map((id: number, i) => this.prisma.galleryImage.update({ where: { id }, data: { sort_order: i + 1 } })));
    return { ids };
  }

  private async exists(id: number) {
    if (!Number.isInteger(id) || !(await this.prisma.galleryImage.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException(`gallery image ${id} not found`);
    }
  }
}
