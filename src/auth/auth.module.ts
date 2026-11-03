import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AdminGuard } from './admin.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '1d' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AdminGuard],
  exports: [JwtModule, AdminGuard],
})
export class AuthModule {}
