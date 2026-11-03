import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { AdminGuard } from './admin.guard';

// Compare without leaking length/prefix through timing.
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly jwt: JwtService) {}

  @Post('login')
  async login(@Body() body: { username?: string; password?: string }) {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASSWORD;
    if (!user || !pass || !process.env.JWT_SECRET) {
      throw new UnauthorizedException('Admin login is not configured on the server');
    }
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string'
      || !safeEqual(body.username, user) || !safeEqual(body.password, pass)) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return { token: await this.jwt.signAsync({ sub: user, role: 'admin' }), username: user };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me() {
    return { ok: true };
  }
}
