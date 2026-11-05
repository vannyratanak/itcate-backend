import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "reservations" feature. Add controllers/providers here (this file and src/reservations/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class ReservationsModule {}
