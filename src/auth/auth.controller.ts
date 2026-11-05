import { BadRequestException, Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma.service';
import { AdminGuard } from './admin.guard';
import { AuthStateService, Principal } from './auth-state.service';
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from './password';
import { normalizeRole, Role } from './roles';

// Compare secrets without leaking length or prefix through timing.
const digest = (s: string) => createHash('sha256').update(s).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

@Controller('auth')
export class AuthController {
  constructor(private readonly jwt: JwtService, private readonly state: AuthStateService, private readonly prisma: PrismaService) {}

  private sign(p: { username: string; role: Role; uid?: number; hash?: string }) {
    const payload: Record<string, unknown> = { sub: p.username, role: p.role };
    if (p.uid !== undefined && p.hash) Object.assign(payload, { uid: p.uid, pv: AuthStateService.pv(p.hash) });
    return this.jwt.signAsync(payload);
  }

  @Post('login')
  async login(@Body() body: { username?: string; password?: string }) {
    if (!process.env.JWT_SECRET) throw new UnauthorizedException('Admin login is not configured on the server');
    const username = typeof body?.username === 'string' ? body.username.trim().slice(0, 100) : '';
    const password = typeof body?.password === 'string' ? body.password.slice(0, 300) : '';
    const fail = () => new UnauthorizedException('Invalid username or password'); // same message for every failure

    // 1) Staff accounts. ALWAYS verify one scrypt hash (a dummy one for unknown/inactive users) so timing doesn't reveal which usernames exist.
    const row = username ? await this.state.findByUsername(username.toLowerCase()) : null;
    const usable = !!row && row.active;
    const passwordOk = await verifyPassword(password, usable ? row!.password_hash : await dummyHash());
    if (usable && passwordOk) {
      const role = normalizeRole(row!.role);
      if (role) {
        await this.prisma.adminUser.update({ where: { id: row!.id }, data: { last_login_at: new Date() } });
        return { token: await this.sign({ username: row!.username, role, uid: row!.id, hash: row!.password_hash }), username: row!.username, role };
      }
    }

    // 2) Bootstrap owner from .env (ADMIN_USER / ADMIN_PASSWORD).
    const envUser = process.env.ADMIN_USER;
    const envPass = process.env.ADMIN_PASSWORD;
    const userMatch = !!envUser && safeEqual(username, envUser);
    const passMatch = !!envPass && safeEqual(password, envPass);
    if (userMatch && passMatch) return { token: await this.sign({ username: envUser!, role: 'owner' }), username: envUser, role: 'owner' as Role };
    throw fail();
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@Req() req: { user: Principal }) {
    const { username, role, uid, bootstrap } = req.user;
    return { ok: true, username, role, id: uid ?? null, bootstrap };
  }

  /** Any signed-in staff member can change their own password. Returns a fresh token (old ones stop working). */
  @Post('change-password')
  @UseGuards(AdminGuard)
  async changePassword(@Req() req: { user: Principal }, @Body() body: { current_password?: string; new_password?: string }) {
    const me = req.user;
    if (me.uid === undefined) throw new BadRequestException("This login's password is set in the server's .env file and can't be changed here.");
    const current = typeof body?.current_password === 'string' ? body.current_password : '';
    const next = body?.new_password;
    const problem = passwordProblem(next);
    if (problem) throw new BadRequestException(problem);
    const user = await this.prisma.adminUser.findUnique({ where: { id: me.uid } });
    if (!user || !(await verifyPassword(current, user.password_hash))) throw new BadRequestException('Current password is incorrect');
    if (current === next) throw new BadRequestException('Choose a different password from the current one');
    const hash = await hashPassword(next as string);
    await this.prisma.adminUser.update({ where: { id: user.id }, data: { password_hash: hash } });
    this.state.invalidate(user.id);
    return { ok: true, token: await this.sign({ username: user.username, role: me.role, uid: user.id, hash }) };
  }
}
