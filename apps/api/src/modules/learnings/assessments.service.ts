import { Injectable, Logger } from '@nestjs/common';
import {
  ASSESSMENT_STYLES,
  type AssessmentDetail,
  type AssessmentQuestion,
  type AssessmentResult,
  type AssessmentStatus,
  type AssessmentStyleId,
  type AssessmentSummary,
  type CreateAssessmentInput,
  type LessonImage,
  type QuestionType,
} from '@studythinker/shared';
import { z } from 'zod';
import type { Assessment, Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../../common/http/app-exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { extrasLabels, LearningsService, parseOptions, requirePrefs } from './learnings.service.js';
import { assessmentPrompt, gradingPrompt } from './prompts.js';
import { findImages } from './wikimedia.js';

/** Stored with the assessment; `answer`, `rubric` and `explanation` never reach the learner before marking. */
interface StoredQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  answer: string;
  rubric: string;
  explanation: string;
  /** Match: right-hand items as shown (shuffled). */
  right?: string[];
  diagram?: string;
  image?: LessonImage;
}

const text = (max: number) =>
  z
    .unknown()
    .transform((v) =>
      typeof v === 'string'
        ? v.slice(0, max)
        : typeof v === 'number' || typeof v === 'boolean'
          ? String(v).slice(0, max)
          : '',
    );

const rawAssessmentSchema = z.object({
  title: text(160),
  instructions: text(1000),
  questions: z
    .array(
      z
        .object({
          type: text(20),
          prompt: text(4000),
          options: z.array(text(500)).catch([]).optional(),
          right: z.array(text(500)).catch([]).optional(),
          diagram: text(2000).optional(),
          picture: text(80).optional(),
          answer: text(4000).optional(),
          rubric: text(2000).optional(),
          explanation: text(2000).optional(),
        })
        .passthrough(),
    )
    .catch([]),
});

const rawGradeSchema = z.object({
  items: z
    .array(
      z.object({
        id: text(40),
        score: z.unknown().transform((v) => {
          const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
          return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
        }),
        feedback: text(2000),
      }),
    )
    .catch([]),
  summary: text(2000),
  strengths: z.array(text(300)).catch([]),
  improvements: z.array(text(300)).catch([]),
});

const TYPE_FOR_STYLE: Record<string, QuestionType> = {
  quiz: 'choice',
  written: 'text',
  practical: 'task',
  scenario: 'text',
  oral: 'spoken',
  flashcards: 'flashcard',
  presentation: 'presentation',
};

/** Styles whose questions may mix types; the AI's own `type` is used when allowed. */
const TYPES_FOR_STYLE: Record<string, QuestionType[]> = {
  images: ['choice', 'text'],
  interactive: ['match', 'order', 'choice'],
};

/** Steps whose assessment scores at least this are marked done. */
const PASS_MARK = 60;

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly learnings: LearningsService,
    private readonly progress: ProgressService,
  ) {}

  async list(userId: string, learningId: string): Promise<AssessmentSummary[]> {
    await this.learnings.owned(userId, learningId);
    const rows = await this.prisma.assessment.findMany({
      where: { learningId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toSummary);
  }

  async get(userId: string, id: string): Promise<AssessmentDetail> {
    return toDetail(await this.owned(userId, id));
  }

  async create(
    userId: string,
    learningId: string,
    input: CreateAssessmentInput,
    /** Progress while it is written ("Writing question 3…"). */
    emit?: (event: { type: 'status'; text: string }) => void,
  ): Promise<AssessmentDetail> {
    const learning = await this.learnings.owned(userId, learningId);
    const prefs = requirePrefs(learning);
    const step = input.stepId ? learning.steps.find((s) => s.id === input.stepId) : undefined;
    if (input.stepId && !step) throw AppException.notFound('Step');

    const requested = input.style ?? step?.assessmentStyle ?? prefs.assessments[0] ?? 'quiz';
    const entry = ASSESSMENT_STYLES.find((s) => s.id === requested);
    if (!entry?.available)
      throw AppException.validation(`${entry?.label ?? 'That style'} isn't available yet.`);
    const style = entry.id as AssessmentStyleId;

    // Scope: the step (and what it builds on), or everything studied so far.
    const studied = learning.steps.filter((s) => s.status !== 'todo');
    const scope = step
      ? `the step "${step.title}" — ${step.summary}`
      : `the learning "${learning.title}". Steps covered so far: ${(studied.length ? studied : learning.steps.slice(0, 5)).map((s) => s.title).join('; ')}`;

    let written = -1;
    emit?.({ type: 'status', text: 'Planning the questions…' });
    const raw = await this.ai.json(
      userId,
      rawAssessmentSchema,
      assessmentPrompt({
        topic: learning.topic,
        prefs,
        extrasLabels: extrasLabels(parseOptions(learning.options)),
        style,
        scope,
        focus: input.focus,
      }),
      {
        maxTokens: 5000,
        temperature: 0.5,
        onText: emit
          ? (soFar) => {
              const n = (soFar.match(/"prompt"\s*:/g) ?? []).length;
              if (n !== written) {
                written = n;
                emit({ type: 'status', text: `Writing question ${n}…` });
              }
            }
          : undefined,
      },
    );
    emit?.({ type: 'status', text: 'Getting it ready…' });
    const questions = await withPictures(normalizeQuestions(raw.questions, style), raw.questions);
    if (style !== 'debate' && !questions.length) {
      throw AppException.aiUnavailable(
        'The AI did not write any usable questions. Please try again.',
      );
    }

    const assessment = await this.prisma.$transaction(async (tx) => {
      const conversation =
        style === 'debate'
          ? await tx.conversation.create({
              data: { learningId, stepId: step?.id ?? null, kind: 'debate' },
            })
          : null;
      return tx.assessment.create({
        data: {
          learningId,
          stepId: step?.id ?? null,
          style,
          title: raw.title || `${entry.label}: ${step?.title ?? learning.title}`,
          instructions: raw.instructions,
          questions: questions as unknown as Prisma.InputJsonValue,
          conversationId: conversation?.id ?? null,
        },
      });
    });
    await this.learnings.touch(learningId);
    return toDetail(assessment);
  }

  /** Saves answers without submitting (so nothing is lost). */
  async saveAnswers(userId: string, id: string, answers: Record<string, string>) {
    const a = await this.owned(userId, id);
    if (a.status === 'graded' || a.status === 'grading')
      throw AppException.conflict('This assessment is already marked.');
    const updated = await this.prisma.assessment.update({
      where: { id },
      data: { answers: cleanAnswers(a, answers) as Prisma.InputJsonValue },
    });
    return toDetail(updated);
  }

  async submit(
    userId: string,
    id: string,
    answers: Record<string, string>,
  ): Promise<AssessmentDetail> {
    const a = await this.owned(userId, id);
    if (a.status === 'graded') throw AppException.conflict('This assessment is already marked.');
    if (a.style === 'debate') throw AppException.validation('Finish the debate to get it marked.');
    const clean = cleanAnswers(a, answers);
    const { count } = await this.prisma.assessment.updateMany({
      where: { id, status: { in: ['open', 'failed'] } },
      data: { answers: clean as Prisma.InputJsonValue, status: 'grading', error: null },
    });
    if (!count) throw AppException.conflict('This assessment is already being marked.');
    return this.grade(userId, a, clean);
  }

  /** Ends a debate assessment and marks the learner's arguments. */
  async finishDebate(userId: string, id: string): Promise<AssessmentDetail> {
    const a = await this.owned(userId, id);
    if (a.style !== 'debate' || !a.conversationId)
      throw AppException.validation('This is not a debate.');
    if (a.status === 'graded') throw AppException.conflict('This debate is already marked.');
    const messages = await this.prisma.message.findMany({
      where: { conversationId: a.conversationId },
      orderBy: { createdAt: 'asc' },
    });
    if (!messages.some((m) => m.role === 'user'))
      throw AppException.validation('Make at least one argument first.');
    const { count } = await this.prisma.assessment.updateMany({
      where: { id, status: { in: ['open', 'failed'] } },
      data: { status: 'grading', error: null },
    });
    if (!count) throw AppException.conflict('This debate is already being marked.');
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'LEARNER' : 'AI'}: ${m.content}`)
      .join('\n\n')
      .slice(-20_000);
    return this.grade(userId, a, {}, transcript);
  }

  private async grade(
    userId: string,
    a: Assessment,
    answers: Record<string, string>,
    transcript?: string,
  ) {
    const learning = await this.learnings.owned(userId, a.learningId);
    const prefs = requirePrefs(learning);
    const questions = a.questions as unknown as StoredQuestion[];
    try {
      const results = new Map<string, { score: number; feedback: string }>();
      // Choice questions and flashcards are marked exactly, without AI.
      for (const q of questions) {
        const given = answers[q.id] ?? '';
        if (q.type === 'choice') {
          const right = given !== '' && given === q.answer;
          results.set(q.id, {
            score: right ? 100 : 0,
            feedback: right ? q.explanation || 'Correct.' : q.explanation || 'Not quite.',
          });
        } else if (q.type === 'match' || q.type === 'order') {
          // Partial credit: the share of items in the right place.
          const expected = JSON.parse(q.answer) as number[];
          // An untouched ordering question counts as the order it was shown in.
          let given: unknown =
            q.type === 'order' ? Array.from({ length: q.options.length }, (_, i) => i) : [];
          try {
            if (answers[q.id]) given = JSON.parse(answers[q.id]!);
          } catch {
            /* keep the default */
          }
          const list = Array.isArray(given) ? given : [];
          const right = expected.filter((v, i) => list[i] === v).length;
          const score = Math.round((right / Math.max(1, expected.length)) * 100);
          results.set(q.id, {
            score,
            feedback:
              score === 100
                ? q.explanation || 'All correct.'
                : `${right} of ${expected.length} in the right place.${q.explanation ? ` ${q.explanation}` : ''}`,
          });
        } else if (q.type === 'flashcard') {
          const knew = given === 'knew';
          results.set(q.id, {
            score: knew ? 100 : 0,
            feedback: knew ? 'You knew this one.' : 'Worth another look.',
          });
        }
      }
      const open = questions.filter((q) => !results.has(q.id));
      let summary = '';
      let strengths: string[] = [];
      let improvements: string[] = [];
      if (open.length || transcript) {
        const graded = await this.ai.json(
          userId,
          rawGradeSchema,
          gradingPrompt({
            prefs,
            topic: learning.topic,
            title: a.title,
            items: open.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              expected: q.answer,
              rubric: q.rubric,
              answer: answers[q.id] ?? '',
            })),
            transcript,
          }),
          { maxTokens: 3000, temperature: 0.2 },
        );
        for (const item of graded.items) {
          if (transcript ? item.id === 'debate' : open.some((q) => q.id === item.id))
            results.set(item.id, { score: item.score, feedback: item.feedback });
        }
        // Anything the model skipped is reported, not silently scored.
        for (const q of open)
          if (!results.has(q.id))
            results.set(q.id, { score: 0, feedback: 'This answer could not be marked.' });
        if (transcript && !results.has('debate'))
          results.set('debate', { score: 0, feedback: 'The debate could not be marked.' });
        summary = graded.summary;
        strengths = graded.strengths.filter(Boolean).slice(0, 6);
        improvements = graded.improvements.filter(Boolean).slice(0, 6);
      }
      const items = transcript
        ? [{ questionId: 'debate', ...results.get('debate')!, correctAnswer: null }]
        : questions.map((q) => ({
            questionId: q.id,
            ...results.get(q.id)!,
            correctAnswer: correctAnswerText(q),
          }));
      const score = Math.round(
        items.reduce((sum, r) => sum + r.score, 0) / Math.max(1, items.length),
      );
      const result: AssessmentResult = {
        score,
        summary:
          summary ||
          (score >= PASS_MARK ? 'Well done.' : 'Keep practising — you are getting there.'),
        strengths,
        improvements,
        questions: items,
      };
      const updated = await this.prisma.assessment.update({
        where: { id: a.id },
        data: { status: 'graded', score, result: result as unknown as Prisma.InputJsonValue },
      });
      await this.progress.record(userId, {
        kind: 'assessment_done',
        learningId: a.learningId,
        ref: a.id,
        once: 'ever',
        xp: 10 + Math.round(score / 5),
        value: score,
        label: `Scored ${score} in "${a.title}"`,
      });
      if (a.stepId && score >= PASS_MARK) {
        await this.prisma.step.updateMany({
          where: { id: a.stepId, status: { not: 'done' } },
          data: { status: 'done', completedAt: new Date() },
        });
        await this.learnings.rewardStepDone(userId, a.learningId, a.stepId);
      }
      await this.learnings.touch(a.learningId);
      return toDetail(updated);
    } catch (err) {
      this.logger.warn(`Marking failed for assessment ${a.id}: ${(err as Error).message}`);
      await this.prisma.assessment.update({
        where: { id: a.id },
        data: { status: 'failed', error: (err as Error).message },
      });
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    const a = await this.owned(userId, id);
    await this.prisma.$transaction([
      this.prisma.assessment.delete({ where: { id: a.id } }),
      ...(a.conversationId
        ? [this.prisma.conversation.delete({ where: { id: a.conversationId } })]
        : []),
    ]);
  }

  private async owned(userId: string, id: string) {
    const a = await this.prisma.assessment.findFirst({ where: { id, learning: { userId } } });
    if (!a) throw AppException.notFound('Assessment');
    return a;
  }
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Shuffles until the order differs from the original (when possible). */
function scramble(n: number): number[] {
  const ids = Array.from({ length: n }, (_, i) => i);
  for (let tries = 0; tries < 5; tries++) {
    const s = shuffle(ids);
    if (s.some((v, i) => v !== i)) return s;
  }
  return ids;
}

const DIAGRAM = /^(flowchart|graph|mindmap|timeline|sequenceDiagram|pie|classDiagram|stateDiagram)/;

function normalizeQuestions(
  raw: z.infer<typeof rawAssessmentSchema>['questions'],
  style: AssessmentStyleId,
): StoredQuestion[] {
  if (style === 'debate') return [];
  const allowed = TYPES_FOR_STYLE[style];
  const out: StoredQuestion[] = [];
  for (const q of raw) {
    if (!q.prompt.trim()) continue;
    const asked = q.type.trim().toLowerCase() as QuestionType;
    const type: QuestionType = allowed
      ? allowed.includes(asked)
        ? asked
        : (q.options?.length ?? 0) >= 2
          ? allowed[0]!
          : allowed.includes('text')
            ? 'text'
            : allowed[0]!
      : (TYPE_FOR_STYLE[style] ?? 'text');
    const options = (q.options ?? [])
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 8);
    let answer = (q.answer ?? '').trim();
    let shownOptions: string[] = [];
    let right: string[] | undefined;
    if (type === 'choice') {
      if (options.length < 2) continue;
      // Accept an index, a letter or the option text.
      const idx = /^\d+$/.test(answer)
        ? Number(answer)
        : /^[a-f]$/i.test(answer)
          ? answer.toLowerCase().charCodeAt(0) - 97
          : options.findIndex((o) => o.toLowerCase() === answer.toLowerCase());
      if (idx < 0 || idx >= options.length) continue;
      answer = String(idx);
      shownOptions = options.slice(0, 6);
      if (idx >= shownOptions.length) continue;
    } else if (type === 'match') {
      const rights = (q.right ?? []).map((r) => r.trim()).filter(Boolean);
      const n = Math.min(options.length, rights.length, 6);
      if (n < 3) continue;
      const lefts = options.slice(0, n);
      const pairs = rights.slice(0, n);
      if (new Set(pairs.map((p) => p.toLowerCase())).size !== n) continue;
      // Show the right-hand side shuffled; the answer maps each left to its shown right index.
      const order = scramble(n);
      right = order.map((i) => pairs[i]!);
      answer = JSON.stringify(lefts.map((_, i) => order.indexOf(i)));
      shownOptions = lefts;
    } else if (type === 'order') {
      const n = Math.min(options.length, 6);
      if (n < 3 || new Set(options.slice(0, n).map((o) => o.toLowerCase())).size !== n) continue;
      // Show the items shuffled; the answer lists shown indexes in the correct order.
      const order = scramble(n);
      shownOptions = order.map((i) => options[i]!);
      answer = JSON.stringify(Array.from({ length: n }, (_, i) => order.indexOf(i)));
    }
    const diagram = (q.diagram ?? '').trim();
    out.push({
      id: `q${out.length + 1}`,
      type,
      prompt: q.prompt.trim(),
      options: shownOptions,
      answer,
      rubric: (q.rubric ?? '').trim(),
      explanation: (q.explanation ?? '').trim(),
      ...(right ? { right } : {}),
      ...(style === 'images' && DIAGRAM.test(diagram) ? { diagram } : {}),
    });
  }
  return out.slice(0, 15);
}

/**
 * Picture questions: finds a photo for each question that asked for one.
 * A question that depends on a photo that can't be found is dropped.
 */
async function withPictures(
  questions: StoredQuestion[],
  raw: z.infer<typeof rawAssessmentSchema>['questions'],
): Promise<StoredQuestion[]> {
  const byPrompt = new Map(raw.map((r) => [r.prompt.trim(), (r.picture ?? '').trim()]));
  const out: StoredQuestion[] = [];
  for (const q of questions) {
    const term = byPrompt.get(q.prompt);
    if (term && !q.diagram) {
      const [image] = await findImages(term, 1);
      if (!image) continue;
      out.push({ ...q, image });
    } else out.push(q);
  }
  return out.map((q, i) => ({ ...q, id: `q${i + 1}` }));
}

function correctAnswerText(q: StoredQuestion): string | null {
  if (q.type === 'choice') return q.options[Number(q.answer)] ?? null;
  if (q.type === 'match') {
    const map = JSON.parse(q.answer) as number[];
    return q.options.map((l, i) => `${l} → ${q.right?.[map[i]!] ?? '?'}`).join('; ');
  }
  if (q.type === 'order') {
    const order = JSON.parse(q.answer) as number[];
    return order.map((i) => q.options[i]).join(' → ');
  }
  return q.answer || null;
}

function cleanAnswers(a: Assessment, answers: Record<string, string>) {
  const ids = new Set((a.questions as unknown as StoredQuestion[]).map((q) => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => ids.has(k)));
}

function toSummary(a: Assessment): AssessmentSummary {
  return {
    id: a.id,
    learningId: a.learningId,
    stepId: a.stepId,
    style: a.style as AssessmentStyleId,
    title: a.title,
    status: a.status as AssessmentStatus,
    score: a.score,
    createdAt: a.createdAt.toISOString(),
  };
}

function toDetail(a: Assessment): AssessmentDetail {
  const questions: AssessmentQuestion[] = (a.questions as unknown as StoredQuestion[]).map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    // Flashcards show their back once the learner flips the card.
    ...(q.type === 'flashcard' ? { back: q.answer } : {}),
    ...(q.right ? { right: q.right } : {}),
    ...(q.diagram ? { diagram: q.diagram } : {}),
    ...(q.image ? { image: q.image } : {}),
  }));
  return {
    ...toSummary(a),
    instructions: a.instructions,
    questions,
    answers: (a.answers as Record<string, string> | null) ?? {},
    result: (a.result as unknown as AssessmentResult | null) ?? null,
    conversationId: a.conversationId,
    error: a.error,
  };
}
