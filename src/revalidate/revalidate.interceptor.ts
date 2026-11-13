import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { RevalidateService } from './revalidate.service';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
// Admin actions that never change what the public site shows.
const IGNORE = [/^\/auth(\/|$)/, /^\/activity(\/|$)/, /^\/users(\/|$)/, /^\/staff(\/|$)/];

/** After a SUCCESSFUL change made by a signed-in admin, tell the website to refresh its cache. */
@Injectable()
export class RevalidateInterceptor implements NestInterceptor {
  constructor(private readonly revalidate: RevalidateService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    if (!MUTATING.has(req.method)) return next.handle();
    const path = String(req.originalUrl ?? req.url ?? '').split('?')[0].replace(/^\/api(?=\/)/, '');
    if (IGNORE.some((re) => re.test(path))) return next.handle();
    return next.handle().pipe(
      tap({
        next: () => {
          if (req.user) this.revalidate.notify(); // req.user is set by the auth guard, so public form posts don't trigger it
        },
      }),
    );
  }
}
