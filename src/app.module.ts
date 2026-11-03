import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { SurveysModule } from './surveys/surveys.module';
import { AuthModule } from './auth/auth.module';
import { ShopModule } from './shop/shop.module';
import { MenuModule } from './menu/menu.module';
import { UploadsModule } from './uploads/uploads.module';
import { SurveyConfigModule } from './survey-config/survey-config.module';
import { PagesModule } from './pages/pages.module';
import { PrismaService } from './prisma.service';


@Module({
  imports: [ConfigModule.forRoot({
    envFilePath: [".env", ".env.development", ".env.development.local"]
  }), UsersModule, SurveysModule, AuthModule, ShopModule, MenuModule, UploadsModule, SurveyConfigModule, PagesModule ],
  controllers: [AppController],
  providers: [AppService,PrismaService],

})
export class AppModule { }
