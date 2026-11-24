import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  type DeleteAccountInput,
  deleteAccountSchema,
  type UpdateMeInput,
  updateMeSchema,
} from '@studythinker/shared';
import { type AuthenticatedUser, CurrentUser } from '../../common/auth/auth.decorators.js';
import { RawResponse } from '../../common/http/response-envelope.interceptor.js';
import { AppConfig } from '../../config/app-config.service.js';
import { REFRESH_COOKIE, SESSION_HINT_COOKIE } from '../auth/auth.controller.js';
import { AccountService } from './account.service.js';

@ApiTags('account')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly config: AppConfig,
  ) {}

  @Patch()
  @ApiOperation({ summary: 'Update your name' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: updateMeSchema }) body: UpdateMeInput,
  ) {
    return this.account.update(user.id, body.displayName);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('export')
  @RawResponse()
  @ApiOperation({ summary: 'Download all your data as JSON' })
  async export(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', 'attachment; filename="studythinker-export.json"');
    res.setHeader('Cache-Control', 'no-store');
    return this.account.export(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete your account and everything in it' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: deleteAccountSchema }) body: DeleteAccountInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.delete(user.id, body.password);
    const base = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('COOKIE_SECURE'),
      domain: this.config.get('COOKIE_DOMAIN'),
    };
    res.clearCookie(REFRESH_COOKIE, { ...base, path: '/v1/auth' });
    res.clearCookie(SESSION_HINT_COOKIE, { ...base, path: '/' });
  }
}
