import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "faq" feature. Add controllers/providers here (this file and src/faq/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class FaqModule {}
