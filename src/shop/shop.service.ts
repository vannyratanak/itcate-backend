import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const DEFAULTS = { id: 1, name: 'Itacate', title: 'Best Spanish Restaurant', logo_url: null as string | null };

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return (await this.prisma.shop.findUnique({ where: { id: 1 } })) ?? DEFAULTS;
  }

  async update(dto: { name?: string; title?: string; logo_url?: string | null }) {
    const data: { name?: string; title?: string; logo_url?: string | null } = {};
    for (const key of ['name', 'title'] as const) {
      if (dto[key] === undefined) continue;
      const v = typeof dto[key] === 'string' ? dto[key].trim() : '';
      if (!v || v.length > 120) throw new BadRequestException(`${key} is required (max 120 characters)`);
      data[key] = v;
    }
    if (dto.logo_url !== undefined) {
      if (dto.logo_url !== null && (typeof dto.logo_url !== 'string' || dto.logo_url.length > 500)) {
        throw new BadRequestException('logo_url is invalid');
      }
      data.logo_url = dto.logo_url || null;
    }
    return this.prisma.shop.upsert({
      where: { id: 1 },
      update: data,
      create: { ...DEFAULTS, ...data },
    });
  }
}
