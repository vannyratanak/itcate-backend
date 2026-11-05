import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const ctx = (key?: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers: key === undefined ? {} : { 'x-admin-key': key } }) }) }) as any;
const KEY = 'k'.repeat(32);

describe('AdminGuard', () => {
  const old = process.env.ADMIN_API_KEY;
  afterEach(() => { process.env.ADMIN_API_KEY = old; });

  it('accepts the right key', () => {
    process.env.ADMIN_API_KEY = KEY;
    expect(new AdminGuard().canActivate(ctx(KEY))).toBe(true);
  });
  it('rejects a wrong or missing key', () => {
    process.env.ADMIN_API_KEY = KEY;
    expect(() => new AdminGuard().canActivate(ctx('nope'))).toThrow(UnauthorizedException);
    expect(() => new AdminGuard().canActivate(ctx())).toThrow(UnauthorizedException);
  });
  it('fails closed when no (or a weak) key is configured', () => {
    delete process.env.ADMIN_API_KEY;
    expect(() => new AdminGuard().canActivate(ctx(KEY))).toThrow(ServiceUnavailableException);
    process.env.ADMIN_API_KEY = 'short';
    expect(() => new AdminGuard().canActivate(ctx('short'))).toThrow(ServiceUnavailableException);
  });
});
