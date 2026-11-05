import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

// Owned by the "staff" feature: admin accounts and roles (owner only).
@Module({ controllers: [StaffController], providers: [StaffService, PrismaService] })
export class StaffModule {}
