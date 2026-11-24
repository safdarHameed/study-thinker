import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.decorators.js';
import { RawResponse } from '../../common/http/response-envelope.interceptor.js';
import { AppConfig } from '../../config/app-config.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const API_VERSION_STRING = process.env.npm_package_version ?? '0.2.0';

@ApiTags('system')
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  @Get('health')
  @RawResponse()
  @ApiOperation({ summary: 'Liveness and readiness: the API and its database' })
  async health(@Res({ passthrough: true }) res: Response) {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(
      () => 'up' as const,
      () => 'down' as const,
    );
    res.status(database === 'up' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      checks: { database },
      ai: { builtInModels: !!this.config.get('HF_TOKEN') },
      version: API_VERSION_STRING,
    };
  }
}
