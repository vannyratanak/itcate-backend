import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({ controllers: [MessagesController], providers: [MessagesService, PrismaService] })
export class MessagesModule {}
