import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "gallery" feature. Add controllers/providers here (this file and src/gallery/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class GalleryModule {}
