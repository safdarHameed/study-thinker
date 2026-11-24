import { Injectable } from '@nestjs/common';
import {
  type AssessmentStyleId,
  type ChatMessage,
  type Conversation,
  type ConversationKind,
  type LessonContent,
  type SendMessageResult,
  StepKind,
  StepStatus,
  type GuideRequest,
  shortTitle,
} from '@studythinker/shared';
import { z } from 'zod';
import type { Message } from '../../generated/prisma/client.js';
import { AppException } from '../../common/http/app-exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { partialString } from './live.js';
import type { ChatMessage as LlmMessage } from '../ai/providers.js';
import { AssessmentsService } from './assessments.service.js';
import {
  extrasLabels,
  type LearningWithSteps,
  LearningsService,
  parseOptions,
  requirePrefs,
} from './learnings.service.js';
import { mergePreferences, normalizeSteps, rawStepSchema, slugKey } from './normalize.js';
import { coachSystem, guideSystem, tutorSystem } from './prompts.js';

/** Streaming: more of the reply, or what the server is doing now. */
export type ReplyEvent = { type: 'delta'; text: string } | { type: 'status'; text: string };
type Emit = (event: ReplyEvent) => void;

/** Messages of history sent to the model. */
const HISTORY = 30;

const actionSchema = z
  .object({ type: z.string() })
  .passthrough()
  .transform((a) => a as { type: string } & Record<string, unknown>);
const coachReplySchema = z.object({
  reply: z.string().min(1).max(8000),
  actions: z.array(actionSchema).max(20).catch([]).default([]),
});

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly learnings: LearningsService,
    private readonly assessments: AssessmentsService,
    private readonly progress: ProgressService,
  ) {}

  /** Returns the conversation of this kind (for the step, if given), creating it if needed. */
  async open(
    userId: string,
    learningId: string,
    kind: ConversationKind,
    stepId?: string,
  ): Promise<Conversation> {
    const learning = await this.learnings.owned(userId, learningId);
    if (stepId && !learning.steps.some((s) => s.id === stepId)) throw AppException.notFound('Step');
    if (kind !== 'coach' && !stepId)
      throw AppException.validation('Choose a step for this conversation.');
    const where = { learningId, kind, stepId: kind === 'coach' ? null : stepId };
    const existing = await this.prisma.conversation.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const conv = existing ?? (await this.prisma.conversation.create({ data: where }));
    return this.load(conv.id);
  }

  /** Starts over: a new, empty conversation of the same kind. */
  async restart(userId: string, conversationId: string): Promise<Conversation> {
    const conv = await this.ownedConversation(userId, conversationId);
    if (conv.assessment) throw AppException.conflict('Debate assessments cannot be restarted.');
    const fresh = await this.prisma.conversation.create({
      data: { learningId: conv.learningId, kind: conv.kind, stepId: conv.stepId },
    });
    return this.load(fresh.id);
  }

  async get(userId: string, conversationId: string): Promise<Conversation> {
    await this.ownedConversation(userId, conversationId);
    return this.load(conversationId);
  }

  async send(
    userId: string,
    conversationId: string,
    content: string,
    emit?: Emit,
  ): Promise<SendMessageResult> {
    const conv = await this.ownedConversation(userId, conversationId);
    if (conv.assessment && conv.assessment.status !== 'open')
      throw AppException.conflict('This debate has finished.');
    const learning = await this.learnings.owned(userId, conv.learningId);
    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY,
    });
    history.reverse();
    const past: LlmMessage[] = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    await this.prisma.message.create({ data: { conversationId, role: 'user', content } });

    // The learner's message is kept even if the AI fails, so the UI can offer a retry.
    let reply: string;
    let changes: string[] = [];
    if (conv.kind === 'coach') {
      ({ reply, changes } = await this.coach(userId, learning, past, content, emit));
    } else {
      reply = await this.tutor(
        userId,
        learning,
        conv.kind as 'tutor' | 'voice' | 'debate' | 'simulation',
        conv.stepId,
        past,
        content,
        emit,
      );
      await this.reward(userId, learning, conv);
    }
    const learningChanged = changes.length > 0;
    const saved = await this.prisma.message.create({
      data: { conversationId, role: 'assistant', content: reply, changes },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await this.learnings.touch(learning.id);
    return { message: toMessage(saved), learningChanged };
  }

  /** XP for learning by conversation: once a day per chat or voice lesson, once per debate. */
  private async reward(
    userId: string,
    learning: LearningWithSteps,
    conv: { id: string; kind: string; stepId: string | null },
  ) {
    const step = learning.steps.find((s) => s.id === conv.stepId);
    const about = step ? `"${step.title}"` : `"${learning.title}"`;
    if (conv.kind === 'tutor')
      await this.progress.record(userId, {
        kind: 'chat',
        learningId: learning.id,
        ref: conv.id,
        once: 'day',
        label: `Chatted with your teacher about ${about}`,
      });
    else if (conv.kind === 'voice')
      await this.progress.record(userId, {
        kind: 'voice',
        learningId: learning.id,
        ref: conv.id,
        once: 'day',
        label: `Had a voice lesson on ${about}`,
      });
    else if (conv.kind === 'simulation')
      await this.progress.record(userId, {
        kind: 'game',
        learningId: learning.id,
        ref: `sim-${conv.id}`,
        once: 'day',
        label: `Played a simulation about ${about}`,
      });
    else if (conv.kind === 'debate')
      await this.progress.record(userId, {
        kind: 'debate',
        learningId: learning.id,
        ref: conv.id,
        once: 'ever',
        label: `Debated ${about} with the AI`,
      });
  }

  /** For spoken and debate sessions: the teacher speaks first. */
  /** The app guide: answers "how do I…/what is…/where is…" with the learner's page as context. */
  async guide(userId: string, input: GuideRequest, emit?: Emit): Promise<{ reply: string }> {
    const [user, learnings, ai] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
      this.prisma.learning.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          status: true,
          steps: { select: { status: true } },
        },
      }),
      this.ai.status(userId),
    ]);
    const system = guideSystem({
      name: user?.displayName.split(' ')[0] ?? '',
      page: input.page,
      ai: ai.available
        ? `${ai.source === 'own-key' ? `own ${ai.provider} key` : 'built-in'} (${ai.model})`
        : 'not set up',
      learnings: learnings.map((l) => ({
        title: shortTitle(l.title),
        status: l.status.toLowerCase(),
        done: l.steps.filter((s) => s.status === 'done').length,
        total: l.steps.length,
        url: `/learnings/${l.id}`,
      })),
    });
    const reply = await this.ai.text(
      userId,
      [{ role: 'system', content: system }, ...input.messages.slice(-12)],
      {
        maxTokens: 500,
        temperature: 0.4,
        onDelta: emit ? (text) => emit({ type: 'delta', text }) : undefined,
      },
    );
    return { reply: reply.trim() };
  }

  async opening(userId: string, conversationId: string, emit?: Emit): Promise<SendMessageResult> {
    const conv = await this.ownedConversation(userId, conversationId);
    const count = await this.prisma.message.count({ where: { conversationId } });
    if (count > 0) throw AppException.conflict('This conversation has already started.');
    const learning = await this.learnings.owned(userId, conv.learningId);
    const prompt =
      conv.kind === 'debate'
        ? conv.assessment
          ? `Start the debate. The motion is: "${conv.assessment.title}". Briefly explain the format, ask which side I take, and say you'll argue the other.`
          : 'Start the debate: propose a motion about this step and ask which side I take.'
        : conv.kind === 'coach'
          ? 'Greet me briefly and tell me what you can help with.'
          : conv.kind === 'simulation'
            ? 'Start the simulation.'
            : 'Please start the lesson.';
    const reply =
      conv.kind === 'coach'
        ? (await this.coach(userId, learning, [], prompt, emit)).reply
        : await this.tutor(
            userId,
            learning,
            conv.kind as 'tutor' | 'voice' | 'debate' | 'simulation',
            conv.stepId,
            [],
            prompt,
            emit,
          );
    const saved = await this.prisma.message.create({
      data: { conversationId, role: 'assistant', content: reply },
    });
    return { message: toMessage(saved), learningChanged: false };
  }

  // ───────────────────────── Teaching chats ─────────────────────────

  private async tutor(
    userId: string,
    learning: LearningWithSteps,
    kind: 'tutor' | 'voice' | 'debate' | 'simulation',
    stepId: string | null,
    past: LlmMessage[],
    content: string,
    emit?: Emit,
  ) {
    const prefs = requirePrefs(learning);
    const step = learning.steps.find((s) => s.id === stepId) ?? null;
    const lesson = step?.lesson as unknown as LessonContent | null;
    const system = tutorSystem({
      kind,
      topic: learning.topic,
      prefs,
      extrasLabels: extrasLabels(parseOptions(learning.options)),
      step,
      lessonExcerpt: lesson ? lesson.markdown.slice(0, 6000) : null,
    });
    return this.ai.text(
      userId,
      [{ role: 'system', content: system }, ...past, { role: 'user', content }],
      {
        maxTokens: kind === 'voice' ? 600 : 1500,
        temperature: 0.7,
        onDelta: emit ? (text) => emit({ type: 'delta', text }) : undefined,
      },
    );
  }

  // ───────────────────────── Coach ─────────────────────────

  private async coach(
    userId: string,
    learning: LearningWithSteps,
    past: LlmMessage[],
    content: string,
    emit?: Emit,
  ) {
    const prefs = requirePrefs(learning);
    // Stream the `reply` field out of the JSON answer as it is written.
    let shown = '';
    const onText = emit
      ? (soFar: string) => {
          const reply = partialString(soFar, 'reply');
          if (reply && reply.length > shown.length && reply.startsWith(shown)) {
            emit({ type: 'delta', text: reply.slice(shown.length) });
            shown = reply;
          }
        }
      : undefined;
    const system = coachSystem({
      topic: learning.topic,
      title: learning.title,
      prefs,
      extrasLabels: extrasLabels(parseOptions(learning.options)),
      steps: learning.steps,
    });
    const out = await this.ai.json(
      userId,
      coachReplySchema,
      [{ role: 'system', content: system }, ...past, { role: 'user', content }],
      { maxTokens: 4000, temperature: 0.4, onText },
    );
    if (!out.actions.length) return { reply: out.reply, changes: [] };
    emit?.({ type: 'status', text: 'Updating your journey…' });
    if (learning.status === 'BUILDING') {
      return {
        reply: `${out.reply}\n\n_Your journey is still being built, so I couldn't change it yet. Ask again in a moment._`,
        changes: [],
      };
    }
    const changes = await this.applyActions(userId, learning, out.actions);
    return { reply: out.reply, changes };
  }

  /** Applies the coach's actions. Invalid actions are skipped; a snapshot allows undo. */
  private async applyActions(
    userId: string,
    learning: LearningWithSteps,
    actions: ({ type: string } & Record<string, unknown>)[],
  ): Promise<string[]> {
    let prefs = requirePrefs(learning);
    const changes: string[] = [];
    let rebuild: string | null = null;
    const assessmentsToCreate: { style?: AssessmentStyleId; stepKey?: string; focus?: string }[] =
      [];
    await this.learnings.snapshot(this.prisma, learning, 'Changes from the coach');

    await this.prisma.$transaction(async (tx) => {
      const steps = () =>
        tx.step.findMany({ where: { learningId: learning.id }, orderBy: { position: 'asc' } });
      const reorder = async (keys: string[]) => {
        for (const [position, key] of keys.entries())
          await tx.step.updateMany({ where: { learningId: learning.id, key }, data: { position } });
      };

      for (const a of actions) {
        switch (a.type) {
          case 'update_preferences': {
            const before = prefs;
            const next = mergePreferences(prefs, a.changes);
            if (next) {
              prefs = next;
              await tx.learning.update({
                where: { id: learning.id },
                data: { preferences: prefs as object },
              });
              changes.push('Updated your learning preferences');
              if (before.structure !== prefs.structure && !rebuild)
                rebuild = `Reshape the journey as: ${prefs.structure}`;
            }
            break;
          }
          case 'rebuild_journey':
            rebuild =
              typeof a.instructions === 'string'
                ? a.instructions.slice(0, 2000)
                : 'Redesign the journey';
            break;
          case 'add_steps': {
            const raw = z.array(rawStepSchema).safeParse(a.steps);
            if (!raw.success || !raw.data.length) break;
            const current = await steps();
            const drafts = normalizeSteps(raw.data, prefs, new Set(current.map((s) => s.key)));
            const afterKey = typeof a.afterKey === 'string' ? slugKey(a.afterKey) : null;
            const keys = current.map((s) => s.key);
            const at =
              afterKey && keys.includes(afterKey) ? keys.indexOf(afterKey) + 1 : keys.length;
            for (const d of drafts) {
              await tx.step.create({
                data: {
                  learningId: learning.id,
                  key: d.key,
                  title: d.title,
                  summary: d.summary,
                  kind: d.kind,
                  group: d.group,
                  parentKey: d.parentKey,
                  dependsOn: d.dependsOn,
                  minutes: d.minutes,
                  mode: d.mode,
                  assessmentStyle: d.assessmentStyle,
                  position: 0,
                },
              });
            }
            keys.splice(at, 0, ...drafts.map((d) => d.key));
            await reorder(keys);
            changes.push(
              `Added ${drafts.length === 1 ? `"${drafts[0]!.title}"` : `${drafts.length} steps`}`,
            );
            break;
          }
          case 'update_step': {
            const key = typeof a.key === 'string' ? slugKey(a.key) : '';
            const step = (await steps()).find((s) => s.key === key);
            if (!step) break;
            const kind = StepKind.safeParse(a.kind);
            const data = {
              ...(typeof a.title === 'string' && a.title.trim()
                ? { title: a.title.trim().slice(0, 160) }
                : {}),
              ...(typeof a.summary === 'string' ? { summary: a.summary.slice(0, 1000) } : {}),
              ...(typeof a.group === 'string' ? { group: a.group.slice(0, 120) || null } : {}),
              ...(typeof a.minutes === 'number'
                ? { minutes: Math.min(480, Math.max(5, Math.round(a.minutes))) }
                : {}),
              ...(typeof a.mode === 'string' && prefs.modes.includes(a.mode as never)
                ? { mode: a.mode }
                : {}),
              ...(kind.success ? { kind: kind.data } : {}),
              ...(typeof a.assessmentStyle === 'string' &&
              prefs.assessments.includes(a.assessmentStyle as never)
                ? { assessmentStyle: a.assessmentStyle }
                : {}),
            };
            if (!Object.keys(data).length) break;
            await tx.step.update({ where: { id: step.id }, data });
            changes.push(`Updated "${data.title ?? step.title}"`);
            break;
          }
          case 'remove_steps': {
            const keys = Array.isArray(a.keys)
              ? a.keys.filter((k): k is string => typeof k === 'string').map(slugKey)
              : [];
            const { count } = await tx.step.deleteMany({
              where: { learningId: learning.id, key: { in: keys } },
            });
            if (count) {
              await reorder((await steps()).map((s) => s.key));
              changes.push(`Removed ${count} step${count === 1 ? '' : 's'}`);
            }
            break;
          }
          case 'move_step': {
            const key = typeof a.key === 'string' ? slugKey(a.key) : '';
            const keys = (await steps()).map((s) => s.key);
            if (!keys.includes(key)) break;
            const rest = keys.filter((k) => k !== key);
            const afterKey = typeof a.afterKey === 'string' ? slugKey(a.afterKey) : null;
            const at = afterKey && rest.includes(afterKey) ? rest.indexOf(afterKey) + 1 : 0;
            rest.splice(at, 0, key);
            await reorder(rest);
            changes.push('Reordered the journey');
            break;
          }
          case 'set_status': {
            const status = StepStatus.safeParse(a.status);
            const keys = Array.isArray(a.keys)
              ? a.keys.filter((k): k is string => typeof k === 'string').map(slugKey)
              : [];
            if (!status.success || !keys.length) break;
            const { count } = await tx.step.updateMany({
              where: { learningId: learning.id, key: { in: keys } },
              data: {
                status: status.data,
                completedAt: status.data === 'done' ? new Date() : null,
              },
            });
            if (count)
              changes.push(
                `Marked ${count} step${count === 1 ? '' : 's'} as ${status.data.replace('_', ' ')}`,
              );
            break;
          }
          case 'rename': {
            if (typeof a.title === 'string' && a.title.trim()) {
              await tx.learning.update({
                where: { id: learning.id },
                data: { title: a.title.trim().slice(0, 120) },
              });
              changes.push(`Renamed to "${a.title.trim().slice(0, 120)}"`);
            }
            break;
          }
          case 'create_assessment':
            assessmentsToCreate.push({
              style: typeof a.style === 'string' ? (a.style as AssessmentStyleId) : undefined,
              stepKey: typeof a.stepKey === 'string' ? slugKey(a.stepKey) : undefined,
              focus: typeof a.focus === 'string' ? a.focus.slice(0, 500) : undefined,
            });
            break;
          default:
            break;
        }
      }
    });

    for (const req of assessmentsToCreate) {
      const fresh = await this.learnings.owned(userId, learning.id);
      const step = fresh.steps.find((s) => s.key === req.stepKey);
      try {
        const created = await this.assessments.create(userId, learning.id, {
          style: req.style,
          stepId: step?.id,
          focus: req.focus,
        });
        changes.push(
          `Created an assessment: "${created.title}" [open](/assessments/${created.id})`,
        );
      } catch (err) {
        changes.push(`Couldn't create the assessment: ${(err as Error).message}`);
      }
    }

    if (rebuild) {
      await this.learnings.startBuild(userId, learning.id, rebuild);
      changes.push('Rebuilding your journey — it will update in a moment');
    }
    if (!changes.length) {
      // Nothing applied: drop the snapshot so "undo" doesn't undo nothing.
      const last = await this.prisma.revision.findFirst({
        where: { learningId: learning.id },
        orderBy: { createdAt: 'desc' },
      });
      if (last) await this.prisma.revision.delete({ where: { id: last.id } });
    }
    return changes;
  }

  // ───────────────────────── Helpers ─────────────────────────

  private async ownedConversation(userId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, learning: { userId } },
      include: { assessment: { select: { id: true, status: true, title: true } } },
    });
    if (!conv) throw AppException.notFound('Conversation');
    return conv;
  }

  private async load(id: string): Promise<Conversation> {
    const conv = await this.prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return {
      id: conv.id,
      kind: conv.kind as ConversationKind,
      learningId: conv.learningId,
      stepId: conv.stepId,
      messages: conv.messages.map(toMessage),
    };
  }
}

function toMessage(m: Message): ChatMessage {
  return {
    id: m.id,
    role: m.role as ChatMessage['role'],
    content: m.content,
    changes: m.changes,
    createdAt: m.createdAt.toISOString(),
  };
}
