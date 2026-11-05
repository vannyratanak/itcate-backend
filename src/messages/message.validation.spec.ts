import { BadRequestException } from '@nestjs/common';
import { cleanPublicMessage, RateLimiter } from './message.validation';

const ok = { kind: 'contact', name: ' Sokha ', email: 'sokha@example.com', message: ' Hello ' };

describe('cleanPublicMessage', () => {
  it('trims and accepts a valid contact message', () => {
    const m = cleanPublicMessage(ok);
    expect(m).toMatchObject({ kind: 'contact', name: 'Sokha', email: 'sokha@example.com', phone: null, message: 'Hello', data: null });
  });
  it('requires email or phone', () => {
    expect(() => cleanPublicMessage({ ...ok, email: '' })).toThrow(BadRequestException);
    expect(cleanPublicMessage({ ...ok, email: '', phone: '+855 12 345 678' }).phone).toBe('+855 12 345 678');
  });
  it('rejects bad email/phone, empty name/message, long text', () => {
    expect(() => cleanPublicMessage({ ...ok, email: 'nope' })).toThrow();
    expect(() => cleanPublicMessage({ ...ok, email: '', phone: 'abc' })).toThrow();
    expect(() => cleanPublicMessage({ ...ok, name: '  ' })).toThrow();
    expect(() => cleanPublicMessage({ ...ok, message: '' })).toThrow();
    expect(() => cleanPublicMessage({ ...ok, message: 'x'.repeat(3001) })).toThrow();
  });
  it('rejects the honeypot, unknown kinds and the career kind', () => {
    expect(() => cleanPublicMessage({ ...ok, website: 'http://spam' })).toThrow();
    expect(() => cleanPublicMessage({ ...ok, kind: 'career' })).toThrow();
    expect(() => cleanPublicMessage({ ...ok, kind: 'x' })).toThrow();
    expect(() => cleanPublicMessage(null)).toThrow();
    expect(() => cleanPublicMessage('str')).toThrow();
  });
  it('whitelists catering data and validates it', () => {
    const m = cleanPublicMessage({ ...ok, kind: 'catering', data: { event_date: '2026-12-24', guests: '40', event_type: 'Wedding', evil: '<script>' } });
    expect(m.data).toEqual({ event_date: '2026-12-24', guests: 40, event_type: 'Wedding' });
    expect(() => cleanPublicMessage({ ...ok, kind: 'catering', data: { guests: 0 } })).toThrow();
    expect(() => cleanPublicMessage({ ...ok, kind: 'catering', data: { event_date: '24/12/2026' } })).toThrow();
  });
  it('requires a sane gift card amount; message optional', () => {
    const m = cleanPublicMessage({ kind: 'gift_card', name: 'A', phone: '012345678', message: '', data: { amount: '25', recipient_name: 'Bopha', x: 1 } });
    expect(m.data).toEqual({ amount: 25, recipient_name: 'Bopha' });
    expect(m.message).toBeTruthy();
    expect(() => cleanPublicMessage({ kind: 'gift_card', name: 'A', phone: '012345678', data: {} })).toThrow();
    expect(() => cleanPublicMessage({ kind: 'gift_card', name: 'A', phone: '012345678', data: { amount: 5000 } })).toThrow();
  });
});

describe('RateLimiter', () => {
  it('allows max hits per window per key, then recovers', () => {
    const r = new RateLimiter(3, 1000);
    expect([1, 2, 3].map(() => r.allow('a', 0))).toEqual([true, true, true]);
    expect(r.allow('a', 10)).toBe(false);
    expect(r.allow('b', 10)).toBe(true);
    expect(r.allow('a', 1500)).toBe(true);
  });
});
