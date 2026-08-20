import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';

const DEFAULT_GRAPHQL_BODY_LIMIT_MB = 15;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Increase JSON body-parser limit so Base64-encoded file attachments
  // (Phase H) can pass through the GraphQL endpoint.
  // AI_GRAPHQL_BODY_LIMIT_MB must be larger than AI_ATTACHMENT_MAX_SIZE_MB
  // due to ~33% Base64 expansion overhead plus JSON envelope.
  const bodyLimitMb =
    configService.get<number>('AI_GRAPHQL_BODY_LIMIT_MB') ??
    DEFAULT_GRAPHQL_BODY_LIMIT_MB;
  app.use(express.json({ limit: `${bodyLimitMb}mb` }));
  app.use(express.urlencoded({ extended: true, limit: `${bodyLimitMb}mb` }));

  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  const frontendUrl = configService
    .getOrThrow<string>('FRONTEND_URL')
    .replace(/\/$/, '');
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}/graphql`);
}

bootstrap();
