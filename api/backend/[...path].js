require('reflect-metadata');

const { ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');
const serverless = require('serverless-http');
const { AppModule } = require('../../fronti-backend/dist/app.module');
const {
  GlobalExceptionFilter,
} = require('../../fronti-backend/dist/common/filters/global-exception.filter');
const {
  AppLoggerService,
} = require('../../fronti-backend/dist/common/logging/app-logger.service');
const { normalizeValue } = require('../../fronti-backend/dist/common/normalize-text');

let cachedHandler = null;

async function createHandler() {
  const server = express();
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true, limit: '10mb' }));
  server.use((_req, res, next) => {
    res.setHeader('Content-Language', 'es-VE');
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalJson(normalizeValue(body));
    };
    next();
  });

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({
    origin: true,
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
  await app.init();

  return serverless(server);
}

function getHandler() {
  cachedHandler ||= createHandler();
  return cachedHandler;
}

function removeBackendPrefix(req) {
  const originalUrl = req.url || '/';
  req.url = originalUrl.replace(/^\/api\/backend(?=\/|$)/, '') || '/';
}

module.exports = async function handler(req, res) {
  removeBackendPrefix(req);
  const serverlessHandler = await getHandler();
  return serverlessHandler(req, res);
};
