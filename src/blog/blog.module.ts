import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "blog" feature. Add controllers/providers here (this file and src/blog/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class BlogModule {}
