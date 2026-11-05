import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "staff" feature. Add controllers/providers here (this file and src/staff/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class StaffModule {}
