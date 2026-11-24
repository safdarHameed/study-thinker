import { z } from 'zod';
import { LearningStatus } from '../enums.js';
import {
  ASSESSMENT_STYLE_IDS,
  AUDIENCE_IDS,
  JOURNEY_STRUCTURE_IDS,
  LEARNING_MODE_IDS,
  STARTING_LEVEL_IDS,
  TEACHER_PERSONA_IDS,
} from './catalog.js';

const structureId = z.enum(JOURNEY_STRUCTURE_IDS);
const modeId = z.enum(LEARNING_MODE_IDS);
const assessmentStyleId = z.enum(ASSESSMENT_STYLE_IDS);
const audienceId = z.enum(AUDIENCE_IDS);
const levelId = z.enum(STARTING_LEVEL_IDS);
const personaId = z.enum(TEACHER_PERSONA_IDS);

export const durationUnit = z.enum(['days', 'weeks', 'months']);
export type DurationUnit = z.infer<typeof durationUnit>;

// ───────────────────────── Creating a learning ─────────────────────────

export const createLearningSchema = z.object({
  topic: z.string().trim().min(2, 'What do you want to learn?').max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateLearningInput = z.infer<typeof createLearningSchema>;

/** A recommendation with the AI's reason, e.g. a journey shape. */
const recommended = <T extends z.ZodType>(id: T) => z.object({ id, reason: z.string().max(400) });

/**
 * A topic-specific choice the AI invents (e.g. "Which style of guitar?").
 * The answers are passed back to the AI when it builds the journey.
 */
export const extraQuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().max(120),
  help: z.string().max(300).optional(),
  multiple: z.boolean(),
  options: z.array(z.string().min(1).max(80)).min(2).max(10),
  defaults: z.array(z.string().max(80)).max(10),
});
export type ExtraQuestion = z.infer<typeof extraQuestionSchema>;

/** What the AI proposes for a topic. Every field has a default the learner can change. */
export const learningOptionsSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().max(800),
  /** The language the learner wrote in; lessons use it by default. */
  language: z.string().min(2).max(40),
  audience: recommended(audienceId),
  level: recommended(levelId),
  duration: z.object({
    amount: z.number().int().min(1).max(365),
    unit: durationUnit,
    minutesPerSession: z.number().int().min(5).max(240),
    sessionsPerWeek: z.number().int().min(1).max(14),
    reason: z.string().max(400),
  }),
  /** Best first; the first is the default. */
  structures: z.array(recommended(structureId)).min(1).max(12),
  modes: z.array(recommended(modeId)).min(1).max(12),
  defaultModes: z.array(modeId).min(1),
  /** 0 = all theory, 100 = all practice. */
  theoryPractice: z.number().int().min(0).max(100),
  assessments: z.array(recommended(assessmentStyleId)).min(1).max(10),
  defaultAssessments: z.array(assessmentStyleId).min(1),
  teacher: recommended(personaId),
  extraQuestions: z.array(extraQuestionSchema).max(5),
});
export type LearningOptions = z.infer<typeof learningOptionsSchema>;

export const teacherVoiceSchema = z.object({
  /** Browser speech voice (SpeechSynthesisVoice.voiceURI); null = device default. */
  voiceURI: z.string().max(300).nullable(),
  rate: z.number().min(0.5).max(2),
  pitch: z.number().min(0).max(2),
});
export type TeacherVoice = z.infer<typeof teacherVoiceSchema>;

/** How the teacher's face looks (drawn in the app, animated while talking). */
export const TEACHER_SKINS = [
  '#F8D5B8',
  '#EBB896',
  '#C98E64',
  '#A26A42',
  '#7A4A2C',
  '#4E2F1C',
] as const;
export const TEACHER_HAIR = ['short', 'long', 'curly', 'bun', 'bald', 'hijab'] as const;
export const TEACHER_HAIR_COLORS = [
  '#1F1A17',
  '#5B3A21',
  '#C9A15B',
  '#A2442A',
  '#9CA3AF',
  '#4F46E5',
] as const;
export const TEACHER_OUTFITS = ['#6366F1', '#0EA5A4', '#E11D48', '#F59E0B', '#334155'] as const;
export const teacherLookSchema = z.object({
  skin: z.enum(TEACHER_SKINS),
  hair: z.enum(TEACHER_HAIR),
  hairColor: z.enum(TEACHER_HAIR_COLORS),
  glasses: z.boolean(),
  outfit: z.enum(TEACHER_OUTFITS),
});
export type TeacherLook = z.infer<typeof teacherLookSchema>;
export const DEFAULT_TEACHER_LOOK: TeacherLook = {
  skin: '#EBB896',
  hair: 'short',
  hairColor: '#5B3A21',
  glasses: false,
  outfit: '#6366F1',
};

/** What the learner chose. Drives every journey, lesson, chat and assessment. */
export const learningPreferencesSchema = z.object({
  audience: audienceId,
  level: levelId,
  duration: z.object({
    amount: z.number().int().min(1).max(365),
    unit: durationUnit,
  }),
  minutesPerSession: z.number().int().min(5).max(240),
  sessionsPerWeek: z.number().int().min(1).max(14),
  structure: structureId,
  modes: z.array(modeId).min(1).max(12),
  theoryPractice: z.number().int().min(0).max(100),
  assessments: z.array(assessmentStyleId).min(1).max(10),
  teacher: personaId,
  voice: teacherVoiceSchema,
  look: teacherLookSchema.default(DEFAULT_TEACHER_LOOK),
  language: z.string().trim().min(2).max(40),
  /** Answers to the AI's topic-specific questions, by question id. */
  extras: z.record(z.string(), z.array(z.string().max(80)).max(10)),
  /** Anything else, in the learner's words. */
  notes: z.string().max(2000),
});
export type LearningPreferences = z.infer<typeof learningPreferencesSchema>;

export const DEFAULT_TEACHER_VOICE: TeacherVoice = { voiceURI: null, rate: 1, pitch: 1 };

/** The AI's recommendations as a starting set of preferences. */
export function defaultPreferences(o: LearningOptions): LearningPreferences {
  return {
    audience: o.audience.id,
    level: o.level.id,
    duration: { amount: o.duration.amount, unit: o.duration.unit },
    minutesPerSession: o.duration.minutesPerSession,
    sessionsPerWeek: o.duration.sessionsPerWeek,
    structure: o.structures[0]!.id,
    modes: o.defaultModes,
    theoryPractice: o.theoryPractice,
    assessments: o.defaultAssessments,
    teacher: o.teacher.id,
    voice: DEFAULT_TEACHER_VOICE,
    look: DEFAULT_TEACHER_LOOK,
    language: o.language,
    extras: Object.fromEntries(o.extraQuestions.map((q) => [q.id, q.defaults])),
    notes: '',
  };
}

export const buildLearningSchema = z.object({ preferences: learningPreferencesSchema });
export type BuildLearningInput = z.infer<typeof buildLearningSchema>;

export const updateLearningSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  preferences: learningPreferencesSchema.optional(),
});
export type UpdateLearningInput = z.infer<typeof updateLearningSchema>;

// ───────────────────────── Journey ─────────────────────────

export const StepKind = z.enum([
  'lesson',
  'practice',
  'project',
  'review',
  'assessment',
  'milestone',
]);
export type StepKind = z.infer<typeof StepKind>;

export const StepStatus = z.enum(['todo', 'in_progress', 'done']);
export type StepStatus = z.infer<typeof StepStatus>;

export interface JourneyStep {
  id: string;
  /** Short stable id inside the learning (used by the AI to refer to steps). */
  key: string;
  title: string;
  summary: string;
  kind: StepKind;
  /** Level, cluster, week, chapter, branch or column — depends on the journey shape. */
  group: string | null;
  /** Parent step key for tree and mind-map shapes. */
  parentKey: string | null;
  dependsOn: string[];
  position: number;
  minutes: number;
  mode: LearningModeId | null;
  assessmentStyle: AssessmentStyleId | null;
  status: StepStatus;
  hasLesson: boolean;
  completedAt: string | null;
}

type LearningModeId = z.infer<typeof modeId>;
type AssessmentStyleId = z.infer<typeof assessmentStyleId>;

export interface LearningSummary {
  id: string;
  title: string;
  topic: string;
  status: LearningStatus;
  structure: string | null;
  progress: { done: number; total: number };
  /** The step to do next (in progress first, then the first one to do). */
  next: { id: string; title: string; minutes: number } | null;
  updatedAt: string;
}

export interface LearningDetail extends LearningSummary {
  description: string | null;
  options: LearningOptions | null;
  preferences: LearningPreferences | null;
  /** The AI's short introduction to the journey. */
  overview: string | null;
  error: string | null;
  steps: JourneyStep[];
  canUndo: boolean;
  lastChange: string | null;
  createdAt: string;
  /** Set while the AI is working on this learning (options or journey). */
  live: LiveStatus | null;
}

/** Something the AI has decided, read from its answer while it is writing. */
export interface LiveFinding {
  label: string;
  value: string;
}

/** What the AI is doing right now for a learning — shown to the learner as it happens. */
export interface LiveStatus {
  phase: 'options' | 'journey';
  /** waiting: request sent, nothing back yet · writing: answer arriving · fixing: retrying a bad answer · saving */
  stage: 'waiting' | 'writing' | 'fixing' | 'saving';
  model: string | null;
  startedAt: string;
  /** Characters of the answer received so far. */
  received: number;
  findings: LiveFinding[];
  /** Journey phase: the step titles written so far. */
  steps: string[];
  groups: string[];
}

/** One entry in a learning's history: a change to the plan or something the learner did. */
export interface HistoryEntry {
  id: string;
  kind: 'change' | 'activity';
  text: string;
  xp: number;
  createdAt: string;
}

export const updateStepSchema = z.object({ status: StepStatus });
export type UpdateStepInput = z.infer<typeof updateStepSchema>;

/** A real picture found for a lesson (Wikimedia Commons), with its credit. */
export interface LessonImage {
  url: string;
  thumbUrl: string;
  title: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

export interface LessonContent {
  markdown: string;
  keyPoints: string[];
  generatedAt: string;
  /** Pictures-and-diagrams mode: real photos. Diagrams are ```mermaid blocks in the markdown. */
  images?: LessonImage[];
}

/** A slide of a narrated slideshow. */
export interface Slide {
  title: string;
  bullets: string[];
  /** What the teacher says on this slide. */
  narration: string;
  /** Optional Mermaid diagram. */
  diagram?: string;
}

/** Mini-games for a step. Answers are included: games are practice, not assessment. */
export interface GameSet {
  pairs: { left: string; right: string }[];
  order: { prompt: string; items: string[] } | null;
  truths: { statement: string; answer: boolean; why: string }[];
  /** Categories with the items that belong to each (missing in older game sets). */
  groups?: { name: string; items: string[] }[];
}

/** Extra media for a step, generated on demand. */
export interface StepMedia {
  slides?: Slide[];
  games?: GameSet;
}

export const gameResultSchema = z.object({
  score: z.number().int().min(0).max(100),
});
export type GameResultInput = z.infer<typeof gameResultSchema>;

export interface StepDetail {
  learning: { id: string; title: string; preferences: LearningPreferences | null };
  step: JourneyStep;
  lesson: LessonContent | null;
  media: StepMedia;
  previous: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

export const generateLessonSchema = z.object({
  /** e.g. "simpler", "more examples" — applied when regenerating. */
  instruction: z.string().trim().max(500).optional(),
});
export type GenerateLessonInput = z.infer<typeof generateLessonSchema>;

// ───────────────────────── Conversations ─────────────────────────

/**
 * coach: the learning's planning chat (can change the journey);
 * tutor: chat about a step; voice: spoken lesson about a step; debate: argue about a step.
 */
export const ConversationKind = z.enum(['coach', 'tutor', 'voice', 'debate', 'simulation']);
export type ConversationKind = z.infer<typeof ConversationKind>;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Changes the AI applied to the learning in response (coach only). */
  changes: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  kind: ConversationKind;
  learningId: string;
  stepId: string | null;
  messages: ChatMessage[];
}

export const openConversationSchema = z.object({
  kind: ConversationKind,
  stepId: z.uuid().optional(),
});
export type OpenConversationInput = z.infer<typeof openConversationSchema>;

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export interface SendMessageResult {
  message: ChatMessage;
  /** True when the reply changed the learning (refetch it). */
  learningChanged: boolean;
}

/**
 * Events of a streamed AI response (server-sent events, one JSON object per `data:` line).
 * delta: more text · status: what the server is doing now · done: the final result · error.
 */
export type StreamEvent<T> =
  | { type: 'delta'; text: string }
  | { type: 'status'; text: string }
  | { type: 'done'; result: T }
  | { type: 'error'; error: { code: string; message: string; details?: unknown } };

// ───────────────────────── Assessments ─────────────────────────

export const QuestionType = z.enum([
  'choice',
  'text',
  'task',
  'spoken',
  'flashcard',
  /** Match each left item to a right item. Answer: JSON array of right indexes, by left. */
  'match',
  /** Put items in the right order. Answer: JSON array of item indexes. */
  'order',
  /** A longer talk, recorded and transcribed. */
  'presentation',
]);
export type QuestionType = z.infer<typeof QuestionType>;

/** As sent to the learner: no answers or rubrics. */
export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  /** Flashcards only: the back of the card. */
  back?: string;
  /** Match: the right-hand items (shuffled). `options` holds the left-hand items. */
  right?: string[];
  /** A Mermaid diagram the question is about. */
  diagram?: string;
  /** A picture the question is about. */
  image?: LessonImage;
}

export interface QuestionResult {
  questionId: string;
  score: number;
  feedback: string;
  correctAnswer: string | null;
}

export interface AssessmentResult {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questions: QuestionResult[];
}

export const AssessmentStatus = z.enum(['open', 'grading', 'graded', 'failed']);
export type AssessmentStatus = z.infer<typeof AssessmentStatus>;

export interface AssessmentSummary {
  id: string;
  learningId: string;
  stepId: string | null;
  style: AssessmentStyleId;
  title: string;
  status: AssessmentStatus;
  score: number | null;
  createdAt: string;
}

export interface AssessmentDetail extends AssessmentSummary {
  instructions: string;
  questions: AssessmentQuestion[];
  answers: Record<string, string>;
  result: AssessmentResult | null;
  /** Debate assessments happen in a conversation. */
  conversationId: string | null;
  error: string | null;
}

export const createAssessmentSchema = z.object({
  style: assessmentStyleId.optional(),
  stepId: z.uuid().optional(),
  focus: z.string().trim().max(500).optional(),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const submitAssessmentSchema = z.object({
  answers: z.record(z.string(), z.string().max(8000)),
});
export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;

const TITLE_FILLER =
  /^(?:(?:mastering|master|learning|learn|exploring|explore|discovering|discover|understanding|unlocking|unlock|demystifying|conquering|embracing)\s+(?:the\s+)?(?:art\s+of\s+|basics\s+of\s+|world\s+of\s+|fundamentals\s+of\s+)?|(?:an?\s+)?(?:introduction|intro|beginner[’']?s\s+guide|complete\s+guide|guide|journey)\s+(?:in)?to\s+(?:the\s+)?|getting\s+started\s+with\s+|(?:the\s+)?(?:art|basics|fundamentals|essentials|world)\s+of\s+|your\s+)/i;
const TITLE_TAIL =
  /\s+(?:for\s+(?:absolute\s+)?beginners|made\s+easy|101|basics|essentials|fundamentals|adventure|journey)$/i;

/**
 * A learning's name as the learner would say it: "Mastering Photosynthesis: How Plants
 * Make Food" → "Photosynthesis". Drops quotes, subtitles and filler words.
 */
export function shortTitle(title: string): string {
  const original = title.trim();
  let t = original.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
  t = t.split(/\s*[:|]\s+|\s+[—–-]\s+/)[0]!.trim();
  for (let i = 0; i < 2; i++) t = t.replace(TITLE_FILLER, '').trim();
  t = t
    .replace(TITLE_TAIL, '')
    .replace(/[!.?…]+$/, '')
    .trim();
  if (t.length < 2) return original;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** The app guide: a helper on every screen that knows where the learner is. */
export const guideRequestSchema = z.object({
  /** What the learner is looking at, e.g. "Settings → AI" or "Step 'Chords' of Guitar". */
  page: z.string().trim().max(600),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});
export type GuideRequest = z.infer<typeof guideRequestSchema>;
