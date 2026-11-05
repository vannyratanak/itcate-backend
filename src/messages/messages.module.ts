import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Owned by the "messages" feature. Add controllers/providers here (this file and src/messages/ only).
@Module({ controllers: [], providers: [PrismaService] })
export class MessagesModule {}
