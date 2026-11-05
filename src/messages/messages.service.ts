import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ALL_KINDS, CleanMessage, STATUSES } from './message.validation';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(m: CleanMessage) {
    await this.prisma.contactMessage.create({
      data: { kind: m.kind, name: m.name, email: m.email, phone: m.phone, subject: m.subject, message: m.message, data: m.data ?? undefined },
    });
    return { ok: true };
  }

  async list(q: { kind?: string; status?: string; q?: string; page?: string }) {
    const where: Prisma.ContactMessageWhereInput = {};
    if (q.kind) {
      if (!(ALL_KINDS as readonly string[]).includes(q.kind)) throw new BadRequestException('unknown kind');
      where.kind = q.kind;
    }
    if (q.status) {
      if (!(STATUSES as readonly string[]).includes(q.status)) throw new BadRequestException('unknown status');
      where.status = q.status;
    }
    const term = (q.q ?? '').trim().slice(0, 100);
    if (term) {
      where.OR = ['name', 'email', 'phone', 'subject', 'message'].map((f) => ({ [f]: { contains: term, mode: 'insensitive' } })) as Prisma.ContactMessageWhereInput[];
    }
    const limit = 25;
    const page = Math.max(Math.trunc(Number(q.page)) || 1, 1);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async unreadCount() {
    const rows = await this.prisma.contactMessage.groupBy({ by: ['kind'], where: { status: 'new' }, _count: { _all: true } });
    const byKind: Record<string, number> = {};
    let total = 0;
    for (const r of rows) { byKind[r.kind] = r._count._all; total += r._count._all; }
    return { total, byKind };
  }

  // Opening a message marks a "new" one as "read".
  async findOne(id: number) {
    const m = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`message ${id} not found`);
    if (m.status === 'new') return this.prisma.contactMessage.update({ where: { id }, data: { status: 'read' } });
    return m;
  }

  async setStatus(id: number, status: unknown) {
    if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    const exists = await this.prisma.contactMessage.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`message ${id} not found`);
    return this.prisma.contactMessage.update({ where: { id }, data: { status } });
  }

  async remove(id: number) {
    const exists = await this.prisma.contactMessage.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`message ${id} not found`);
    await this.prisma.contactMessage.delete({ where: { id } });
    return { deleted: id };
  }
}
