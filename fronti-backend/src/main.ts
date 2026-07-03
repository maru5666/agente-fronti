import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, Response, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLoggerService } from './common/logging/app-logger.service';
import { normalizeValue } from './common/normalize-text';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  app.use((_req, res: Response, next) => {
    res.setHeader('Content-Language', 'es-VE');
    const originalJson = res.json.bind(res);
    res.json = (body?: unknown) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalJson(normalizeValue(body));
    };
    next();
  });
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAnyOrigin = configuredOrigins?.includes('*');

  app.enableCors({
    origin: allowAnyOrigin
      ? true
      : configuredOrigins?.length
        ? configuredOrigins
      : [
          'http://localhost:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3002',
        ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(new AppLoggerService()));

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
