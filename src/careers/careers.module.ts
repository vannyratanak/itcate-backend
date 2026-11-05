import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "careers" feature. Add controllers/providers here (this file and src/careers/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class CareersModule {}
