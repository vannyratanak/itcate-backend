import { describe, expect, it } from 'vitest';
import {
  RateLimiter, computeAvailability, hoursFor, nowInRestaurant, parseDate, reference, slotTimes, validateCreate, weekdayIndex,
} from './reservations.logic';

// Phnom Penh is UTC+7. 2026-11-05 03:00Z = 10:00 local on Thursday 2026-11-05.
const NOW = new Date('2026-11-05T03:00:00Z');
const hours = Array.from({ length: 7 }, (_, day) => ({ day, open: '10:00', close: '22:00', closed: day === 0 })); // Monday closed
const body = (o: any = {}) => ({ name: 'Sok', phone: '+855 12 345 678', party_size: 4, date: '2026-11-07', time: '19:00', ...o });

describe('dates', () => {
  it('parses real dates only', () => {
    expect(parseDate('2026-11-05')?.toISOString()).toBe('2026-11-05T00:00:00.000Z');
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('11/05/2026')).toBeNull();
    expect(parseDate(20261105)).toBeNull();
  });
  it('uses the restaurant time zone for "today"', () => {
    expect(nowInRestaurant(new Date('2026-11-05T18:30:00Z'))).toEqual({ date: '2026-11-06', minutes: 90 });
  });
  it('Monday is 0', () => {
    expect(weekdayIndex(parseDate('2026-11-02')!)).toBe(0);
    expect(weekdayIndex(parseDate('2026-11-08')!)).toBe(6);
  });
});

describe('slots', () => {
  it('30-minute starts, last one 30 min before close', () => {
    expect(slotTimes('10:00', '12:00')).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });
  it('falls back to default hours and honours closed days', () => {
    expect(hoursFor(null, parseDate('2026-11-05')!)).toEqual({ closed: false, open: '10:00', close: '22:00' });
    expect(hoursFor(hours, parseDate('2026-11-02')!).closed).toBe(true);
    expect(hoursFor([{ day: 3, open: '22:00', close: '10:00', closed: false }], parseDate('2026-11-05')!).closed).toBe(true);
  });
});

describe('availability', () => {
  const base = { hours, booked: {}, now: NOW };
  it('closed weekday, past day, blocked date', () => {
    expect(computeAvailability({ ...base, date: parseDate('2026-11-09')! })).toMatchObject({ open: false, reason: 'closed' });
    expect(computeAvailability({ ...base, date: parseDate('2026-11-04')! })).toMatchObject({ open: false, reason: 'past' });
    expect(computeAvailability({ ...base, date: parseDate('2026-11-06')!, blockedReason: 'Private party' })).toMatchObject({ open: false, reason: 'Private party' });
  });
  it('same-day slots need 30 minutes notice', () => {
    const a = computeAvailability({ ...base, date: parseDate('2026-11-05')! });
    expect(a.slots.find((s) => s.time === '10:00')!.available).toBe(false);
    expect(a.slots.find((s) => s.time === '10:30')!.available).toBe(true); // exactly 30 minutes away
    expect(a.slots.find((s) => s.time === '11:00')!.available).toBe(true);
  });
  it('capacity of 40 guests per slot', () => {
    const d = parseDate('2026-11-06')!;
    expect(computeAvailability({ ...base, date: d, booked: { '19:00': 38 }, partySize: 2 }).slots.find((s) => s.time === '19:00')!.available).toBe(true);
    expect(computeAvailability({ ...base, date: d, booked: { '19:00': 38 }, partySize: 3 }).slots.find((s) => s.time === '19:00')!.available).toBe(false);
  });
});

describe('validateCreate', () => {
  it('accepts a good booking and normalises it', () => {
    const v = validateCreate(body({ email: ' a@b.co ', notes: ' window ' }), NOW);
    expect(v).toMatchObject({ name: 'Sok', phone: '+85512345678', email: 'a@b.co', notes: 'window', party_size: 4, time: '19:00', honeypot: false });
  });
  it.each([
    [{ name: '' }], [{ name: 'x'.repeat(101) }], [{ phone: '123' }], [{ phone: 'abc12345678' }],
    [{ email: 'nope' }], [{ party_size: 0 }], [{ party_size: 21 }], [{ party_size: 2.5 }],
    [{ date: '2026-11-04' }], [{ date: '2027-03-01' }], [{ date: 'x' }], [{ time: '7pm' }], [{ notes: 'x'.repeat(501) }],
  ])('rejects %j', (o) => { expect(() => validateCreate(body(o), NOW)).toThrow(); });
  it('allows today and exactly 90 days ahead', () => {
    expect(() => validateCreate(body({ date: '2026-11-05' }), NOW)).not.toThrow();
    expect(() => validateCreate(body({ date: '2027-02-03' }), NOW)).not.toThrow();
    expect(() => validateCreate(body({ date: '2027-02-04' }), NOW)).toThrow();
  });
  it('flags the honeypot', () => { expect(validateCreate(body({ website: 'http://spam' }), NOW).honeypot).toBe(true); });
  it('rejects non-object bodies', () => { expect(() => validateCreate(null, NOW)).toThrow(); });
});

describe('misc', () => {
  it('reference is zero padded', () => { expect(reference(7)).toBe('ITC-00007'); });
  it('rate limiter: 5 per hour per key', () => {
    const rl = new RateLimiter(5, 3600_000);
    for (let i = 0; i < 5; i++) expect(rl.allow('a', 1000 + i)).toBe(true);
    expect(rl.allow('a', 2000)).toBe(false);
    expect(rl.allow('b', 2000)).toBe(true);
    expect(rl.allow('a', 1000 + 3600_001)).toBe(true);
  });
});
