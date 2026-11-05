import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class SurveysService {
  constructor(private prisma: PrismaClient) { }
  async create(dto: CreateSurveyDto) {
    const name = typeof dto?.name === 'string' ? dto.name.trim() : '';
    const phoneNumber = typeof dto?.phoneNumber === 'string' ? dto.phoneNumber.trim() : '';
    if (!name || name.length > 100) throw new BadRequestException('name is required (max 100 characters)');
    if (!/^\+?\d{8,15}$/.test(phoneNumber)) throw new BadRequestException('phoneNumber is invalid');
    if (typeof dto.usedToVisit !== 'boolean') throw new BadRequestException('usedToVisit must be a boolean');
    const dateVisit = dto.dateVisit ? new Date(dto.dateVisit) : new Date();
    if (isNaN(dateVisit.getTime())) throw new BadRequestException('dateVisit is invalid');
    const message = typeof dto.message === 'string' ? dto.message.trim().slice(0, 2000) : '';
    if (!Array.isArray(dto.answers) || dto.answers.length === 0) {
      throw new BadRequestException('answers are required');
    }

    // Every answer must reference a real question, and an option that belongs to that question's group.
    const questions = await this.prisma.menuQuestion.findMany({
      include: { group_option: { include: { options: true } } },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const seen = new Set<number>();
    for (const a of dto.answers) {
      const q = byId.get(a?.menu_id);
      if (!q || seen.has(q.id)) throw new BadRequestException(`invalid question ${a?.menu_id}`);
      if (!q.group_option.options.some((o) => o.option_id === a.option_id)) {
        throw new BadRequestException(`invalid option ${a.option_id} for question ${q.id}`);
      }
      seen.add(q.id);
    }
    if (seen.size !== questions.length) throw new BadRequestException('every question must be answered');

    const survayer = await this.prisma.survayer.create({
      data: {
        name,
        phoneNumber,
        dateVisit,
        usedToVisit: dto.usedToVisit,
        survayOption: {
          create: dto.answers.map((a) => ({ menu_id: a.menu_id, option_id: a.option_id })),
        },
        ...(message ? { survayMessage: { create: { message } } } : {}),
      },
    });
    return { id: survayer.id };
  }
  async getFields() {

    let bigOption = await this.prisma.groupOption.findMany({
      orderBy:{
        id:"asc",
      },
      include:{
        menuOption:true,
        options:{
          include:{
            option:true
          }
        }
      }
    });
    let newSerialize =bigOption.map(value=>{
      let options=value.options.map(value=>value.option);
      return {
        ...value,
        options,
      }
    })
    return newSerialize;
  } 
  async findAll(page = 1, limit = 20) {
    const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
    const pg = Math.max(Math.trunc(page) || 1, 1);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.survayer.count(),
      this.prisma.survayer.findMany({
        orderBy: { id: 'desc' },
        skip: (pg - 1) * take,
        take,
        select: { id: true, name: true, phoneNumber: true, dateVisit: true, usedToVisit: true, created_at: true },
      }),
    ]);
    return { items, total, page: pg, limit: take, pages: Math.ceil(total / take) };
  }

  async findOne(id: number) {
    const s = await this.prisma.survayer.findUnique({
      where: { id },
      include: {
        survayMessage: { select: { message: true, created_at: true } },
        survayOption: { include: { menuQuestion: true, option: true }, orderBy: { menu_id: 'asc' } },
      },
    });
    if (!s) throw new NotFoundException(`survey ${id} not found`);
    const { survayOption, survayMessage, ...rest } = s;
    return {
      ...rest,
      message: survayMessage[0]?.message ?? null,
      answers: survayOption.map((a) => ({
        menu_id: a.menu_id,
        question: { name_en: a.menuQuestion.name_en, name_kh: a.menuQuestion.name_kh },
        option_id: a.option_id,
        answer: { name_en: a.option.name_en, name_kh: a.option.name_kh },
      })),
    };
  }

  /** Totals and, per question, how many picked each option. */
  async stats() {
    const [total, usedToVisit, grouped, questions, options] = await Promise.all([
      this.prisma.survayer.count(),
      this.prisma.survayer.count({ where: { usedToVisit: true } }),
      this.prisma.survayerOption.groupBy({ by: ['menu_id', 'option_id'], _count: { _all: true } }),
      this.prisma.menuQuestion.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.option.findMany(),
    ]);
    const optName = new Map(options.map((o) => [o.id, o.name_en ?? o.name_kh ?? String(o.id)]));
    return {
      total,
      usedToVisit,
      newVisitors: total - usedToVisit,
      questions: questions.map((q) => ({
        menu_id: q.id,
        name_en: q.name_en,
        name_kh: q.name_kh,
        answers: grouped
          .filter((g) => g.menu_id === q.id)
          .map((g) => ({ option_id: g.option_id, name: optName.get(g.option_id), count: g._count._all }))
          .sort((a, b) => a.option_id - b.option_id),
      })),
    };
  }

  async remove(id: number) {
    const exists = await this.prisma.survayer.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`survey ${id} not found`);
    await this.prisma.$transaction([
      this.prisma.survayerOption.deleteMany({ where: { survayer_id: id } }),
      this.prisma.survayerMessage.deleteMany({ where: { survay_id: id } }),
      this.prisma.survayer.delete({ where: { id } }),
    ]);
    return { deleted: id };
  }
}
