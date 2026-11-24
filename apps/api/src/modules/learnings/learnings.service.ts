import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  type CreateLearningInput,
  type JourneyStep,
  type LearningDetail,
  type LearningOptions,
  learningOptionsSchema,
  type LearningPreferences,
  learningPreferencesSchema,
  type LearningSummary,
  type LessonContent,
  type LiveStatus,
  type StepDetail,
  type StepMedia,
  type StepStatus,
  type UpdateLearningInput,
  shortTitle,
} from '@studythinker/shared';
import { type Learning, Prisma, type Step } from '../../generated/prisma/client.js';
import { AppException } from '../../common/http/app-exception.js';
import { PrismaService, type Tx } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { journeyFindings, optionsFindings } from './live.js';
import {
  hasGames,
  normalizeGames,
  normalizeSlides,
  rawGamesSchema,
  rawSlidesSchema,
} from './media.js';
import { findImages, takePictureTerms } from './wikimedia.js';
import {
  normalizeOptions,
  normalizeSteps,
  rawJourneySchema,
  rawOptionsSchema,
  type StepDraft,
} from './normalize.js';
import {
  gamesPrompt,
  journeyPrompt,
  lessonPrompt,
  optionsPrompt,
  slidesPrompt,
  splitKeyPoints,
} from './prompts.js';

const REVISIONS_KEPT = 20;

interface Snapshot {
  title: string;
  overview: string | null;
  preferences: LearningPreferences | null;
  steps: Omit<Step, 'learningId' | 'createdAt' | 'updatedAt'>[];
}

export type LearningWithSteps = Learning & { steps: Step[] };

@Injectable()
export class LearningsService implements OnModuleInit {
  private readonly logger = new Logger(LearningsService.name);
  /** What the AI is doing right now, per learning (work runs in this process). */
  private readonly live = new Map<string, LiveStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly progress: ProgressService,
  ) {}

  /** Starts live tracking and returns a throttled updater fed with the AI's answer so far. */
  private async track(userId: string, learningId: string, phase: LiveStatus['phase']) {
    const status = await this.ai.status(userId).catch(() => null);
    const live: LiveStatus = {
      phase,
      stage: 'waiting',
      model: status?.model ?? null,
      startedAt: new Date().toISOString(),
      received: 0,
      findings: [],
      steps: [],
      groups: [],
    };
    this.live.set(learningId, live);
    let last = 0;
    let lastLength = 0;
    return {
      live,
      onText: (soFar: string) => {
        // A shorter answer means the AI started again (fixing an invalid answer).
        if (soFar.length < lastLength) live.stage = 'fixing';
        else if (live.stage === 'waiting') live.stage = 'writing';
        lastLength = soFar.length;
        live.received = soFar.length;
        const now = Date.now();
        if (now - last < 250) return;
        last = now;
        if (phase === 'options') live.findings = optionsFindings(soFar);
        else Object.assign(live, journeyFindings(soFar));
      },
      done: () => this.live.delete(learningId),
    };
  }

  /** Builds run in this process; one interrupted by a restart is reported, not left spinning. */
  async onModuleInit() {
    const { count } = await this.prisma.learning.updateMany({
      where: { status: 'BUILDING' },
      data: { status: 'FAILED', error: 'Building was interrupted. Please try again.' },
    });
    if (count) this.logger.warn(`Marked ${count} interrupted journey build(s) as failed`);
  }

  // ───────────────────────── Reading ─────────────────────────

  async list(userId: string): Promise<LearningSummary[]> {
    const rows = await this.prisma.learning.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        steps: {
          select: { id: true, title: true, minutes: true, status: true },
          orderBy: { position: 'asc' },
        },
      },
      take: 200,
    });
    return rows.map((l) => toSummary(l, l.steps));
  }

  async get(userId: string, id: string): Promise<LearningDetail> {
    // Read the live status before the row: the AI saves its result and only then
    // clears the status, so this order never shows "not working" with stale data.
    const live = this.live.get(id) ?? null;
    const learning = await this.owned(userId, id);
    return this.detail(learning, live);
  }

  async owned(userId: string, id: string): Promise<LearningWithSteps> {
    const learning = await this.prisma.learning.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!learning) throw AppException.notFound('Learning');
    return learning;
  }

  async detail(
    learning: LearningWithSteps,
    live: LiveStatus | null = this.live.get(learning.id) ?? null,
  ): Promise<LearningDetail> {
    const last = await this.prisma.revision.findFirst({
      where: { learningId: learning.id },
      orderBy: { createdAt: 'desc' },
      select: { summary: true },
    });
    return {
      ...toSummary(learning, learning.steps),
      description: learning.description,
      options: parseOptions(learning.options),
      preferences: parsePrefs(learning.preferences),
      overview: learning.overview,
      error: learning.error,
      steps: learning.steps.map(toStep),
      canUndo: !!last,
      lastChange: last?.summary ?? null,
      createdAt: learning.createdAt.toISOString(),
      live,
    };
  }

  // ───────────────────────── Creating ─────────────────────────

  /**
   * Creates the learning and asks the AI for options in the background; the
   * learner watches the AI's choices appear (poll the learning: `live`).
   */
  async create(userId: string, input: CreateLearningInput): Promise<LearningDetail> {
    const learning = await this.prisma.learning.create({
      data: {
        userId,
        topic: input.topic,
        title: input.topic.slice(0, 120),
        description: input.description || null,
      },
    });
    await this.progress.record(userId, {
      kind: 'learning_created',
      learningId: learning.id,
      ref: learning.id,
      once: 'ever',
      label: `Started learning "${learning.topic.slice(0, 120)}"`,
    });
    await this.startOptions(userId, learning);
    return this.get(userId, learning.id);
  }

  async regenerateOptions(userId: string, id: string): Promise<LearningDetail> {
    const learning = await this.owned(userId, id);
    if (learning.status === 'BUILDING')
      throw AppException.conflict('Your journey is still being built.');
    if (this.live.has(id)) throw AppException.conflict('The AI is already working on this.');
    await this.prisma.learning.update({ where: { id }, data: { error: null } });
    await this.startOptions(userId, learning);
    return this.get(userId, id);
  }

  private async startOptions(userId: string, learning: Learning) {
    const tracker = await this.track(userId, learning.id, 'options');
    void (async () => {
      try {
        const raw = await this.ai.json(
          userId,
          rawOptionsSchema,
          optionsPrompt(learning.topic, learning.description),
          { maxTokens: 3000, temperature: 0.4, onText: tracker.onText },
        );
        tracker.live.stage = 'saving';
        const options = normalizeOptions(raw, learning.topic);
        await this.prisma.learning.update({
          where: { id: learning.id },
          data: {
            options: options as unknown as Prisma.InputJsonValue,
            title: learning.status === 'DRAFT' ? options.title : undefined,
            error: null,
          },
        });
      } catch (err) {
        await this.prisma.learning
          .update({ where: { id: learning.id }, data: { error: (err as Error).message } })
          .catch(() => undefined);
      } finally {
        tracker.done();
      }
    })();
  }

  async update(userId: string, id: string, input: UpdateLearningInput): Promise<LearningDetail> {
    await this.owned(userId, id);
    await this.prisma.learning.update({
      where: { id },
      data: {
        title: input.title,
        preferences: input.preferences as unknown as Prisma.InputJsonValue | undefined,
      },
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.learning.deleteMany({ where: { id, userId } });
    if (!count) throw AppException.notFound('Learning');
  }

  // ───────────────────────── Building the journey ─────────────────────────

  /** Saves the learner's choices and builds the journey in the background (poll the learning). */
  async build(userId: string, id: string, prefs: LearningPreferences): Promise<LearningDetail> {
    const learning = await this.owned(userId, id);
    if (learning.status === 'BUILDING')
      throw AppException.conflict('Your journey is already being built.');
    if (learning.steps.length)
      await this.snapshot(this.prisma, learning, 'Rebuilt the journey with new choices');
    await this.prisma.learning.update({
      where: { id },
      data: { preferences: prefs as unknown as Prisma.InputJsonValue },
    });
    await this.startBuild(userId, id);
    return this.get(userId, id);
  }

  /** Marks the learning BUILDING and generates the journey without blocking the request. */
  async startBuild(userId: string, id: string, instructions?: string) {
    const { count } = await this.prisma.learning.updateMany({
      where: { id, userId, status: { not: 'BUILDING' } },
      data: { status: 'BUILDING', error: null },
    });
    if (!count) throw AppException.conflict('Your journey is already being built.');
    const tracker = await this.track(userId, id, 'journey');
    void this.runBuild(userId, id, tracker, instructions);
  }

  private async runBuild(
    userId: string,
    id: string,
    tracker: Awaited<ReturnType<LearningsService['track']>>,
    instructions?: string,
  ) {
    try {
      const learning = await this.owned(userId, id);
      const prefs = parsePrefs(learning.preferences);
      if (!prefs) throw new Error('Choose your options first.');
      const options = parseOptions(learning.options);
      const raw = await this.ai.json(
        userId,
        rawJourneySchema,
        journeyPrompt({
          topic: learning.topic,
          title: learning.title,
          description: learning.description,
          prefs,
          extrasLabels: extrasLabels(options),
          instructions,
          existing: learning.steps.map((s) => ({
            key: s.key,
            title: s.title,
            status: s.status,
            group: s.group,
          })),
        }),
        { maxTokens: 8000, temperature: 0.5, onText: tracker.onText },
      );
      tracker.live.stage = 'saving';
      const drafts = normalizeSteps(raw.steps, prefs);
      tracker.live.steps = drafts.map((d) => d.title);
      if (!drafts.length) throw new Error('The AI did not produce any steps. Please try again.');
      await this.prisma.$transaction(async (tx) => {
        await this.replaceSteps(tx, id, drafts);
        await tx.learning.update({
          where: { id },
          data: {
            status: 'READY',
            overview: raw.overview || null,
            title: raw.title && learning.status === 'DRAFT' ? raw.title.slice(0, 120) : undefined,
            error: null,
          },
        });
      });
      await this.progress.record(userId, {
        kind: 'journey_built',
        learningId: id,
        ref: id,
        once: 'ever',
        label: `Got a ${drafts.length}-step journey for "${shortTitle(learning.title)}"`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Building the journey failed.';
      this.logger.warn(`Journey build failed for ${id}: ${message}`);
      const hasSteps = await this.prisma.step.count({ where: { learningId: id } });
      await this.prisma.learning
        .update({
          where: { id },
          data: {
            status: hasSteps ? 'READY' : 'FAILED',
            error: `Couldn't build the journey: ${message}`,
          },
        })
        .catch(() => undefined);
    } finally {
      tracker.done();
    }
  }

  /**
   * Makes the learning's steps match `drafts`, matching by key so finished
   * steps keep their progress, lessons and chats.
   */
  async replaceSteps(tx: Tx, learningId: string, drafts: StepDraft[]) {
    const existing = await tx.step.findMany({ where: { learningId } });
    const byKey = new Map(existing.map((s) => [s.key, s]));
    const keep = new Set(drafts.map((d) => d.key));
    await tx.step.deleteMany({ where: { learningId, key: { notIn: [...keep] } } });
    for (const [position, d] of drafts.entries()) {
      const prev = byKey.get(d.key);
      const data = {
        title: d.title,
        summary: d.summary,
        kind: d.kind,
        group: d.group,
        parentKey: d.parentKey,
        dependsOn: d.dependsOn,
        minutes: d.minutes,
        mode: d.mode,
        assessmentStyle: d.assessmentStyle,
        position,
      };
      if (prev) {
        await tx.step.update({
          where: { id: prev.id },
          data: {
            ...data,
            // A lesson written for a different step would mislead.
            ...(prev.title !== d.title ? { lesson: Prisma_DbNull, media: Prisma_DbNull } : {}),
          },
        });
      } else {
        await tx.step.create({ data: { ...data, learningId, key: d.key } });
      }
    }
  }

  // ───────────────────────── Undo ─────────────────────────

  async snapshot(db: Tx | PrismaService, learning: LearningWithSteps, summary: string) {
    const snap: Snapshot = {
      title: learning.title,
      overview: learning.overview,
      preferences: parsePrefs(learning.preferences),
      steps: learning.steps.map(({ learningId: _l, createdAt: _c, updatedAt: _u, ...s }) => s),
    };
    await db.revision.create({
      data: {
        learningId: learning.id,
        summary,
        snapshot: snap as unknown as Prisma.InputJsonValue,
      },
    });
    const old = await db.revision.findMany({
      where: { learningId: learning.id },
      orderBy: { createdAt: 'desc' },
      skip: REVISIONS_KEPT,
      select: { id: true },
    });
    if (old.length) await db.revision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  }

  async undo(userId: string, id: string): Promise<LearningDetail> {
    const learning = await this.owned(userId, id);
    if (learning.status === 'BUILDING')
      throw AppException.conflict('Wait until the journey is built.');
    const revision = await this.prisma.revision.findFirst({
      where: { learningId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!revision) throw AppException.conflict('There is nothing to undo.');
    const snap = revision.snapshot as unknown as Snapshot;
    await this.prisma.$transaction(async (tx) => {
      const ids = snap.steps.map((s) => s.id);
      await tx.step.deleteMany({ where: { learningId: id, id: { notIn: ids } } });
      // Keys are unique per learning: clear them first so restored keys can't collide.
      await tx.$executeRaw`UPDATE steps SET key = 'r-' || replace(id::text, '-', '') WHERE "learningId" = ${id}::uuid`;
      for (const s of snap.steps) {
        const data = {
          ...s,
          lesson: (s.lesson ?? Prisma_DbNull) as Prisma.InputJsonValue,
          media: (s.media ?? Prisma_DbNull) as Prisma.InputJsonValue,
          completedAt: s.completedAt ? new Date(s.completedAt) : null,
        };
        await tx.step.upsert({
          where: { id: s.id },
          update: data,
          create: { ...data, learningId: id },
        });
      }
      await tx.learning.update({
        where: { id },
        data: {
          title: snap.title,
          overview: snap.overview,
          preferences: (snap.preferences ?? Prisma_DbNull) as Prisma.InputJsonValue,
          status: snap.steps.length ? 'READY' : learning.status,
          error: null,
        },
      });
      await tx.revision.delete({ where: { id: revision.id } });
    });
    return this.get(userId, id);
  }

  // ───────────────────────── Steps and lessons ─────────────────────────

  async stepDetail(userId: string, learningId: string, stepId: string): Promise<StepDetail> {
    const learning = await this.owned(userId, learningId);
    const index = learning.steps.findIndex((s) => s.id === stepId);
    if (index === -1) throw AppException.notFound('Step');
    const step = learning.steps[index]!;
    const near = (s: Step | undefined) => (s ? { id: s.id, title: s.title } : null);
    return {
      learning: {
        id: learning.id,
        title: learning.title,
        preferences: parsePrefs(learning.preferences),
      },
      step: toStep(step),
      lesson: (step.lesson as unknown as LessonContent | null) ?? null,
      media: (step.media as unknown as StepMedia | null) ?? {},
      previous: near(learning.steps[index - 1]),
      next: near(learning.steps[index + 1]),
    };
  }

  async setStepStatus(userId: string, learningId: string, stepId: string, status: StepStatus) {
    await this.owned(userId, learningId);
    const { count } = await this.prisma.step.updateMany({
      where: { id: stepId, learningId },
      data: { status, completedAt: status === 'done' ? new Date() : null },
    });
    if (!count) throw AppException.notFound('Step');
    if (status === 'done') await this.rewardStepDone(userId, learningId, stepId);
    await this.touch(learningId);
    return this.stepDetail(userId, learningId, stepId);
  }

  /** XP for finishing a step (once per step), and a bonus for finishing the journey. */
  async rewardStepDone(userId: string, learningId: string, stepId: string) {
    const learning = await this.owned(userId, learningId);
    const step = learning.steps.find((s) => s.id === stepId);
    if (!step) return;
    await this.progress.record(userId, {
      kind: 'step_done',
      learningId,
      ref: stepId,
      once: 'ever',
      xp: step.kind === 'practice' || step.kind === 'project' ? 30 : 20,
      label: `Finished "${step.title}"`,
    });
    if (learning.steps.length && learning.steps.every((s) => s.status === 'done'))
      await this.progress.record(userId, {
        kind: 'journey_finished',
        learningId,
        ref: learningId,
        once: 'ever',
        label: `Completed the whole journey "${learning.title}"`,
      });
  }

  async history(userId: string, learningId: string) {
    await this.owned(userId, learningId);
    return this.progress.history(learningId);
  }

  async generateLesson(
    userId: string,
    learningId: string,
    stepId: string,
    instruction?: string,
    onDelta?: (piece: string) => void,
  ): Promise<StepDetail> {
    const learning = await this.owned(userId, learningId);
    const step = learning.steps.find((s) => s.id === stepId);
    if (!step) throw AppException.notFound('Step');
    const prefs = requirePrefs(learning);
    const outline = learning.steps
      .map((s) => `${s.id === step.id ? '>>' : '-'} ${s.group ? `[${s.group}] ` : ''}${s.title}`)
      .join('\n');
    const text = await this.ai.text(
      userId,
      lessonPrompt({
        topic: learning.topic,
        prefs,
        extrasLabels: extrasLabels(parseOptions(learning.options)),
        step,
        outline,
        instruction,
      }),
      { maxTokens: 2500, temperature: 0.6, onDelta },
    );
    const { markdown, terms } = takePictureTerms(text);
    const images = prefs.modes.includes('images')
      ? (await Promise.all(terms.map((t) => findImages(t, 1)))).flat().slice(0, 3)
      : [];
    const lesson: LessonContent = {
      ...splitKeyPoints(markdown),
      generatedAt: new Date().toISOString(),
      ...(images.length ? { images } : {}),
    };
    await this.prisma.step.update({
      where: { id: step.id },
      data: {
        lesson: lesson as unknown as Prisma.InputJsonValue,
        status: step.status === 'todo' ? 'in_progress' : step.status,
      },
    });
    await this.progress.record(userId, {
      kind: 'lesson_opened',
      learningId,
      ref: stepId,
      once: 'ever',
      label: `Opened the lesson "${step.title}"`,
    });
    await this.touch(learningId);
    return this.stepDetail(userId, learningId, stepId);
  }

  // ───────────────────────── Slides and games ─────────────────────────

  private async mediaContext(userId: string, learningId: string, stepId: string) {
    const learning = await this.owned(userId, learningId);
    const step = learning.steps.find((s) => s.id === stepId);
    if (!step) throw AppException.notFound('Step');
    const lesson = step.lesson as unknown as LessonContent | null;
    return {
      step,
      media: (step.media as unknown as StepMedia | null) ?? {},
      input: {
        topic: learning.topic,
        prefs: requirePrefs(learning),
        extrasLabels: extrasLabels(parseOptions(learning.options)),
        step,
        lesson: lesson?.markdown ?? null,
      },
    };
  }

  /** A narrated slideshow of the step (made from its lesson when there is one). */
  async generateSlides(userId: string, learningId: string, stepId: string): Promise<StepDetail> {
    const ctx = await this.mediaContext(userId, learningId, stepId);
    const raw = await this.ai.json(userId, rawSlidesSchema, slidesPrompt(ctx.input), {
      maxTokens: 5000,
      temperature: 0.5,
    });
    const slides = normalizeSlides(raw);
    if (slides.length < 2)
      throw AppException.aiUnavailable('The AI did not make a usable slideshow. Please try again.');
    await this.prisma.step.update({
      where: { id: stepId },
      data: { media: { ...ctx.media, slides } as unknown as Prisma.InputJsonValue },
    });
    return this.stepDetail(userId, learningId, stepId);
  }

  /** Matching, ordering, true/false and fill-the-gap games for the step. */
  async generateGames(userId: string, learningId: string, stepId: string): Promise<StepDetail> {
    const ctx = await this.mediaContext(userId, learningId, stepId);
    const raw = await this.ai.json(userId, rawGamesSchema, gamesPrompt(ctx.input), {
      maxTokens: 4000,
      temperature: 0.6,
    });
    const games = normalizeGames(raw);
    if (!hasGames(games))
      throw AppException.aiUnavailable('The AI did not make usable games. Please try again.');
    await this.prisma.step.update({
      where: { id: stepId },
      data: { media: { ...ctx.media, games } as unknown as Prisma.InputJsonValue },
    });
    return this.stepDetail(userId, learningId, stepId);
  }

  async recordGame(userId: string, learningId: string, stepId: string, score: number) {
    const { step } = await this.mediaContext(userId, learningId, stepId);
    await this.progress.record(userId, {
      kind: 'game',
      learningId,
      ref: stepId,
      once: 'day',
      value: score,
      xp: 5 + Math.round(score / 10),
      label: `Played the games for "${step.title}" — ${score}%`,
    });
    await this.touch(learningId);
  }

  async touch(learningId: string) {
    await this.prisma.learning.update({
      where: { id: learningId },
      data: { updatedAt: new Date() },
    });
  }
}

// ───────────────────────── Mapping helpers ─────────────────────────

const Prisma_DbNull = Prisma.DbNull;

export function parseOptions(v: unknown): LearningOptions | null {
  const r = learningOptionsSchema.safeParse(v);
  return r.success ? r.data : null;
}

export function parsePrefs(v: unknown): LearningPreferences | null {
  const r = learningPreferencesSchema.safeParse(v);
  return r.success ? r.data : null;
}

export function requirePrefs(learning: Learning): LearningPreferences {
  const prefs = parsePrefs(learning.preferences);
  if (!prefs) throw AppException.conflict('Choose how you want to learn first.');
  return prefs;
}

export function extrasLabels(options: LearningOptions | null): Record<string, string> {
  return Object.fromEntries((options?.extraQuestions ?? []).map((q) => [q.id, q.label]));
}

export function toStep(s: Step): JourneyStep {
  return {
    id: s.id,
    key: s.key,
    title: s.title,
    summary: s.summary,
    kind: s.kind as JourneyStep['kind'],
    group: s.group,
    parentKey: s.parentKey,
    dependsOn: s.dependsOn,
    position: s.position,
    minutes: s.minutes,
    mode: s.mode as JourneyStep['mode'],
    assessmentStyle: s.assessmentStyle as JourneyStep['assessmentStyle'],
    status: s.status as StepStatus,
    hasLesson: s.lesson !== null,
    completedAt: s.completedAt?.toISOString() ?? null,
  };
}

function toSummary(
  l: Learning,
  steps: { id: string; title: string; minutes: number; status: string }[],
): LearningSummary {
  const next =
    steps.find((s) => s.status === 'in_progress') ?? steps.find((s) => s.status === 'todo');
  return {
    id: l.id,
    title: l.title,
    topic: l.topic,
    status: l.status,
    structure: parsePrefs(l.preferences)?.structure ?? null,
    progress: { done: steps.filter((s) => s.status === 'done').length, total: steps.length },
    next: next ? { id: next.id, title: next.title, minutes: next.minutes } : null,
    updatedAt: l.updatedAt.toISOString(),
  };
}
