import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { ActivityController } from './activity.controller';
import { ActivityInterceptor } from './activity.interceptor';

// Owned by the "activity" feature: the audit log (owner only) and the global interceptor that fills it.
@Module({
  controllers: [ActivityController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ActivityInterceptor }],
})
export class ActivityModule {}
