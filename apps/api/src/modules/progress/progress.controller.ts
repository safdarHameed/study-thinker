import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../common/auth/auth.decorators.js';
import { ProgressService } from './progress.service.js';

@ApiTags('progress')
@ApiBearerAuth()
@Controller({ path: 'me/progress', version: '1' })
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  @ApiOperation({ summary: 'XP, level, streak, weekly goal, badges and recent activity' })
  get(@CurrentUser() user: AuthenticatedUser, @Query('tz') tz?: string) {
    return this.progress.progress(user.id, typeof tz === 'string' ? tz.slice(0, 64) : undefined);
  }
}
