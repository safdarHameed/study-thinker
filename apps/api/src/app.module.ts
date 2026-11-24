import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter.js';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';
import { requestLoggerMiddleware } from './common/http/request-logger.middleware.js';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor.js';
import { AppConfigModule } from './config/config.module.js';
import { AccountModule } from './modules/account/account.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { LearningsModule } from './modules/learnings/learnings.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AuthModule,
    AccountModule,
    AiModule,
    ProgressModule,
    LearningsModule,
    SystemModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestIdMiddleware, requestLoggerMiddleware).forRoutes('*path');
  }
}
