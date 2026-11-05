import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthStateService } from './auth-state.service';
import { authorize } from './roles';

/**
 * Authenticates (valid, unexpired token; DB user still active) AND authorizes by role (see roles.ts).
 * Every admin controller already uses this guard, so the role matrix applies to the whole API.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly state: AuthStateService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const [scheme, token] = (req.headers['authorization'] ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Access token required');
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const principal = await this.state.resolve(payload);
    req.user = principal;
    const path = req.originalUrl ?? req.url ?? '';
    if (!authorize(principal.role, req.method, path)) {
      this.state.record({ actor: principal.username, role: principal.role, method: req.method, path, status: 403, summary: 'denied: not allowed for this role' });
      throw new ForbiddenException('You do not have permission to do this');
    }
    return true;
  }
}
