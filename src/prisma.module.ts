import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

// ONE shared database client (and connection pool) for the whole app. Every module used to list PrismaService in its own
// providers, which created ~19 separate pools and could exhaust PostgreSQL's connection limit.
@Global()
@Module({
  providers: [PrismaService, { provide: PrismaClient, useExisting: PrismaService }],
  exports: [PrismaService, PrismaClient],
})
export class PrismaModule {}
