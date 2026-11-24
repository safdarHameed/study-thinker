import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service.js';
import { ConversationsService } from './conversations.service.js';
import {
  AssessmentsController,
  ConversationsController,
  GuideController,
  LearningsController,
} from './learnings.controller.js';
import { LearningsService } from './learnings.service.js';

@Module({
  controllers: [
    LearningsController,
    ConversationsController,
    AssessmentsController,
    GuideController,
  ],
  providers: [LearningsService, ConversationsService, AssessmentsService],
})
export class LearningsModule {}
