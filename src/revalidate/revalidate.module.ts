import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RevalidateInterceptor } from './revalidate.interceptor';
import { RevalidateService } from './revalidate.service';

@Module({
  providers: [
    { provide: RevalidateService, useFactory: () => new RevalidateService() },
    { provide: APP_INTERCEPTOR, useClass: RevalidateInterceptor },
  ],
})
export class RevalidateModule {}
