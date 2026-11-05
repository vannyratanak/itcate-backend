import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OffersService, isExpired } from './offers.service';

const now = new Date('2026-11-10T12:00:00');
const d = (s: string) => new Date(s);

describe('isExpired', () => {
  it('offers without an end date never expire', () => {
    expect(isExpired({ kind: 'offer', starts_at: d('2026-01-01'), ends_at: null }, now)).toBe(false);
  });
  it('items expire once ends_at is past', () => {
    expect(isExpired({ kind: 'offer', starts_at: null, ends_at: d('2026-11-09T23:00:00') }, now)).toBe(true);
    expect(isExpired({ kind: 'offer', starts_at: null, ends_at: d('2026-11-11T00:00:00') }, now)).toBe(false);
  });
  it('an event with only a start date stays visible for that whole day', () => {
    expect(isExpired({ kind: 'event', starts_at: d('2026-11-10T09:00:00'), ends_at: null }, now)).toBe(false);
    expect(isExpired({ kind: 'event', starts_at: d('2026-11-09T20:00:00'), ends_at: null }, now)).toBe(true);
  });
  it('upcoming events are not expired', () => {
    expect(isExpired({ kind: 'event', starts_at: d('2026-12-24T19:00:00'), ends_at: null }, now)).toBe(false);
  });
});

const rows = [
  { id: 1, kind: 'event', active: true, sort_order: 0, starts_at: d('2026-12-24'), ends_at: null },
  { id: 2, kind: 'event', active: true, sort_order: 1, starts_at: d('2026-11-20'), ends_at: null },
  { id: 3, kind: 'event', active: true, sort_order: 2, starts_at: d('2026-10-01'), ends_at: null }, // expired
  { id: 4, kind: 'offer', active: true, sort_order: 0, starts_at: null, ends_at: null },
];
const fake: any = { offer: { findMany: async ({ where }: any) => rows.filter((r) => (!where.kind || r.kind === where.kind) && r.active === where.active) } };

describe('OffersService', () => {
  const svc = new OffersService(fake);
  it('public list hides expired and sorts events by date', async () => {
    const ev = await svc.listPublic('event', now);
    expect(ev.map((r) => r.id)).toEqual([2, 1]);
  });
  it('rejects an unknown kind', async () => {
    await expect(svc.listPublic('banana', now)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('validates create input', async () => {
    await expect(svc.create({ kind: 'offer', title_en: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ kind: 'party', title_en: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ kind: 'offer', title_en: 'x', image_url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ kind: 'offer', title_en: 'x', starts_at: '2026-11-10', ends_at: '2026-11-01' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ kind: 'offer', title_en: 'x', starts_at: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
