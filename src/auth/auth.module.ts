import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './admin.guard';
import { AuthStateService } from './auth-state.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '1d' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AdminGuard, AuthStateService, PrismaService],
  exports: [JwtModule, AdminGuard, AuthStateService],
})
export class AuthModule {}
