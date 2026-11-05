import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

// Owned by the "gallery" feature.
@Module({ controllers: [GalleryController], providers: [GalleryService, PrismaService] })
export class GalleryModule {}
