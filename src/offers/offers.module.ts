import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({ controllers: [OffersController], providers: [OffersService, PrismaService] })
export class OffersModule {}
