import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

// Owned by the "reservations" feature. Add controllers/providers here (this file and src/reservations/ only).
@Module({ controllers: [ReservationsController], providers: [ReservationsService] })
export class ReservationsModule {}
