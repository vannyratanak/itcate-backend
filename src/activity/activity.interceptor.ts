import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { normalizePath } from '../auth/roles';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SAFE_NAME = /^[A-Za-z0-9._-]{1,32}$/; // only log a typed username if it looks like one (people sometimes type a password there)

/**
 * Logs every authenticated mutating request, every sign-in and every failed sign-in to ActivityLog.
 * Records WHO / WHAT (method + path without query) / RESULT (status). Never request bodies, never passwords or tokens.
 * (Denied requests are logged by the guard itself, because guards run before interceptors.)
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private readonly state: AuthStateService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const method: string = req.method;
    if (!MUTATING.has(method)) return next.handle();
    const path = normalizePath(req.originalUrl ?? req.url ?? '');
    const isLogin = method === 'POST' && path === '/auth/login';

    const log = (status: number, loginUser?: string) => {
      if (isLogin) {
        const typed = typeof req.body?.username === 'string' && SAFE_NAME.test(req.body.username) ? req.body.username : null;
        const ok = status < 400;
        this.state.record({
          actor: ok ? loginUser ?? typed ?? '(unknown)' : typed ?? '(invalid username)',
          role: null, method, path, status, summary: ok ? 'signed in' : 'failed sign-in',
        });
      } else if (req.user) {
        this.state.record({ actor: req.user.username, role: req.user.role, method, path, status, summary: `${method} ${path}` });
      }
    };

    return next.handle().pipe(
      tap({
        next: (body: any) => {
          const code = res.statusCode && res.statusCode !== 200 ? res.statusCode : method === 'POST' ? 201 : 200;
          log(code, isLogin && typeof body?.username === 'string' ? body.username : undefined);
        },
        error: (e) => log(e instanceof HttpException ? e.getStatus() : 500),
      }),
    );
  }
}
