import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "activity" feature. Add controllers/providers here (this file and src/activity/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class ActivityModule {}
