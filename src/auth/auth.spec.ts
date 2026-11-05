import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthStateService } from './auth-state.service';
import { hashPassword, passwordProblem, verifyPassword } from './password';
import { authorize, normalizePath, normalizeRole, Role } from './roles';

describe('password hashing', () => {
  it('hashes with salt, verifies, and rejects wrong/malformed', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).toMatch(/^scrypt\$16384\$[^$]+\$[^$]+$/);
    expect(a).not.toBe(b); // random salt
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('correct horse batterz', a)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$1$a$b')).toBe(false); // N too small
  });
  it('enforces the password policy', () => {
    expect(passwordProblem('short')).toMatch(/at least 10/);
    expect(passwordProblem(undefined)).toMatch(/required/);
    expect(passwordProblem('x'.repeat(201))).toMatch(/at most/);
    expect(passwordProblem('long enough pw')).toBeNull();
  });
});

describe('role matrix', () => {
  const M = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
  const allowed = (role: Role, path: string) => M.filter((m) => authorize(role, m, path));

  it('owner can do everything', () => {
    for (const p of ['/menu', '/staff', '/staff/3/reset-password', '/activity', '/surveys/1']) expect(allowed('owner', p)).toEqual(M);
  });
  it('manager can do everything except /staff* and /activity*', () => {
    for (const p of ['/menu', '/shop', '/surveys/1', '/pages/home']) expect(allowed('manager', p)).toEqual(M);
    for (const p of ['/staff', '/staff/1', '/activity', '/activity/actors']) expect(allowed('manager', p)).toEqual([]);
  });
  it('viewer is read-only and never sees /staff* or /activity*', () => {
    for (const p of ['/menu', '/surveys', '/shop']) expect(allowed('viewer', p)).toEqual(['GET']);
    for (const p of ['/staff', '/activity']) expect(allowed('viewer', p)).toEqual([]);
  });
  it('every role can use /auth/* (me, change-password)', () => {
    for (const r of ['owner', 'manager', 'viewer'] as Role[]) {
      expect(authorize(r, 'GET', '/auth/me')).toBe(true);
      expect(authorize(r, 'POST', '/auth/change-password')).toBe(true);
    }
  });
  it('cannot dodge the restriction with case, slashes, query or encoding', () => {
    for (const p of ['/STAFF', '//staff', '/staff/', '/Staff?x=1', '/%73taff', '/staff/../staff', '/ACTIVITY/']) {
      expect(authorize('manager', 'GET', p), p).toBe(false);
      expect(authorize('viewer', 'GET', p), p).toBe(false);
    }
    expect(normalizePath('//Staff/?a=b')).toBe('/staff');
  });
  it('treats old "admin" tokens as owner and rejects unknown roles', () => {
    expect(normalizeRole('admin')).toBe('owner');
    expect(normalizeRole('owner')).toBe('owner');
    expect(normalizeRole('root')).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });
});

describe('AdminGuard', () => {
  const ctx = (headers: Record<string, string>, method = 'GET', url = '/menu') => {
    const req: any = { headers, method, originalUrl: url };
    return { req, context: { switchToHttp: () => ({ getRequest: () => req }) } as any };
  };
  const make = (payload: any | Error, users: Record<number, any> = {}) => {
    const jwt: any = { verifyAsync: async () => { if (payload instanceof Error) throw payload; return payload; } };
    const record = vi.fn();
    const state = new AuthStateService({ adminUser: { findUnique: async ({ where }: any) => users[where.id] ?? null } } as any);
    state.record = record;
    return { guard: new AdminGuard(jwt, state), record, state };
  };

  it('rejects a missing, malformed or invalid token (401)', async () => {
    const { guard } = make(new Error('bad'));
    await expect(guard.canActivate(ctx({}).context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ctx({ authorization: 'Basic abc' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ctx({ authorization: 'Bearer abc' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('old tokens (role "admin", no uid) still work as owner everywhere', async () => {
    const { guard } = make({ sub: 'admin', role: 'admin' });
    const c = ctx({ authorization: 'Bearer t' }, 'DELETE', '/staff/1');
    expect(await guard.canActivate(c.context)).toBe(true);
    expect(c.req.user).toMatchObject({ username: 'admin', role: 'owner', bootstrap: true });
  });

  it('rejects unknown roles', async () => {
    const { guard } = make({ sub: 'x', role: 'root' });
    await expect(guard.canActivate(ctx({ authorization: 'Bearer t' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('staff tokens: viewer can GET but not write; denial is logged and 403', async () => {
    const hash = 'scrypt$16384$s$h';
    const user = { id: 7, username: 'vi', password_hash: hash, role: 'viewer', active: true };
    const { guard, record } = make({ sub: 'vi', role: 'viewer', uid: 7, pv: AuthStateService.pv(hash) }, { 7: user });
    expect(await guard.canActivate(ctx({ authorization: 'Bearer t' }, 'GET', '/menu/all').context)).toBe(true);
    await expect(guard.canActivate(ctx({ authorization: 'Bearer t' }, 'POST', '/menu').context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ actor: 'vi', status: 403 }));
  });

  it('uses the role from the database, not the token', async () => {
    const hash = 'scrypt$16384$s$h';
    const { guard } = make({ sub: 'm', role: 'owner', uid: 3, pv: AuthStateService.pv(hash) }, { 3: { id: 3, username: 'm', password_hash: hash, role: 'manager', active: true } });
    await expect(guard.canActivate(ctx({ authorization: 'Bearer t' }, 'GET', '/staff').context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects deactivated users, deleted users and tokens from before a password change', async () => {
    const hash = 'scrypt$16384$s$h';
    const base = { id: 9, username: 'u', password_hash: hash, role: 'manager', active: true };
    const tok = { sub: 'u', role: 'manager', uid: 9, pv: AuthStateService.pv(hash) };
    await expect(make(tok, { 9: { ...base, active: false } }).guard.canActivate(ctx({ authorization: 'Bearer t' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(make(tok, {}).guard.canActivate(ctx({ authorization: 'Bearer t' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(make({ ...tok, pv: 'old-password' }, { 9: base }).guard.canActivate(ctx({ authorization: 'Bearer t' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
