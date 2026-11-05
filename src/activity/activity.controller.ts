import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { PrismaService } from '../prisma.service';

const PAGE_SIZE = 50;

// Owner only (the guard's role matrix restricts /activity*).
@Controller('activity')
@UseGuards(AdminGuard)
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('actor') actor?: string, @Query('page') page?: string) {
    const pg = Math.max(Math.trunc(Number(page)) || 1, 1);
    const where = typeof actor === 'string' && actor.trim() ? { actor: actor.trim().slice(0, 64) } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({ where, orderBy: { id: 'desc' }, skip: (pg - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    ]);
    return { items, total, page: pg, pages: Math.ceil(total / PAGE_SIZE), page_size: PAGE_SIZE };
  }

  @Get('actors')
  async actors() {
    const rows = await this.prisma.activityLog.findMany({ distinct: ['actor'], select: { actor: true }, orderBy: { actor: 'asc' }, take: 200 });
    return rows.map((r) => r.actor);
  }
}
