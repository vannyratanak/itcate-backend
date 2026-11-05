import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "offers" feature. Add controllers/providers here (this file and src/offers/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class OffersModule {}
