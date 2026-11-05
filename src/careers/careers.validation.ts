import { BadRequestException } from '@nestjs/common';

const optText = (v: unknown, field: string, max: number): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length > max) throw new BadRequestException(`${field} is invalid (max ${max} characters)`);
  return v.trim() || null;
};
const reqText = (v: unknown, field: string, max: number): string => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t || t.length > max) throw new BadRequestException(`${field} is required (max ${max} characters)`);
  return t;
};

export type JobInput = {
  title_en: string; title_kh: string | null; type_en: string | null; type_kh: string | null;
  description_en: string | null; description_kh: string | null; active?: boolean;
};

/** Validate a job payload. `partial` (PATCH) only checks the fields that are present. */
export function parseJob(body: any, partial = false): Partial<JobInput> {
  const b = body && typeof body === 'object' ? body : {};
  const out: Partial<JobInput> = {};
  const has = (k: string) => b[k] !== undefined;
  if (!partial || has('title_en')) out.title_en = reqText(b.title_en, 'title_en', 120);
  for (const [k, max] of [['title_kh', 120], ['type_en', 60], ['type_kh', 60], ['description_en', 3000], ['description_kh', 3000]] as const) {
    if (!partial || has(k)) (out as any)[k] = optText(b[k], k, max);
  }
  if (has('active')) {
    if (typeof b.active !== 'boolean') throw new BadRequestException('active must be a boolean');
    out.active = b.active;
  }
  return out;
}

export type Application = {
  job_id: number | null; name: string; phone: string; email: string | null; message: string; experience: string | null;
};

/** Validate a public application. A filled honeypot (`website`) is reported separately so the caller can silently drop it. */
export function parseApplication(body: any): { honeypot: boolean; app?: Application } {
  const b = body && typeof body === 'object' ? body : {};
  if (typeof b.website === 'string' && b.website.trim()) return { honeypot: true };
  let job_id: number | null = null;
  if (b.job_id !== undefined && b.job_id !== null && b.job_id !== '') {
    job_id = Number(b.job_id);
    if (!Number.isInteger(job_id) || job_id < 1) throw new BadRequestException('job_id is invalid');
  }
  const name = reqText(b.name, 'name', 100);
  const phone = typeof b.phone === 'string' ? b.phone.replace(/[\s.\-()]/g, '') : '';
  if (!/^\+?\d{8,15}$/.test(phone)) throw new BadRequestException('phone is invalid');
  const email = optText(b.email, 'email', 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('email is invalid');
  const message = reqText(b.message, 'message', 2000);
  const experience = optText(b.experience, 'experience', 500);
  return { honeypot: false, app: { job_id, name, phone, email, message, experience } };
}

/** Tiny in-memory sliding-window limiter (per key). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(now); this.hits.set(key, recent);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    return true;
  }
}
