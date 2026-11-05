import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "settings" feature. Add controllers/providers here (this file and src/settings/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class SettingsModule {}
