import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type ForgotPasswordInput,
  type ForgotPasswordResult,
  forgotPasswordSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type AuthSession,
  type LoginInput,
  loginSchema,
  type RefreshInput,
  refreshSchema,
  type RegisterInput,
  registerSchema,
} from '@studythinker/shared';
import { type AuthenticatedUser, CurrentUser, Public } from '../../common/auth/auth.decorators.js';
import { AppException } from '../../common/http/app-exception.js';
import { AppConfig } from '../../config/app-config.service.js';
import { AuthService, type ClientInfo } from './auth.service.js';
import { PasswordService } from './password.service.js';

export const REFRESH_COOKIE = 'lw_refresh';
/** Non-sensitive hint cookie so the web app can route signed-out visitors without an API call. */
export const SESSION_HINT_COOKIE = 'lw_session';

/** Refresh/logout bodies are optional: browsers rely on the httpOnly cookie. */
const optionalRefreshSchema = refreshSchema.default({});

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Always answers 202 so the endpoint cannot reveal which emails have accounts. `emailDeliveryConfigured` says whether the server can actually email the link.',
  })
  forgotPassword(
    @Body({ schema: forgotPasswordSchema }) body: ForgotPasswordInput,
    @Req() req: Request,
  ): Promise<ForgotPasswordResult> {
    return this.passwords.requestReset(body.email, req.ip);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password with a reset token; signs out every session' })
  async resetPassword(
    @Body({ schema: resetPasswordSchema }) body: ResetPasswordInput,
  ): Promise<void> {
    await this.passwords.reset(body);
  }

  @ApiBearerAuth()
  @Throttle(AUTH_THROTTLE)
  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change your password; signs out your other sessions' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: changePasswordSchema }) body: ChangePasswordInput,
  ): Promise<void> {
    await this.passwords.change(user.id, user.sessionId, body);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session' })
  async register(
    @Body({ schema: registerSchema }) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.withCookies(res, await this.auth.register(body, clientInfo(req)));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.withCookies(res, await this.auth.login(body, clientInfo(req)));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token (cookie or body) and issue a new access token',
  })
  async refresh(
    @Body({ schema: optionalRefreshSchema }) body: RefreshInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const token = body?.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!token) {
      this.clearCookies(res);
      throw AppException.unauthenticated('No active session');
    }
    try {
      return this.withCookies(res, await this.auth.refresh(token, clientInfo(req)));
    } catch (err) {
      this.clearCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current session family' })
  async logout(
    @Body({ schema: optionalRefreshSchema }) body: RefreshInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(
      body?.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined),
    );
    this.clearCookies(res);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  private cookieBase(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE'),
      domain: this.config.get('COOKIE_DOMAIN'),
    };
  }

  private withCookies(res: Response, session: AuthSession): AuthSession {
    const expires = new Date(session.tokens.refreshTokenExpiresAt);
    res.cookie(REFRESH_COOKIE, session.tokens.refreshToken, {
      ...this.cookieBase(),
      path: '/v1/auth',
      expires,
    });
    res.cookie(SESSION_HINT_COOKIE, '1', { ...this.cookieBase(), path: '/', expires });
    return session;
  }

  private clearCookies(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieBase(), path: '/v1/auth' });
    res.clearCookie(SESSION_HINT_COOKIE, { ...this.cookieBase(), path: '/' });
  }
}

function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.header('user-agent'), ipAddress: req.ip };
}
