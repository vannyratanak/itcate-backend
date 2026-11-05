import { BadRequestException } from '@nestjs/common';
import { bucketPerDay, csvCell, csvRow, parseRange, scoreFor } from './analytics.helpers';

describe('scoreFor', () => {
  it('spreads a 5-option scale from 5 down to 1 with Neutral = 3', () => {
    expect([0, 1, 2, 3, 4].map((p) => scoreFor(p, 5))).toEqual([5, 4, 3, 2, 1]);
  });
  it('handles 2- and 1-option scales', () => {
    expect([scoreFor(0, 2), scoreFor(1, 2)]).toEqual([5, 1]);
    expect(scoreFor(0, 1)).toBe(5);
  });
});

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralises spreadsheet formulas', () => {
    for (const f of ['=1+1', '+85512345678', '-2', '@SUM(A1)', '\tx']) expect(csvCell(f).replace(/^"/, '')[0]).toBe("'");
  });
  it('leaves plain text, numbers, null and dates alone', () => {
    expect(csvCell('Sok Dara')).toBe('Sok Dara');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(null)).toBe('');
    expect(csvCell(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(csvRow(['a', 'b,c', 3])).toBe('a,"b,c",3');
  });
});

describe('parseRange', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  it('defaults to the last 30 days, `to` inclusive', () => {
    const r = parseRange(undefined, undefined, now);
    expect([r.fromStr, r.toStr]).toEqual(['2026-10-07', '2026-11-05']);
    expect(r.to.toISOString()).toBe('2026-11-05T23:59:59.999Z');
  });
  it('rejects bad input', () => {
    for (const [f, t] of [['2026-13-01', undefined], ['nope', undefined], ['2026-02-30', undefined], ['2026-11-05', '2026-11-01'], ['2024-01-01', '2026-01-01']])
      expect(() => parseRange(f as string, t as string | undefined, now)).toThrow(BadRequestException);
  });
});

describe('bucketPerDay', () => {
  it('zero-fills and counts by UTC day', () => {
    const out = bucketPerDay([new Date('2026-11-03T05:00:00Z'), new Date('2026-11-03T20:00:00Z'), new Date('2026-11-05T01:00:00Z')],
      new Date('2026-11-03T00:00:00Z'), new Date('2026-11-05T12:00:00Z'));
    expect(out).toEqual([{ date: '2026-11-03', count: 2 }, { date: '2026-11-04', count: 0 }, { date: '2026-11-05', count: 1 }]);
  });
});
