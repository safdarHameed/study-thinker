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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type BuildLearningInput,
  buildLearningSchema,
  type CreateAssessmentInput,
  createAssessmentSchema,
  type CreateLearningInput,
  createLearningSchema,
  type GameResultInput,
  type GuideRequest,
  guideRequestSchema,
  gameResultSchema,
  type GenerateLessonInput,
  generateLessonSchema,
  type OpenConversationInput,
  openConversationSchema,
  type SendMessageInput,
  sendMessageSchema,
  type SubmitAssessmentInput,
  submitAssessmentSchema,
  type UpdateLearningInput,
  updateLearningSchema,
  type UpdateStepInput,
  updateStepSchema,
} from '@studythinker/shared';
import { type AuthenticatedUser, CurrentUser } from '../../common/auth/auth.decorators.js';
import { streamResponse } from '../../common/http/sse.js';
import { AssessmentsService } from './assessments.service.js';
import { ConversationsService } from './conversations.service.js';
import { LearningsService } from './learnings.service.js';

/** AI calls cost money: limit them per learner. */
const AI_LIMIT = { default: { limit: 20, ttl: 60_000 } };
const UUID = new ParseUUIDPipe({ version: '7' });

@ApiTags('learnings')
@ApiBearerAuth()
@Controller({ path: 'learnings', version: '1' })
export class LearningsController {
  constructor(
    private readonly learnings: LearningsService,
    private readonly conversations: ConversationsService,
    private readonly assessments: AssessmentsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.learnings.list(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: 'Create a learning from a topic; the AI proposes options' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createLearningSchema }) body: CreateLearningInput,
  ) {
    return this.learnings.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.learnings.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: updateLearningSchema }) body: UpdateLearningInput,
  ) {
    return this.learnings.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    await this.learnings.remove(user.id, id);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/options')
  @ApiOperation({ summary: 'Ask the AI for options again' })
  options(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.learnings.regenerateOptions(user.id, id);
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post(':id/build')
  @ApiOperation({
    summary: 'Save choices and build the journey (in the background; poll the learning)',
  })
  build(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: buildLearningSchema }) body: BuildLearningInput,
  ) {
    return this.learnings.build(user.id, id, body.preferences);
  }

  @Post(':id/undo')
  @ApiOperation({ summary: 'Undo the last change to the journey' })
  undo(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.learnings.undo(user.id, id);
  }

  // ── Steps ──

  @Get(':id/steps/:stepId')
  step(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Param('stepId', UUID) stepId: string,
  ) {
    return this.learnings.stepDetail(user.id, id, stepId);
  }

  @Patch(':id/steps/:stepId')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Param('stepId', UUID) stepId: string,
    @Body({ schema: updateStepSchema }) body: UpdateStepInput,
  ) {
    return this.learnings.setStepStatus(user.id, id, stepId, body.status);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/steps/:stepId/lesson')
  @ApiOperation({ summary: 'Write (or rewrite) the lesson for a step' })
  lesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Param('stepId', UUID) stepId: string,
    @Body({ schema: generateLessonSchema }) body: GenerateLessonInput,
  ) {
    return this.learnings.generateLesson(user.id, id, stepId, body.instruction);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/steps/:stepId/lesson/stream')
  @ApiOperation({ summary: 'Write the lesson, streaming it as server-sent events' })
  async lessonStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Param('stepId', UUID) stepId: string,
    @Body({ schema: generateLessonSchema }) body: GenerateLessonInput,
    @Res() res: Response,
  ) {
    await streamResponse(res, (emit) =>
      this.learnings.generateLesson(user.id, id, stepId, body.instruction, (text) =>
        emit({ type: 'delta', text }),
      ),
    );
  }

  @Throttle(AI_LIMIT)
  @Post(':id/steps/:stepId/slides')
  @ApiOperation({ summary: 'Make a narrated slideshow for a step' })
  slides(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Param('stepId', UUID) stepId: string,
  ) {
    return this.learnings.generateSlides(user.id, id, stepId);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/steps/:stepId/games')
  @ApiOperation({ summary: 'Make learning games for a step' })
  games(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Param('stepId', UUID) stepId: string,
  ) {
    return this.learnings.generateGames(user.id, id, stepId);
  }

  @Post(':id/steps/:stepId/games/result')
  @HttpCode(HttpStatus.NO_CONTENT)
  async gameResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Param('stepId', UUID) stepId: string,
    @Body({ schema: gameResultSchema }) body: GameResultInput,
  ) {
    await this.learnings.recordGame(user.id, id, stepId, body.score);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'What changed and what the learner did, newest first' })
  history(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.learnings.history(user.id, id);
  }

  // ── Conversations ──

  @Post(':id/conversations')
  @ApiOperation({
    summary: 'Open (or create) the coach chat, or a tutor/voice/debate chat for a step',
  })
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: openConversationSchema }) body: OpenConversationInput,
  ) {
    return this.conversations.open(user.id, id, body.kind, body.stepId);
  }

  // ── Assessments ──

  @Get(':id/assessments')
  assessmentsList(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.assessments.list(user.id, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/assessments')
  @ApiOperation({ summary: 'Create an assessment in one of the learner’s styles' })
  createAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: createAssessmentSchema }) body: CreateAssessmentInput,
  ) {
    return this.assessments.create(user.id, id, body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/assessments/stream')
  @ApiOperation({ summary: 'Create an assessment, streaming progress as server-sent events' })
  async createAssessmentStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: createAssessmentSchema }) body: CreateAssessmentInput,
    @Res() res: Response,
  ) {
    await streamResponse(res, (emit) => this.assessments.create(user.id, id, body, emit));
  }
}

@ApiTags('learnings')
@ApiBearerAuth()
@Controller({ path: 'conversations', version: '1' })
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.conversations.get(user.id, id);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: sendMessageSchema }) body: SendMessageInput,
  ) {
    return this.conversations.send(user.id, id, body.content);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/messages/stream')
  @ApiOperation({ summary: 'Send a message; the reply streams as server-sent events' })
  async sendStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: sendMessageSchema }) body: SendMessageInput,
    @Res() res: Response,
  ) {
    await streamResponse(res, (emit) => this.conversations.send(user.id, id, body.content, emit));
  }

  @Throttle(AI_LIMIT)
  @Post(':id/opening/stream')
  async openingStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Res() res: Response,
  ) {
    await streamResponse(res, (emit) => this.conversations.opening(user.id, id, emit));
  }

  @Throttle(AI_LIMIT)
  @Post(':id/opening')
  @ApiOperation({ summary: 'Let the teacher speak first in an empty conversation' })
  opening(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.conversations.opening(user.id, id);
  }

  @Post(':id/restart')
  restart(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.conversations.restart(user.id, id);
  }
}

@ApiTags('learnings')
@ApiBearerAuth()
@Controller({ path: 'assessments', version: '1' })
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.assessments.get(user.id, id);
  }

  @Put(':id/answers')
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: submitAssessmentSchema }) body: SubmitAssessmentInput,
  ) {
    return this.assessments.saveAnswers(user.id, id, body.answers);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UUID) id: string,
    @Body({ schema: submitAssessmentSchema }) body: SubmitAssessmentInput,
  ) {
    return this.assessments.submit(user.id, id, body.answers);
  }

  @Throttle(AI_LIMIT)
  @Post(':id/finish')
  @ApiOperation({ summary: 'Finish a debate assessment and get it marked' })
  finish(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    return this.assessments.finishDebate(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', UUID) id: string) {
    await this.assessments.remove(user.id, id);
  }
}

@ApiTags('guide')
@ApiBearerAuth()
@Controller({ path: 'guide', version: '1' })
export class GuideController {
  constructor(private readonly conversations: ConversationsService) {}

  @Throttle(AI_LIMIT)
  @Post('stream')
  @ApiOperation({ summary: 'Ask the app guide; the reply streams as server-sent events' })
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: guideRequestSchema }) body: GuideRequest,
    @Res() res: Response,
  ) {
    await streamResponse(res, (emit) => this.conversations.guide(user.id, body, emit));
  }
}
