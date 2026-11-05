import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "analytics" feature. Add controllers/providers here (this file and src/analytics/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class AnalyticsModule {}
