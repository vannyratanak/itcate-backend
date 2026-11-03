import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Page-builder saves carry the whole page, so /pages gets a bigger body limit than everything else.
  app.use('/pages', json({ limit: '5mb' }));
  app.use(json());
  app.use(urlencoded({ extended: true }));
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true });
  // Uploaded logos / menu photos, and the admin dashboard (static, talks to the API with a JWT).
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.useStaticAssets(join(process.cwd(), 'public', 'admin'), { prefix: '/admin' });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
