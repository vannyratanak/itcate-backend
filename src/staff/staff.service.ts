import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthStateService, Principal } from '../auth/auth-state.service';
import { hashPassword, passwordProblem } from '../auth/password';
import { ROLES } from '../auth/roles';
import { PrismaService } from '../prisma.service';

// Never select password_hash for anything returned to a client.
const PUBLIC = { id: true, username: true, role: true, active: true, created_at: true, last_login_at: true } as const;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService, private readonly state: AuthStateService) {}

  // Defence in depth: the guard's role matrix already restricts /staff* to owners.
  private owner(me: Principal) {
    if (me.role !== 'owner') throw new ForbiddenException('You do not have permission to do this');
  }

  async list(me: Principal) {
    this.owner(me);
    const users = await this.prisma.adminUser.findMany({ orderBy: { id: 'asc' }, select: PUBLIC });
    return { users, bootstrap: process.env.ADMIN_USER ?? null };
  }

  async create(me: Principal, dto: { username?: string; password?: string; role?: string }) {
    this.owner(me);
    const username = typeof dto?.username === 'string' ? dto.username.trim().toLowerCase() : '';
    if (!USERNAME.test(username)) throw new BadRequestException('username must be 3-32 characters: letters, numbers, dot, dash or underscore');
    if (!ROLES.includes(dto?.role as any)) throw new BadRequestException('role must be owner, manager or viewer');
    const problem = passwordProblem(dto?.password);
    if (problem) throw new BadRequestException(problem);
    if (process.env.ADMIN_USER && username === process.env.ADMIN_USER.toLowerCase()) throw new ConflictException('That username is reserved for the server login');
    if (await this.prisma.adminUser.findUnique({ where: { username } })) throw new ConflictException('That username is already taken');
    return this.prisma.adminUser.create({
      data: { username, role: dto.role as string, password_hash: await hashPassword(dto.password as string) },
      select: PUBLIC,
    });
  }

  async update(me: Principal, id: number, dto: { role?: string; active?: boolean }) {
    this.owner(me);
    const user = await this.prisma.adminUser.findUnique({ where: { id }, select: PUBLIC });
    if (!user) throw new NotFoundException('user not found');
    const data: { role?: string; active?: boolean } = {};
    if (dto?.role !== undefined) {
      if (!ROLES.includes(dto.role as any)) throw new BadRequestException('role must be owner, manager or viewer');
      data.role = dto.role;
    }
    if (dto?.active !== undefined) {
      if (typeof dto.active !== 'boolean') throw new BadRequestException('active must be true or false');
      data.active = dto.active;
    }
    if (id === me.uid && ((data.role && data.role !== 'owner') || data.active === false)) {
      throw new BadRequestException("You can't demote or deactivate your own account");
    }
    const updated = await this.prisma.adminUser.update({ where: { id }, data, select: PUBLIC });
    this.state.invalidate(id); // takes effect on the user's very next request
    return updated;
  }

  async resetPassword(me: Principal, id: number, dto: { password?: string }) {
    this.owner(me);
    const problem = passwordProblem(dto?.password);
    if (problem) throw new BadRequestException(problem);
    if (!(await this.prisma.adminUser.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('user not found');
    await this.prisma.adminUser.update({ where: { id }, data: { password_hash: await hashPassword(dto.password as string) } });
    this.state.invalidate(id); // the password version changes, so the user's old tokens stop working
    return { ok: true };
  }

  async remove(me: Principal, id: number) {
    this.owner(me);
    if (id === me.uid) throw new BadRequestException("You can't delete your own account");
    if (!(await this.prisma.adminUser.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('user not found');
    await this.prisma.adminUser.delete({ where: { id } });
    this.state.invalidate(id);
    return { deleted: id };
  }
}
