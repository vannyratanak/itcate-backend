import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type OfferKind = 'offer' | 'event';
export type OfferDto = {
  kind?: string; title_en?: string; title_kh?: string | null; body_en?: string | null; body_kh?: string | null;
  image_url?: string | null; starts_at?: string | null; ends_at?: string | null; active?: boolean;
};
type Row = { kind: string; starts_at: Date | null; ends_at: Date | null };

const startOfToday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

/**
 * An item is expired once its window is over:
 *  - with ends_at: expired when ends_at is in the past;
 *  - an event without ends_at: expired once its start day is over;
 *  - an offer without ends_at: never expires.
 * Offers/events that have not started yet are "upcoming" and stay visible.
 */
export function isExpired(r: Row, now = new Date()): boolean {
  if (r.ends_at) return r.ends_at.getTime() < now.getTime();
  if (r.kind === 'event' && r.starts_at) return r.starts_at.getTime() < startOfToday(now).getTime();
  return false;
}

const text = (v: unknown, field: string, max: number, required = false): string | null => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new BadRequestException(`${field} is required (max ${max} characters)`);
    return null;
  }
  if (typeof v !== 'string' || v.length > max) throw new BadRequestException(`${field} is invalid (max ${max} characters)`);
  const t = v.trim();
  if (required && !t) throw new BadRequestException(`${field} is required (max ${max} characters)`);
  return t || null;
};

const date = (v: unknown, field: string): Date | null => {
  if (v === undefined || v === null || v === '') return null;
  const d = typeof v === 'string' ? new Date(v) : null;
  if (!d || isNaN(d.getTime())) throw new BadRequestException(`${field} is not a valid date`);
  return d;
};

const imageUrl = (v: unknown): string | null => {
  const t = text(v, 'image_url', 500);
  if (t && !/^(\/uploads\/[\w.\-]+|https?:\/\/\S+)$/.test(t)) throw new BadRequestException('image_url must be an uploaded image or an http(s) link');
  return t;
};

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  private clean(dto: OfferDto, partial: boolean) {
    const data: Record<string, unknown> = {};
    const has = (k: keyof OfferDto) => !partial || dto[k] !== undefined;
    if (has('kind')) {
      if (dto.kind !== 'offer' && dto.kind !== 'event') throw new BadRequestException('kind must be "offer" or "event"');
      data.kind = dto.kind;
    }
    if (has('title_en')) data.title_en = text(dto.title_en, 'title_en', 120, true);
    if (dto.title_kh !== undefined) data.title_kh = text(dto.title_kh, 'title_kh', 120);
    if (dto.body_en !== undefined) data.body_en = text(dto.body_en, 'body_en', 2000);
    if (dto.body_kh !== undefined) data.body_kh = text(dto.body_kh, 'body_kh', 2000);
    if (dto.image_url !== undefined) data.image_url = imageUrl(dto.image_url);
    if (dto.starts_at !== undefined) data.starts_at = date(dto.starts_at, 'starts_at');
    if (dto.ends_at !== undefined) data.ends_at = date(dto.ends_at, 'ends_at');
    if (dto.active !== undefined) {
      if (typeof dto.active !== 'boolean') throw new BadRequestException('active must be true or false');
      data.active = dto.active;
    }
    const s = data.starts_at as Date | null | undefined, e = data.ends_at as Date | null | undefined;
    if (s && e && e < s) throw new BadRequestException('ends_at must not be before starts_at');
    return data;
  }

  /** Public: active items that are current or upcoming. Events by date, offers by admin order. */
  async listPublic(kind?: string, now = new Date()) {
    if (kind !== undefined && kind !== 'offer' && kind !== 'event') throw new BadRequestException('kind must be "offer" or "event"');
    const rows = await this.prisma.offer.findMany({
      where: { active: true, ...(kind ? { kind } : {}) },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    const live = rows.filter((r) => !isExpired(r, now));
    const far = Number.MAX_SAFE_INTEGER;
    return live.sort((a, b) => a.kind === 'event' && b.kind === 'event'
      ? (a.starts_at?.getTime() ?? far) - (b.starts_at?.getTime() ?? far) || a.id - b.id
      : 0);
  }

  async listAll(now = new Date()) {
    const rows = await this.prisma.offer.findMany({ orderBy: [{ kind: 'asc' }, { sort_order: 'asc' }, { id: 'asc' }] });
    return rows.map((r) => ({ ...r, expired: isExpired(r, now) }));
  }

  async create(dto: OfferDto) {
    const data = this.clean(dto, false) as any;
    const last = await this.prisma.offer.aggregate({ where: { kind: data.kind }, _max: { sort_order: true } });
    return this.prisma.offer.create({ data: { ...data, sort_order: (last._max.sort_order ?? -1) + 1 } });
  }

  async update(id: number, dto: OfferDto) {
    await this.mustExist(id);
    return this.prisma.offer.update({ where: { id }, data: this.clean(dto, true) as any });
  }

  async remove(id: number) {
    await this.mustExist(id);
    await this.prisma.offer.delete({ where: { id } });
    return { deleted: id };
  }

  async reorder(kind: unknown, ids: unknown) {
    if (kind !== 'offer' && kind !== 'event') throw new BadRequestException('kind must be "offer" or "event"');
    const existing = (await this.prisma.offer.findMany({ where: { kind }, select: { id: true } })).map((r) => r.id);
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length || !ids.every((i) => existing.includes(i))) {
      throw new BadRequestException(`ids must list every ${kind} exactly once`);
    }
    await this.prisma.$transaction(ids.map((id: number, i) => this.prisma.offer.update({ where: { id }, data: { sort_order: i } })));
    return { ids };
  }

  private async mustExist(id: number) {
    if (!Number.isInteger(id) || !(await this.prisma.offer.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException(`offer ${id} not found`);
    }
  }
}
