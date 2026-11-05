import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/** Protects admin endpoints with the `x-admin-key` header (value = ADMIN_API_KEY). Fails closed if unset/weak. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected || expected.length < 24) throw new ServiceUnavailableException('admin API is not configured');
    const got = context.switchToHttp().getRequest().headers['x-admin-key'];
    const digest = (s: string) => createHash('sha256').update(s).digest();
    if (typeof got !== 'string' || !timingSafeEqual(digest(got), digest(expected))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
