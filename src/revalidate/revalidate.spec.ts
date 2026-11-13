import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevalidateInterceptor } from './revalidate.interceptor';
import { RevalidateService } from './revalidate.service';

const ctx = (req: any) => ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) }) as any;
const run = (svc: RevalidateService, req: any) =>
  new Promise<void>((resolve) => new RevalidateInterceptor(svc).intercept(ctx(req), { handle: () => of(1) }).subscribe({ complete: () => resolve() }));

describe('RevalidateService', () => {
  beforeEach(() => { vi.useFakeTimers(); process.env.REVALIDATE_URL = 'http://site/api/revalidate'; process.env.REVALIDATE_SECRET = 's3cret'; });
  afterEach(() => { vi.useRealTimers(); delete process.env.REVALIDATE_URL; delete process.env.REVALIDATE_SECRET; });

  it('coalesces a burst of notifications into one call with the secret', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const svc = new RevalidateService(post, 400);
    svc.notify(); svc.notify(); svc.notify();
    expect(post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(450);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('http://site/api/revalidate', 's3cret');
    svc.notify();
    await vi.advanceTimersByTimeAsync(450);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the URL or secret is not configured', async () => {
    delete process.env.REVALIDATE_SECRET;
    const post = vi.fn();
    const svc = new RevalidateService(post, 10);
    svc.notify();
    await vi.advanceTimersByTimeAsync(50);
    expect(post).not.toHaveBeenCalled();
  });

  it('swallows a failing webhook (never breaks the admin request)', async () => {
    const svc = new RevalidateService(vi.fn().mockRejectedValue(new Error('down')), 10);
    svc.notify();
    await expect(vi.advanceTimersByTimeAsync(50)).resolves.not.toThrow();
  });
});

describe('RevalidateInterceptor', () => {
  const mk = () => { const notify = vi.fn(); return { svc: { notify } as unknown as RevalidateService, notify }; };

  it('notifies after a signed-in admin changes content', async () => {
    const { svc, notify } = mk();
    await run(svc, { method: 'PATCH', originalUrl: '/menu/3', user: { username: 'a' } });
    await run(svc, { method: 'DELETE', originalUrl: '/api/offers/2?x=1', user: { username: 'a' } });
    expect(notify).toHaveBeenCalledTimes(2);
  });
  it('ignores reads, public form posts, and non-content admin actions', async () => {
    const { svc, notify } = mk();
    await run(svc, { method: 'GET', originalUrl: '/menu', user: { username: 'a' } });
    await run(svc, { method: 'POST', originalUrl: '/reservations' }); // public: no req.user
    await run(svc, { method: 'POST', originalUrl: '/auth/login', user: { username: 'a' } });
    await run(svc, { method: 'POST', originalUrl: '/staff', user: { username: 'a' } });
    expect(notify).not.toHaveBeenCalled();
  });
});
