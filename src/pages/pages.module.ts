import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({ controllers: [PagesController], providers: [PagesService, PrismaService] })
export class PagesModule {}
