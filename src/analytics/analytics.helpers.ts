import { BadRequestException } from '@nestjs/common';

/**
 * Score of an answer on a 1-5 scale, from the option's POSITION in its scale (position 0 = most positive,
 * e.g. "Strongly Agree"). With n options the scores are spread evenly from 5 (first) down to 1 (last):
 *   score = 5 - position * 4 / (n - 1)       (a 1-option scale scores 5)
 * "Neutral" sits in the middle of every 5-option scale, so it scores 3.
 */
export function scoreFor(position: number, n: number): number {
  if (n <= 1) return 5;
  return 5 - (position * 4) / (n - 1);
}

export const round1 = (x: number) => Math.round(x * 10) / 10;
export const LOW_SCORE = 3; // a question whose average is below this is flagged

const DAY = 86_400_000;
export const dayKey = (d: Date) => d.toISOString().slice(0, 10); // UTC calendar day
export const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** [{date, count}] for every day from..to inclusive (zero-filled), bucketed by UTC day. */
export function bucketPerDay(dates: Date[], from: Date, to: Date): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(dayKey(d), (counts.get(dayKey(d)) ?? 0) + 1);
  const out: { date: string; count: number }[] = [];
  for (let d = startOfUtcDay(from); d <= to; d = addDays(d, 1)) out.push({ date: dayKey(d), count: counts.get(dayKey(d)) ?? 0 });
  return out;
}

/** Validate ?from=YYYY-MM-DD&to=YYYY-MM-DD. Defaults to the last 30 days. `to` is inclusive (end of that UTC day). */
export function parseRange(from?: string, to?: string, now = new Date()): { from: Date; to: Date; fromStr: string; toStr: string } {
  const parse = (v: string, name: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequestException(`${name} must be YYYY-MM-DD`);
    const d = new Date(`${v}T00:00:00.000Z`);
    if (isNaN(d.getTime()) || dayKey(d) !== v) throw new BadRequestException(`${name} is not a real date`);
    return d;
  };
  const toDay = to ? parse(to, 'to') : startOfUtcDay(now);
  const fromDay = from ? parse(from, 'from') : addDays(toDay, -29);
  if (fromDay > toDay) throw new BadRequestException('from must not be after to');
  if ((toDay.getTime() - fromDay.getTime()) / DAY > 365) throw new BadRequestException('range is limited to 366 days');
  return { from: fromDay, to: new Date(toDay.getTime() + DAY - 1), fromStr: dayKey(fromDay), toStr: dayKey(toDay) };
}

/** One CSV cell: stringify, neutralise spreadsheet formulas (= + - @ tab CR), quote when needed. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',');
