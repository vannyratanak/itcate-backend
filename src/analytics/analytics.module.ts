import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

// Owned by the "analytics" feature. (AuthModule is global, so AdminGuard needs no import here.)
@Module({ controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
