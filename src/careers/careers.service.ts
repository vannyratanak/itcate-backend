import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RateLimiter, parseApplication, parseJob } from './careers.validation';

@Injectable()
export class CareersService {
  constructor(private readonly prisma: PrismaService) {}
  private limiter = new RateLimiter(5, 60 * 60 * 1000); // 5 applications / hour / IP

  private order = [{ sort_order: 'asc' as const }, { id: 'asc' as const }];

  listActive() {
    return this.prisma.job.findMany({ where: { active: true }, orderBy: this.order });
  }
  listAll() {
    return this.prisma.job.findMany({ orderBy: this.order });
  }

  async create(body: unknown) {
    const data = parseJob(body) as any;
    const last = await this.prisma.job.aggregate({ _max: { sort_order: true } });
    return this.prisma.job.create({ data: { ...data, sort_order: (last._max.sort_order ?? 0) + 1 } });
  }

  async update(id: number, body: unknown) {
    await this.mustExist(id);
    const data = parseJob(body, true);
    if (!Object.keys(data).length) throw new BadRequestException('nothing to update');
    return this.prisma.job.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.mustExist(id);
    await this.prisma.job.delete({ where: { id } });
    return { deleted: id };
  }

  async reorder(ids: unknown) {
    const existing = (await this.prisma.job.findMany({ select: { id: true } })).map((j) => j.id);
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length || !ids.every((i) => existing.includes(i))) {
      throw new BadRequestException('ids must list every job exactly once');
    }
    await this.prisma.$transaction(ids.map((id: number, i) => this.prisma.job.update({ where: { id }, data: { sort_order: i + 1 } })));
    return { ids };
  }

  async apply(body: unknown, ip: string) {
    const { honeypot, app } = parseApplication(body);
    if (honeypot) return { ok: true }; // bots get a fake success and nothing is stored
    if (!this.limiter.allow(ip || 'unknown')) {
      throw new HttpException('Too many applications, please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    let jobTitle: string | null = null;
    if (app!.job_id !== null) {
      const job = await this.prisma.job.findUnique({ where: { id: app!.job_id } });
      if (!job || !job.active) throw new BadRequestException('this position is no longer open');
      jobTitle = job.title_en;
    }
    await this.prisma.contactMessage.create({
      data: {
        kind: 'career',
        name: app!.name,
        email: app!.email,
        phone: app!.phone,
        subject: jobTitle ? `Application: ${jobTitle}` : 'Application: general',
        message: app!.message,
        data: { job_id: app!.job_id, job_title: jobTitle, experience: app!.experience },
      },
    });
    return { ok: true };
  }

  private async mustExist(id: number) {
    if (!(await this.prisma.job.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException(`job ${id} not found`);
  }
}
