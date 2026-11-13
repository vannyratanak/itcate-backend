import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  RateLimiter, STATUSES, computeAvailability, fmtDate, nowInRestaurant, parseDate, reference, validateCreate, Availability,
} from './reservations.logic';

@Injectable()
export class ReservationsService {
  private readonly log = new Logger('Reservations');
  private readonly limiter = new RateLimiter(5, 60 * 60 * 1000);
  constructor(private readonly prisma: PrismaService) {}

  private async hours() {
    const s = await this.prisma.siteSetting.findUnique({ where: { id: 1 }, select: { hours: true } });
    return s?.hours ?? null;
  }

  /** Guests already booked per time for one date (pending + confirmed). */
  private async booked(date: Date) {
    const rows = await this.prisma.reservation.groupBy({
      by: ['time'], where: { date, status: { in: ['pending', 'confirmed'] } }, _sum: { party_size: true },
    });
    return Object.fromEntries(rows.map((r) => [r.time, r._sum.party_size ?? 0]));
  }

  async availability(dateStr: string, partySize?: number): Promise<Availability> {
    const date = parseDate(dateStr);
    if (!date) throw new BadRequestException('date must be YYYY-MM-DD');
    const [hours, blocked, booked] = await Promise.all([
      this.hours(), this.prisma.blockedDate.findUnique({ where: { date } }), this.booked(date),
    ]);
    return computeAvailability({ date, hours, blockedReason: blocked ? blocked.reason ?? '' : null, booked, partySize });
  }

  async create(body: any, ip: string) {
    const input = validateCreate(body);
    if (input.honeypot) return { id: 0, status: 'pending', reference: reference(0) }; // bots get a fake success, nothing is stored
    if (!this.limiter.allow(ip)) throw new HttpException('Too many booking requests. Please try again later or call us.', HttpStatus.TOO_MANY_REQUESTS);
    const av = await this.availability(fmtDate(input.date), input.party_size);
    const slot = av.slots.find((s) => s.time === input.time);
    if (!av.open) throw new BadRequestException('We are not taking bookings for that date');
    if (!slot) throw new BadRequestException('That time is outside our opening hours. Please pick another time.');
    if (!slot.available) throw new BadRequestException('Sorry, that time is no longer available. Please pick another one.');
    const r = await this.prisma.reservation.create({
      data: { name: input.name, phone: input.phone, email: input.email, party_size: input.party_size, date: input.date, time: input.time, notes: input.notes },
    });
    void this.notify(r);
    return { id: r.id, status: r.status, reference: reference(r.id) };
  }

  /** Fire-and-forget Telegram message; skipped unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. */
  private async notify(r: { id: number; name: string; phone: string; party_size: number; date: Date; time: string; notes: string | null }) {
    const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chat) return;
    try {
      const text = `New reservation ${reference(r.id)}\n${r.name} · ${r.phone}\n${r.party_size} guests · ${fmtDate(r.date)} ${r.time}${r.notes ? `\nNotes: ${r.notes}` : ''}`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }), signal: AbortSignal.timeout(5000),
      });
    } catch (e) { this.log.warn(`telegram notify failed: ${(e as Error).message}`); }
  }

  // ---------- admin ----------
  async list(q: { status?: string; from?: string; to?: string; page?: string; limit?: string }) {
    const where: any = {};
    if (q.status) {
      if (!(STATUSES as readonly string[]).includes(q.status)) throw new BadRequestException('invalid status');
      where.status = q.status;
    }
    const from = q.from ? parseDate(q.from) : null, to = q.to ? parseDate(q.to) : null;
    if ((q.from && !from) || (q.to && !to)) throw new BadRequestException('from/to must be YYYY-MM-DD');
    if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const take = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);
    const [total, items, pending] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({ where, orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }], skip: (page - 1) * take, take }),
      this.prisma.reservation.count({ where: { status: 'pending', date: { gte: parseDate(nowInRestaurant().date)! } } }),
    ]);
    return { items: items.map((r) => ({ ...r, date: fmtDate(r.date), reference: reference(r.id) })), total, page, limit: take, pages: Math.ceil(total / take), pending };
  }

  async get(id: number) {
    const r = await this.prisma.reservation.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`reservation ${id} not found`);
    return { ...r, date: fmtDate(r.date), reference: reference(r.id) };
  }

  async update(id: number, body: any) {
    await this.get(id);
    const data: { status?: string; admin_note?: string | null } = {};
    if (body?.status !== undefined) {
      if (!(STATUSES as readonly string[]).includes(body.status)) throw new BadRequestException('invalid status');
      data.status = body.status;
    }
    if (body?.admin_note !== undefined) {
      const n = body.admin_note === null ? '' : String(body.admin_note).trim();
      if (n.length > 500) throw new BadRequestException('note is too long (max 500 characters)');
      data.admin_note = n || null;
    }
    if (!Object.keys(data).length) throw new BadRequestException('nothing to update');
    await this.prisma.reservation.update({ where: { id }, data });
    return this.get(id);
  }

  async remove(id: number) {
    await this.get(id);
    await this.prisma.reservation.delete({ where: { id } });
    return { deleted: id };
  }

  /** Per-day counts for one month: [{ date, count, pending, guests, blocked }] */
  async calendar(month: string) {
    if (!/^\d{4}-\d{2}$/.test(month ?? '')) throw new BadRequestException('month must be YYYY-MM');
    const start = parseDate(`${month}-01`);
    if (!start) throw new BadRequestException('month is invalid');
    const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
    const [rows, blocked] = await Promise.all([
      this.prisma.reservation.findMany({ where: { date: { gte: start, lte: end }, status: { in: ['pending', 'confirmed'] } }, select: { date: true, status: true, party_size: true } }),
      this.prisma.blockedDate.findMany({ where: { date: { gte: start, lte: end } } }),
    ]);
    const days = new Map<string, { date: string; count: number; pending: number; guests: number; blocked: boolean }>();
    const day = (d: string) => days.get(d) ?? (days.set(d, { date: d, count: 0, pending: 0, guests: 0, blocked: false }), days.get(d)!);
    for (const r of rows) { const e = day(fmtDate(r.date)); e.count++; e.guests += r.party_size; if (r.status === 'pending') e.pending++; }
    for (const b of blocked) day(fmtDate(b.date)).blocked = true;
    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async blocked() {
    const today = parseDate(nowInRestaurant().date)!;
    const rows = await this.prisma.blockedDate.findMany({ where: { date: { gte: today } }, orderBy: { date: 'asc' } });
    return rows.map((b) => ({ id: b.id, date: fmtDate(b.date), reason: b.reason }));
  }

  async block(body: any) {
    const date = parseDate(body?.date);
    if (!date) throw new BadRequestException('date must be YYYY-MM-DD');
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
    const b = await this.prisma.blockedDate.upsert({ where: { date }, update: { reason: reason || null }, create: { date, reason: reason || null } });
    return { id: b.id, date: fmtDate(b.date), reason: b.reason };
  }

  async unblock(id: number) {
    const b = await this.prisma.blockedDate.findUnique({ where: { id } });
    if (!b) throw new NotFoundException(`blocked date ${id} not found`);
    await this.prisma.blockedDate.delete({ where: { id } });
    return { deleted: id };
  }
}
