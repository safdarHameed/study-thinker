/**
 * Models don't always follow instructions exactly. These loose schemas accept
 * what they typically send, and the normalisers turn it into strict data
 * (unknown ids dropped, numbers clamped, sensible fallbacks).
 */
import {
  ASSESSMENT_STYLES,
  type AssessmentStyleId,
  AUDIENCES,
  JOURNEY_STRUCTURES,
  LEARNING_MODES,
  type LearningModeId,
  type LearningOptions,
  learningOptionsSchema,
  type LearningPreferences,
  learningPreferencesSchema,
  STARTING_LEVELS,
  TEACHER_PERSONAS,
  shortTitle,
} from '@studythinker/shared';
import { z } from 'zod';

const str = (max: number) =>
  z
    .unknown()
    .transform((v) =>
      typeof v === 'string'
        ? v.trim().slice(0, max)
        : typeof v === 'number' || typeof v === 'boolean'
          ? String(v).slice(0, max)
          : '',
    );
const num = z.unknown().transform((v) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
});
const rec = z.object({ id: str(40), reason: str(400).optional() }).passthrough();
const recList = z
  .array(z.union([rec, z.string().transform((id) => ({ id, reason: '' }))]))
  .catch([]);

const clamp = (n: number | null, min: number, max: number, fallback: number) =>
  n === null ? fallback : Math.min(max, Math.max(min, Math.round(n)));

const availableIds = (list: readonly { id: string; available: boolean }[]) =>
  new Set(list.filter((e) => e.available).map((e) => e.id));

function pickRanked<T extends string>(
  items: { id: string; reason?: string }[],
  allowed: Set<string>,
  fallback: T[],
) {
  const seen = new Set<string>();
  const out: { id: T; reason: string }[] = [];
  for (const it of items) {
    const id = it.id.toLowerCase();
    if (allowed.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push({ id: id as T, reason: (it.reason ?? '').slice(0, 400) });
    }
  }
  for (const id of fallback) if (!seen.has(id)) out.push({ id, reason: '' });
  return out;
}

// ───────────────────────── Options ─────────────────────────

export const rawOptionsSchema = z
  .object({
    title: str(120),
    summary: str(800),
    language: str(40).optional(),
    audience: z
      .union([rec, z.string().transform((id) => ({ id, reason: '' }))])
      .catch({ id: '', reason: '' }),
    level: z
      .union([rec, z.string().transform((id) => ({ id, reason: '' }))])
      .catch({ id: '', reason: '' }),
    duration: z
      .object({
        amount: num,
        unit: str(10),
        minutesPerSession: num,
        sessionsPerWeek: num,
        reason: str(400).optional(),
      })
      .partial()
      .catch({}),
    structures: recList,
    modes: recList,
    defaultModes: z.array(str(40)).catch([]),
    theoryPractice: num.optional(),
    assessments: recList,
    defaultAssessments: z.array(str(40)).catch([]),
    teacher: z
      .union([rec, z.string().transform((id) => ({ id, reason: '' }))])
      .catch({ id: '', reason: '' }),
    extraQuestions: z.array(z.unknown()).catch([]),
  })
  .passthrough();

export function normalizeOptions(
  raw: z.infer<typeof rawOptionsSchema>,
  topic: string,
): LearningOptions {
  const structures = pickRanked(raw.structures, availableIds(JOURNEY_STRUCTURES), [
    'path',
    'ladder',
    'clusters',
    'tree',
  ]);
  const modes = pickRanked<LearningModeId>(raw.modes, availableIds(LEARNING_MODES), [
    'reading',
    'chat',
    'practice',
  ]);
  const assessments = pickRanked<AssessmentStyleId>(
    raw.assessments,
    availableIds(ASSESSMENT_STYLES),
    ['quiz', 'written'],
  );
  const modeIds = new Set(modes.map((m) => m.id));
  const assessIds = new Set(assessments.map((a) => a.id));
  const defaultModes = [...new Set(raw.defaultModes.map((m) => m.toLowerCase()))].filter((m) =>
    modeIds.has(m as LearningModeId),
  ) as LearningModeId[];
  const defaultAssessments = [
    ...new Set(raw.defaultAssessments.map((m) => m.toLowerCase())),
  ].filter((m) => assessIds.has(m as AssessmentStyleId)) as AssessmentStyleId[];
  const unit = ['days', 'weeks', 'months'].includes(raw.duration.unit ?? '')
    ? raw.duration.unit
    : 'weeks';
  const pick = (list: readonly { id: string }[], id: string, fallback: string) =>
    list.some((e) => e.id === id.toLowerCase()) ? id.toLowerCase() : fallback;

  const extraQuestions = raw.extraQuestions
    .map((q) => {
      const r = z
        .object({
          id: str(40),
          label: str(120),
          help: str(300).optional(),
          multiple: z.unknown().transform(Boolean),
          options: z.array(str(80)).catch([]),
          defaults: z.array(str(80)).catch([]),
        })
        .safeParse(q);
      if (!r.success) return null;
      const options = [...new Set(r.data.options.filter(Boolean))].slice(0, 10);
      if (options.length < 2 || !r.data.label) return null;
      const id =
        (r.data.id || r.data.label)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 40) || 'q';
      const defaults = r.data.defaults.filter((d) => options.includes(d));
      return {
        id,
        label: r.data.label,
        ...(r.data.help ? { help: r.data.help } : {}),
        multiple: r.data.multiple,
        options,
        defaults: defaults.length
          ? r.data.multiple
            ? defaults
            : defaults.slice(0, 1)
          : [options[0]!],
      };
    })
    .filter((q) => q !== null)
    .filter((q, i, all) => all.findIndex((o) => o.id === q.id) === i)
    .slice(0, 5);

  return learningOptionsSchema.parse({
    title: shortTitle(raw.title || topic).slice(0, 120),
    summary: raw.summary,
    language: raw.language || 'English',
    audience: { id: pick(AUDIENCES, raw.audience.id, 'adult'), reason: raw.audience.reason ?? '' },
    level: { id: pick(STARTING_LEVELS, raw.level.id, 'new'), reason: raw.level.reason ?? '' },
    duration: {
      amount: clamp(raw.duration.amount ?? null, 1, 365, 4),
      unit,
      minutesPerSession: clamp(raw.duration.minutesPerSession ?? null, 5, 240, 30),
      sessionsPerWeek: clamp(raw.duration.sessionsPerWeek ?? null, 1, 14, 3),
      reason: raw.duration.reason ?? '',
    },
    structures,
    modes,
    defaultModes: defaultModes.length ? defaultModes : modes.slice(0, 3).map((m) => m.id),
    theoryPractice: clamp(raw.theoryPractice ?? null, 0, 100, 50),
    assessments,
    defaultAssessments: defaultAssessments.length
      ? defaultAssessments
      : assessments.slice(0, 2).map((a) => a.id),
    teacher: {
      id: pick(TEACHER_PERSONAS, raw.teacher.id, 'friendly'),
      reason: raw.teacher.reason ?? '',
    },
    extraQuestions,
  });
}

// ───────────────────────── Journey ─────────────────────────

const KINDS = ['lesson', 'practice', 'project', 'review', 'assessment', 'milestone'] as const;

export const rawStepSchema = z
  .object({
    key: str(40).optional(),
    title: str(160),
    summary: str(1000).optional(),
    kind: str(20).optional(),
    group: str(120).nullable().optional(),
    parentKey: str(40).nullable().optional(),
    dependsOn: z.array(str(40)).catch([]).optional(),
    minutes: num.optional(),
    mode: str(20).nullable().optional(),
    assessmentStyle: str(20).nullable().optional(),
  })
  .passthrough();

export const rawJourneySchema = z
  .object({
    title: str(120).optional(),
    overview: str(1500).optional(),
    steps: z.array(rawStepSchema).min(1),
  })
  .passthrough();

export interface StepDraft {
  key: string;
  title: string;
  summary: string;
  kind: (typeof KINDS)[number];
  group: string | null;
  parentKey: string | null;
  dependsOn: string[];
  minutes: number;
  mode: LearningModeId | null;
  assessmentStyle: AssessmentStyleId | null;
}

export const slugKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** Unique keys, valid references, only modes/assessments the learner chose. */
export function normalizeSteps(
  raw: z.infer<typeof rawStepSchema>[],
  prefs: LearningPreferences,
  reservedKeys: Set<string> = new Set(),
): StepDraft[] {
  const used = new Set(reservedKeys);
  const drafts: StepDraft[] = [];
  const keyMap = new Map<string, string>();
  for (const [i, s] of raw.entries()) {
    if (!s.title) continue;
    let key = slugKey(s.key || s.title) || `step-${i + 1}`;
    const original = key;
    let n = 2;
    while (used.has(key)) key = `${original.slice(0, 36)}-${n++}`;
    used.add(key);
    // A repeated key refers to the first step that used it.
    if (s.key && !keyMap.has(slugKey(s.key))) keyMap.set(slugKey(s.key), key);
    const kind = (KINDS as readonly string[]).includes(s.kind ?? '')
      ? (s.kind as StepDraft['kind'])
      : 'lesson';
    const mode = prefs.modes.includes(s.mode as LearningModeId) ? (s.mode as LearningModeId) : null;
    const style = prefs.assessments.includes(s.assessmentStyle as AssessmentStyleId)
      ? (s.assessmentStyle as AssessmentStyleId)
      : null;
    drafts.push({
      key,
      title: s.title,
      summary: s.summary ?? '',
      kind,
      group: s.group || null,
      parentKey: s.parentKey ? slugKey(s.parentKey) : null,
      dependsOn: (s.dependsOn ?? []).map(slugKey),
      minutes: clamp(s.minutes ?? null, 5, 480, prefs.minutesPerSession),
      mode: mode ?? (kind === 'assessment' ? null : prefs.modes[i % prefs.modes.length]!),
      assessmentStyle:
        kind === 'assessment' ? (style ?? prefs.assessments[i % prefs.assessments.length]!) : null,
    });
  }
  const valid = new Set([...drafts.map((d) => d.key), ...reservedKeys]);
  const resolve = (k: string) => keyMap.get(k) ?? k;
  for (const d of drafts) {
    d.parentKey =
      d.parentKey && valid.has(resolve(d.parentKey)) && resolve(d.parentKey) !== d.key
        ? resolve(d.parentKey)
        : null;
    d.dependsOn = [...new Set(d.dependsOn.map(resolve))].filter((k) => valid.has(k) && k !== d.key);
  }
  return drafts;
}

/** Applies a partial preferences patch from the coach, keeping only valid fields. */
export function mergePreferences(
  current: LearningPreferences,
  patch: unknown,
): LearningPreferences | null {
  if (!patch || typeof patch !== 'object') return null;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (!(key in current)) continue;
    const candidate = { ...merged, [key]: value };
    if (key === 'duration' && value && typeof value === 'object')
      candidate.duration = { ...current.duration, ...(value as object) };
    if (key === 'voice' && value && typeof value === 'object')
      candidate.voice = { ...current.voice, ...(value as object) };
    if (learningPreferencesSchema.safeParse(candidate).success) Object.assign(merged, candidate);
  }
  const result = learningPreferencesSchema.parse(merged);
  return JSON.stringify(result) === JSON.stringify(current) ? null : result;
}
