import { BadRequestException } from '@nestjs/common';

export const PUBLIC_KINDS = ['contact', 'catering', 'gift_card'] as const;
export type PublicKind = (typeof PUBLIC_KINDS)[number];
export const ALL_KINDS = [...PUBLIC_KINDS, 'career'] as const;
export const STATUSES = ['new', 'read', 'replied', 'archived'] as const;

const str = (v: unknown, field: string, max: number, required = false): string | null => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new BadRequestException(`${field} is required`);
    return null;
  }
  if (typeof v !== 'string') throw new BadRequestException(`${field} is invalid`);
  const t = v.trim();
  if (!t) {
    if (required) throw new BadRequestException(`${field} is required`);
    return null;
  }
  if (t.length > max) throw new BadRequestException(`${field} is too long (max ${max} characters)`);
  return t;
};

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{7,20}$/;

export type CleanMessage = {
  kind: PublicKind;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  data: Record<string, string | number> | null;
};

// Validates a PUBLIC form submission. Throws BadRequestException with a readable reason.
export function cleanPublicMessage(body: any): CleanMessage {
  if (!body || typeof body !== 'object') throw new BadRequestException('invalid request');
  if (body.website) throw new BadRequestException('invalid request'); // honeypot: bots fill every field
  const kind = body.kind;
  if (!PUBLIC_KINDS.includes(kind)) throw new BadRequestException('kind must be contact, catering or gift_card');
  const name = str(body.name, 'name', 100, true)!;
  const email = str(body.email, 'email', 254);
  const phone = str(body.phone, 'phone', 20);
  if (!email && !phone) throw new BadRequestException('email or phone is required');
  if (email && !EMAIL.test(email)) throw new BadRequestException('email is invalid');
  if (phone && !PHONE.test(phone)) throw new BadRequestException('phone is invalid');
  const subject = str(body.subject, 'subject', 150);
  const message = str(body.message, 'message', 3000, kind !== 'gift_card') ?? '';
  const raw = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  let data: Record<string, string | number> | null = null;

  if (kind === 'catering') {
    data = {};
    const eventDate = str(raw.event_date, 'event_date', 10);
    if (eventDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || isNaN(new Date(eventDate).getTime())) throw new BadRequestException('event_date is invalid');
      data.event_date = eventDate;
    }
    const eventType = str(raw.event_type, 'event_type', 60);
    if (eventType) data.event_type = eventType;
    if (raw.guests !== undefined && raw.guests !== '' && raw.guests !== null) {
      const g = Number(raw.guests);
      if (!Number.isInteger(g) || g < 1 || g > 2000) throw new BadRequestException('guests must be a whole number between 1 and 2000');
      data.guests = g;
    }
  } else if (kind === 'gift_card') {
    data = {};
    if (raw.amount === undefined || raw.amount === null || raw.amount === '') throw new BadRequestException('amount is required');
    const a = Number(raw.amount);
    if (!Number.isFinite(a) || a < 5 || a > 1000) throw new BadRequestException('amount must be between 5 and 1000');
    data.amount = Math.round(a * 100) / 100;
    const rn = str(raw.recipient_name, 'recipient_name', 100);
    if (rn) data.recipient_name = rn;
  }
  return { kind, name, email, phone, subject, message: message || (kind === 'gift_card' ? '(gift card request)' : ''), data: data && Object.keys(data).length ? data : null };
}

// Simple in-memory limiter: `max` hits per `windowMs` per key.
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly max = 10, private readonly windowMs = 60 * 60 * 1000) {}
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    return true;
  }
}
