import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.service.js';
import { configureApp } from './setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfig);
  const levels = ['error', 'warn', 'log', 'debug', 'verbose'] as const;
  const json =
    (config.get('LOG_FORMAT') ?? (config.get('NODE_ENV') === 'production' ? 'json' : 'pretty')) ===
    'json';
  app.useLogger(
    new ConsoleLogger({
      json,
      colors: !json,
      logLevels: levels.slice(0, levels.indexOf(config.get('LOG_LEVEL')) + 1),
    }),
  );

  configureApp(app, config);
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED') ?? config.get('NODE_ENV') !== 'production') {
    const document = new DocumentBuilder()
      .setTitle('StudyThinker API')
      .setDescription(
        'Application API for StudyThinker. Success responses are `{ data, meta? }`; errors are `{ error: { code, message, details?, requestId? } }`.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, document), {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }

  await app.listen(config.get('PORT'));
}
await bootstrap();
