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
import { SettingsModule } from './settings/settings.module';
import { ReservationsModule } from './reservations/reservations.module';
import { MessagesModule } from './messages/messages.module';
import { CareersModule } from './careers/careers.module';
import { GalleryModule } from './gallery/gallery.module';
import { OffersModule } from './offers/offers.module';
import { FaqModule } from './faq/faq.module';
import { BlogModule } from './blog/blog.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StaffModule } from './staff/staff.module';
import { ActivityModule } from './activity/activity.module';
import { PrismaService } from './prisma.service';


@Module({
  imports: [ConfigModule.forRoot({
    envFilePath: [".env", ".env.development", ".env.development.local"]
  }), UsersModule, SurveysModule, AuthModule, ShopModule, MenuModule, UploadsModule, SurveyConfigModule, PagesModule, SettingsModule, ReservationsModule, MessagesModule, CareersModule, GalleryModule, OffersModule, FaqModule, BlogModule, AnalyticsModule, StaffModule, ActivityModule ],
  controllers: [AppController],
  providers: [AppService,PrismaService],

})
export class AppModule { }
