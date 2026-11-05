import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "reviews" feature. Add controllers/providers here (this file and src/reviews/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class ReviewsModule {}
