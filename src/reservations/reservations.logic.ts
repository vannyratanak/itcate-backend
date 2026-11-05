// Pure helpers (no database): slot generation, validation, rate limiting. Unit-tested in reservations.logic.spec.ts.
import { BadRequestException } from '@nestjs/common';

export type DayHours = { day: number; open: string; close: string; closed: boolean }; // day 0 = Monday
export const TZ = 'Asia/Phnom_Penh';
export const SLOT_MINUTES = 30;
export const SLOT_CAPACITY = 40;        // max guests booked for one time slot
export const MAX_PARTY = 20;
export const MAX_DAYS_AHEAD = 90;
export const DEFAULT_OPEN = '10:00';
export const DEFAULT_CLOSE = '22:00';
export const STATUSES = ['pending', 'confirmed', 'declined', 'cancelled'] as const;
export type Status = (typeof STATUSES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "YYYY-MM-DD" -> Date at 00:00 UTC (what a Postgres DATE column stores), or null when not a real date. */
export function parseDate(s: unknown): Date | null {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}
export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/** Today's date and minutes-since-midnight in the restaurant's time zone. */
export function nowInRestaurant(now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Monday = 0 ... Sunday = 6 */
export const weekdayIndex = (d: Date) => (d.getUTCDay() + 6) % 7;
export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Opening hours for the weekday of `date` (falls back to the defaults when settings have none). */
export function hoursFor(hours: unknown, date: Date): { closed: boolean; open: string; close: string } {
  const list = Array.isArray(hours) ? (hours as DayHours[]) : [];
  const h = list.find((x) => x && x.day === weekdayIndex(date));
  if (!h) return { closed: false, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
  const ok = TIME_RE.test(h.open) && TIME_RE.test(h.close) && toMinutes(h.close) > toMinutes(h.open);
  return { closed: !!h.closed || !ok, open: h.open, close: h.close };
}

/** 30-minute start times from opening until 30 minutes before closing. */
export function slotTimes(open: string, close: string): string[] {
  const out: string[] = [];
  for (let m = toMinutes(open); m + SLOT_MINUTES <= toMinutes(close); m += SLOT_MINUTES) out.push(toTime(m));
  return out;
}

export type Slot = { time: string; available: boolean };
export type AvailabilityInput = {
  date: Date; hours: unknown; blockedReason?: string | null;
  booked: Record<string, number>;            // time -> guests already booked (pending + confirmed)
  partySize?: number; now?: Date;
};
export type Availability = { open: boolean; slots: Slot[]; reason?: string };

export function computeAvailability(i: AvailabilityInput): Availability {
  const today = nowInRestaurant(i.now);
  const ds = fmtDate(i.date);
  if (ds < today.date) return { open: false, slots: [], reason: 'past' };
  if (i.blockedReason !== undefined && i.blockedReason !== null) return { open: false, slots: [], reason: i.blockedReason || 'blocked' };
  const h = hoursFor(i.hours, i.date);
  if (h.closed) return { open: false, slots: [], reason: 'closed' };
  const need = i.partySize && i.partySize > 0 ? i.partySize : 1;
  const slots = slotTimes(h.open, h.close).map((time) => {
    const passed = ds === today.date && toMinutes(time) < today.minutes + SLOT_MINUTES; // need at least 30 minutes' notice
    const free = SLOT_CAPACITY - (i.booked[time] ?? 0) >= need;
    return { time, available: !passed && free };
  });
  return { open: slots.length > 0, slots, ...(slots.length ? {} : { reason: 'closed' }) };
}

export type CreateInput = {
  name: string; phone: string; email: string | null; party_size: number; date: Date; time: string; notes: string | null; honeypot: boolean;
};

const bad = (m: string) => new BadRequestException(m);

/** Validates + normalises the public form. Throws BadRequestException with a user-readable message. */
export function validateCreate(body: any, now = new Date()): CreateInput {
  const b = body && typeof body === 'object' ? body : {};
  const honeypot = typeof b.website === 'string' && b.website.trim() !== '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 100) throw bad('name is required (max 100 characters)');
  const phone = typeof b.phone === 'string' ? b.phone.replace(/[\s.\-()]/g, '') : '';
  if (!/^\+?\d{8,15}$/.test(phone)) throw bad('phone number is invalid');
  let email: string | null = null;
  if (b.email !== undefined && b.email !== null && String(b.email).trim() !== '') {
    email = String(b.email).trim();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('email is invalid');
  }
  const party = Number(b.party_size);
  if (!Number.isInteger(party) || party < 1 || party > MAX_PARTY) throw bad(`party_size must be between 1 and ${MAX_PARTY}`);
  const date = parseDate(b.date);
  if (!date) throw bad('date is invalid');
  const today = nowInRestaurant(now);
  const ds = fmtDate(date);
  if (ds < today.date) throw bad('date cannot be in the past');
  const limit = new Date(`${today.date}T00:00:00.000Z`); limit.setUTCDate(limit.getUTCDate() + MAX_DAYS_AHEAD);
  if (date > limit) throw bad(`bookings open up to ${MAX_DAYS_AHEAD} days ahead`);
  if (typeof b.time !== 'string' || !TIME_RE.test(b.time)) throw bad('time is invalid');
  let notes: string | null = null;
  if (b.notes !== undefined && b.notes !== null && String(b.notes).trim() !== '') {
    notes = String(b.notes).trim();
    if (notes.length > 500) throw bad('notes are too long (max 500 characters)');
  }
  return { name, phone, email, party_size: party, date, time: b.time, notes, honeypot };
}

export const reference = (id: number) => `ITC-${String(id).padStart(5, '0')}`;

/** Sliding-window limiter: at most `max` hits per `windowMs` per key. In memory (resets on restart). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max = 5, private windowMs = 60 * 60 * 1000) {}
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(now); this.hits.set(key, recent);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    return true;
  }
}
