import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type Hours = { day: number; open: string; close: string; closed: boolean };
const DEFAULT_HOURS: Hours[] = Array.from({ length: 7 }, (_, day) => ({ day, open: '10:00', close: '22:00', closed: false }));
const TEXT_FIELDS = ['phone', 'email', 'address_en', 'address_kh', 'map_url', 'map_embed', 'facebook', 'instagram', 'telegram', 'tiktok', 'notice'] as const;
const URL_FIELDS = new Set(['map_url', 'map_embed', 'facebook', 'instagram', 'telegram', 'tiktok']);
const MAX: Record<string, number> = { phone: 30, email: 120, address_en: 300, address_kh: 300, map_url: 500, map_embed: 1000, facebook: 300, instagram: 300, telegram: 300, tiktok: 300, notice: 160 };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private shape(row: any) {
    const base = row ?? {};
    const hours = Array.isArray(base.hours) && base.hours.length === 7 ? base.hours : DEFAULT_HOURS;
    const out: Record<string, unknown> = {};
    for (const f of TEXT_FIELDS) out[f] = base[f] ?? null;
    return { ...out, hours, updated_at: base.updated_at ?? null };
  }

  async get() {
    return this.shape(await this.prisma.siteSetting.findUnique({ where: { id: 1 } }));
  }

  async update(dto: Record<string, unknown>) {
    if (!dto || typeof dto !== 'object') throw new BadRequestException('body is required');
    const data: Record<string, unknown> = {};
    for (const f of TEXT_FIELDS) {
      if (dto[f] === undefined) continue;
      const v = dto[f];
      if (v === null || v === '') { data[f] = null; continue; }
      if (typeof v !== 'string' || v.trim().length > MAX[f]) throw new BadRequestException(`${f} is invalid (max ${MAX[f]} characters)`);
      const t = v.trim();
      if (f === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new BadRequestException('email is invalid');
      if (f === 'phone' && !/^\+?[\d\s().-]{6,30}$/.test(t)) throw new BadRequestException('phone is invalid');
      if (URL_FIELDS.has(f) && !/^https?:\/\/\S+$/i.test(t)) throw new BadRequestException(`${f} must be an http(s) link`);
      data[f] = t;
    }
    if (dto.hours !== undefined) {
      const h = dto.hours as Hours[];
      if (!Array.isArray(h) || h.length !== 7) throw new BadRequestException('hours must have 7 entries (Monday to Sunday)');
      data.hours = h.map((d, i) => {
        if (!d || d.day !== i || typeof d.closed !== 'boolean' || !TIME.test(String(d.open)) || !TIME.test(String(d.close))) {
          throw new BadRequestException(`hours entry ${i} is invalid (day, open HH:MM, close HH:MM, closed)`);
        }
        return { day: i, open: d.open, close: d.close, closed: d.closed };
      });
    }
    const row = await this.prisma.siteSetting.upsert({ where: { id: 1 }, update: data as any, create: { id: 1, ...(data as any) } });
    return this.shape(row);
  }
}
