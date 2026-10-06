import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';
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
  findAll() {
    return `This action returns all surveys`;
  }

  findOne(id: number) {
    return `This action returns a #${id} survey`;
  }

  update(id: number, updateSurveyDto: UpdateSurveyDto) {
    return `This action updates a #${id} survey`;
  }

  remove(id: number) {
    return `This action removes a #${id} survey`;
  }
}
