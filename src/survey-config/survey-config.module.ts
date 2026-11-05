import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SurveyConfigController } from './survey-config.controller';
import { SurveyConfigService } from './survey-config.service';

@Module({ controllers: [SurveyConfigController], providers: [SurveyConfigService] })
export class SurveyConfigModule {}
