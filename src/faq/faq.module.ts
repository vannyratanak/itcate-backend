import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';

// Owned by the "faq" feature.
@Module({ controllers: [FaqController], providers: [FaqService] })
export class FaqModule {}
