import { BadRequestException } from '@nestjs/common';
import { RateLimiter, parseApplication, parseJob } from './careers.validation';

describe('parseApplication', () => {
  const ok = { name: ' Sok Dara ', phone: '+855 12 345 678', message: 'I love cooking', email: 'a@b.co', job_id: 3, experience: '2 years' };
  it('accepts a valid application and normalises it', () => {
    const r = parseApplication(ok);
    expect(r.honeypot).toBe(false);
    expect(r.app).toMatchObject({ name: 'Sok Dara', phone: '+85512345678', job_id: 3, email: 'a@b.co' });
  });
  it('allows a general application (no job_id, no email)', () => {
    const r = parseApplication({ name: 'A', phone: '012345678', message: 'hi' });
    expect(r.app).toMatchObject({ job_id: null, email: null, experience: null });
  });
  it('flags a filled honeypot without throwing', () => {
    expect(parseApplication({ ...ok, website: 'http://spam' }).honeypot).toBe(true);
  });
  it.each([
    ['no name', { ...ok, name: '  ' }],
    ['long name', { ...ok, name: 'x'.repeat(101) }],
    ['bad phone', { ...ok, phone: '12ab' }],
    ['bad email', { ...ok, email: 'nope' }],
    ['no message', { ...ok, message: '' }],
    ['long message', { ...ok, message: 'x'.repeat(2001) }],
    ['bad job id', { ...ok, job_id: 'abc' }],
    ['non-string name', { ...ok, name: { a: 1 } }],
  ])('rejects %s', (_n, body) => {
    expect(() => parseApplication(body)).toThrow(BadRequestException);
  });
  it('rejects a non-object body', () => {
    expect(() => parseApplication(null)).toThrow(BadRequestException);
  });
});

describe('parseJob', () => {
  it('requires an English title on create', () => {
    expect(() => parseJob({})).toThrow(BadRequestException);
    expect(parseJob({ title_en: ' Server ' }).title_en).toBe('Server');
  });
  it('turns empty optional fields into null', () => {
    expect(parseJob({ title_en: 'A', title_kh: '', type_en: '' })).toMatchObject({ title_kh: null, type_en: null });
  });
  it('partial update only validates present fields', () => {
    expect(parseJob({ active: false }, true)).toEqual({ active: false });
    expect(() => parseJob({ active: 'no' }, true)).toThrow(BadRequestException);
    expect(() => parseJob({ title_en: '' }, true)).toThrow(BadRequestException);
  });
  it('caps description length', () => {
    expect(() => parseJob({ title_en: 'A', description_en: 'x'.repeat(3001) })).toThrow(BadRequestException);
  });
});

describe('RateLimiter', () => {
  it('allows N per window then blocks, and recovers', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('a', 10)).toBe(true);
    expect(rl.allow('a', 20)).toBe(false);
    expect(rl.allow('b', 20)).toBe(true);
    expect(rl.allow('a', 1100)).toBe(true);
  });
});
