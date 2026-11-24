import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { UserThrottlerGuard } from '../../common/http/user-throttler.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { Mailer } from './mailer.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  // Secrets are passed per call (access vs delegation tokens use different keys).
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    Mailer,
    // Order matters: authenticate first, then rate-limit per learner.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
  exports: [AuthService, TokenService, JwtModule, Mailer],
})
export class AuthModule {}
