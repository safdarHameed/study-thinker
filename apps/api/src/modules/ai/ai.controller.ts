import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  type CreateConnectionInput,
  createConnectionSchema,
  type ListModelsInput,
  listModelsSchema,
  type SetActiveAiInput,
  setActiveAiSchema,
  type UpdateConnectionInput,
  updateConnectionSchema,
} from '@studythinker/shared';
import { type AuthenticatedUser, CurrentUser } from '../../common/auth/auth.decorators.js';
import { AppException } from '../../common/http/app-exception.js';
import { AiService } from './ai.service.js';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

@ApiTags('ai')
@ApiBearerAuth()
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether a model is usable for you, and which' })
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.status(user.id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Built-in models and your own connections' })
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.settings(user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('models')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List the models an API key can use (the key is not stored)' })
  models(@Body({ schema: listModelsSchema }) body: ListModelsInput) {
    return this.ai.models(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('connections')
  @ApiOperation({ summary: 'Test and save your own provider key, and start using it' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createConnectionSchema }) body: CreateConnectionInput,
  ) {
    return this.ai.createConnection(user.id, body);
  }

  @Get('connections/:id/models')
  @ApiOperation({ summary: 'Models available to a saved connection' })
  connectionModels(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ai.connectionModels(user.id, id);
  }

  @Patch('connections/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateConnectionSchema }) body: UpdateConnectionInput,
  ) {
    return this.ai.updateConnection(user.id, id, body);
  }

  @Delete('connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.ai.deleteConnection(user.id, id);
  }

  @Put('active')
  @ApiOperation({ summary: 'Choose which model to use (null connection = built-in)' })
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: setActiveAiSchema }) body: SetActiveAiInput,
  ) {
    return this.ai.setActive(user.id, body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Speech to text. Body: raw audio (audio/webm, audio/ogg, audio/wav…)' })
  async transcribe(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const mime = (req.header('content-type') ?? '').split(';')[0]!.trim();
    if (!mime.startsWith('audio/'))
      throw AppException.validation('Send audio as the request body.');
    const audio = await readBody(req, MAX_AUDIO_BYTES);
    if (!audio.length) throw AppException.validation('The recording was empty.');
    return { text: await this.ai.transcribe(user.id, audio, mime) };
  }
}

function readBody(req: Request, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(AppException.validation('The recording is too long.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
