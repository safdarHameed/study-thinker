import { StandardSchemaValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from './config/app-config.service.js';

/** HTTP setup shared by the server and the end-to-end tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig) {
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.webOrigins,
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
