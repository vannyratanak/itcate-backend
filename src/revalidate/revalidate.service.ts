import { Injectable, Logger } from '@nestjs/common';

type Poster = (url: string, secret: string) => Promise<void>;

const defaultPost: Poster = async (url, secret) => {
  const res = await fetch(url, { method: 'POST', headers: { 'x-revalidate-secret': secret }, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`frontend answered ${res.status}`);
};

/**
 * Tells the public website "content changed, drop your cached pages" (POST REVALIDATE_URL with x-revalidate-secret).
 * - Does nothing unless BOTH REVALIDATE_URL and REVALIDATE_SECRET are set, so local/dev setups are unaffected.
 * - Bursts of saves are coalesced into ONE call (trailing debounce), so editing 10 menu items doesn't send 10 webhooks.
 * - Never throws and never blocks the admin's request: a failure is only logged, and the site's own 60 s safety-net
 *   revalidation still brings it up to date.
 */
@Injectable()
export class RevalidateService {
  private readonly log = new Logger('Revalidate');
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly post: Poster = defaultPost, private readonly delayMs = 400) {}

  private get target() {
    const url = process.env.REVALIDATE_URL?.trim();
    const secret = process.env.REVALIDATE_SECRET?.trim();
    return url && secret ? { url, secret } : null;
  }

  notify(): void {
    if (!this.target || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
    this.timer.unref?.();
  }

  async flush(): Promise<void> {
    const t = this.target;
    if (!t) return;
    try {
      await this.post(t.url, t.secret);
    } catch (e) {
      this.log.warn(`Could not refresh the website cache: ${(e as Error).message}`);
    }
  }
}
