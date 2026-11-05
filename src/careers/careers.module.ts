import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';

// Owned by the "careers" feature. (AuthModule is global, so AdminGuard works without importing anything.)
@Module({ controllers: [CareersController], providers: [CareersService] })
export class CareersModule {}
