import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({ controllers: [MenuController], providers: [MenuService] })
export class MenuModule {}
