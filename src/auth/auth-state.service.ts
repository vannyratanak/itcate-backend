import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { normalizePath, normalizeRole, Role } from './roles';

export type Principal = { username: string; role: Role; uid?: number; bootstrap: boolean };
type UserRow = { id: number; username: string; password_hash: string; role: string; active: boolean };

export type ActivityEntry = { actor: string; role?: string | null; method: string; path: string; status: number; summary?: string | null };

const TTL_MS = 30_000;
const RETENTION_DAYS = 180;

/**
 * Global helper used by the guard, the login/staff controllers and the activity interceptor:
 *  - resolves a verified JWT payload to a principal (DB user must exist, be active, and match the password version),
 *  - caches user lookups for ~30 s (so deactivating someone takes effect within 30 s, or at once via invalidate()),
 *  - writes ActivityLog rows (never request bodies) and prunes old ones.
 */
@Injectable()
export class AuthStateService {
  constructor(private readonly prisma: PrismaService) {}
  private cache = new Map<number, { user: UserRow | null; at: number }>();

  /** Changes whenever the password changes, so old tokens die when a password is changed/reset. */
  static pv(passwordHash: string) {
    return createHash('sha256').update(passwordHash).digest('hex').slice(0, 12);
  }

  invalidate(id?: number) {
    if (id === undefined) this.cache.clear();
    else this.cache.delete(id);
  }

  async getUser(id: number): Promise<UserRow | null> {
    const hit = this.cache.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.user;
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, username: true, password_hash: true, role: true, active: true },
    });
    this.cache.set(id, { user, at: Date.now() });
    return user;
  }

  findByUsername(username: string) {
    return this.prisma.adminUser.findUnique({
      where: { username },
      select: { id: true, username: true, password_hash: true, role: true, active: true },
    });
  }

  /** Turns a verified JWT payload into who is calling. Throws 401 if that person may no longer sign in. */
  async resolve(payload: any): Promise<Principal> {
    if (payload && typeof payload.uid === 'number') {
      const user = await this.getUser(payload.uid);
      const role = normalizeRole(user?.role);
      if (!user || !user.active || !role || payload.pv !== AuthStateService.pv(user.password_hash)) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      return { username: user.username, role, uid: user.id, bootstrap: false };
    }
    // Bootstrap login from .env (and tokens issued before staff accounts existed, role "admin"): the owner.
    const role = normalizeRole(payload?.role);
    if (!role || typeof payload?.sub !== 'string') throw new UnauthorizedException('Invalid or expired token');
    return { username: payload.sub, role, bootstrap: true };
  }

  /** Fire-and-forget: logging must never break a request. */
  record(entry: ActivityEntry) {
    void this.write(entry).catch(() => undefined);
  }

  private async write(e: ActivityEntry) {
    await this.prisma.activityLog.create({
      data: {
        actor: e.actor.slice(0, 64),
        role: e.role ?? null,
        method: e.method.slice(0, 10),
        path: normalizePath(e.path).slice(0, 200),
        status: e.status,
        summary: e.summary ? e.summary.slice(0, 200) : null,
      },
    });
    if (Math.random() < 0.02) {
      await this.prisma.activityLog.deleteMany({ where: { created_at: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } } });
    }
  }
}
