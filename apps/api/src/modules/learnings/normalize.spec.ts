import { defaultPreferences, type LearningPreferences } from '@studythinker/shared';
import { describe, expect, it } from 'vitest';
import {
  mergePreferences,
  normalizeOptions,
  normalizeSteps,
  rawOptionsSchema,
  rawStepSchema,
} from './normalize.js';
import { splitKeyPoints } from './prompts.js';

const sloppyOptions = {
  title: 'Guitar',
  summary: 'Play songs',
  audience: 'ADULT',
  level: { id: 'new', reason: 'beginner' },
  duration: { amount: '6', unit: 'weeks', minutesPerSession: 1000, sessionsPerWeek: 3 },
  structures: [{ id: 'quest', reason: 'fun' }, 'ladder', { id: 'not-a-shape' }, { id: 'quest' }],
  modes: [{ id: 'practice' }, { id: 'telepathy', reason: 'unknown' }, { id: 'voice' }],
  defaultModes: ['practice', 'telepathy', 'voice'],
  theoryPractice: 'eighty',
  assessments: [{ id: 'practical' }],
  defaultAssessments: [],
  teacher: { id: 'unknown' },
  extraQuestions: [
    {
      id: 'Music Style',
      label: 'Which style?',
      multiple: false,
      options: ['Pop', 'Rock'],
      defaults: ['Jazz'],
    },
    { label: 'Too few options', options: ['Only one'] },
  ],
};

function options() {
  return normalizeOptions(rawOptionsSchema.parse(sloppyOptions), 'Guitar');
}

describe('normalizeOptions', () => {
  it('keeps valid, available choices in the AI’s order and drops the rest', () => {
    const o = options();
    expect(o.structures.map((s) => s.id).slice(0, 2)).toEqual(['quest', 'ladder']);
    expect(o.structures.some((s) => (s.id as string) === 'not-a-shape')).toBe(false);
    // Unknown ways of learning can't be recommended or pre-selected.
    expect(o.modes.map((m) => m.id)).not.toContain('telepathy');
    expect(o.defaultModes).toEqual(['practice', 'voice']);
  });

  it('fills sensible defaults and clamps numbers', () => {
    const o = options();
    expect(o.audience.id).toBe('adult');
    expect(o.teacher.id).toBe('friendly');
    expect(o.duration.amount).toBe(6);
    expect(o.duration.minutesPerSession).toBe(240);
    expect(o.theoryPractice).toBe(50);
    expect(o.defaultAssessments.length).toBeGreaterThan(0);
    expect(o.language).toBe('English');
  });

  it('cleans topic-specific questions', () => {
    const o = options();
    expect(o.extraQuestions).toHaveLength(1);
    expect(o.extraQuestions[0]).toMatchObject({ id: 'music_style', defaults: ['Pop'] });
  });
});

describe('normalizeSteps', () => {
  const prefs: LearningPreferences = {
    ...defaultPreferences(options()),
    modes: ['reading', 'voice'],
    assessments: ['quiz'],
  };

  it('makes keys unique, resolves references and only uses the learner’s styles', () => {
    const raw = [
      { key: 'Intro', title: 'Intro', kind: 'lesson', mode: 'images' },
      { key: 'intro', title: 'Intro again', dependsOn: ['Intro', 'missing'], parentKey: 'intro' },
      { title: 'Check', kind: 'assessment', assessmentStyle: 'debate', minutes: '15' },
      { title: '' },
    ].map((s) => rawStepSchema.parse(s));
    const steps = normalizeSteps(raw, prefs);
    expect(steps.map((s) => s.key)).toEqual(['intro', 'intro-2', 'check']);
    expect(steps[0]!.mode).toBe('reading');
    expect(steps[1]!.dependsOn).toEqual(['intro']);
    expect(steps[1]!.parentKey).toBe('intro');
    expect(steps[2]).toMatchObject({
      kind: 'assessment',
      assessmentStyle: 'quiz',
      minutes: 15,
      mode: null,
    });
  });

  it('avoids keys already used in the journey', () => {
    const steps = normalizeSteps(
      [rawStepSchema.parse({ key: 'intro', title: 'Intro' })],
      prefs,
      new Set(['intro']),
    );
    expect(steps[0]!.key).toBe('intro-2');
  });
});

describe('mergePreferences', () => {
  const prefs = defaultPreferences(options());

  it('applies valid fields and ignores invalid ones', () => {
    const next = mergePreferences(prefs, {
      duration: { amount: 2 },
      structure: 'tree',
      modes: ['not-a-mode'],
      hacker: true,
    });
    expect(next?.duration).toEqual({ amount: 2, unit: prefs.duration.unit });
    expect(next?.structure).toBe('tree');
    expect(next?.modes).toEqual(prefs.modes);
    expect(next).not.toHaveProperty('hacker');
  });

  it('returns null when nothing changes', () => {
    expect(mergePreferences(prefs, { structure: prefs.structure })).toBeNull();
    expect(mergePreferences(prefs, 'nonsense')).toBeNull();
  });
});

describe('splitKeyPoints', () => {
  it('separates the key points section', () => {
    const r = splitKeyPoints('# Lesson\n\nBody\n\n## Key points\n\n- One\n- Two\n');
    expect(r.markdown).toBe('# Lesson\n\nBody');
    expect(r.keyPoints).toEqual(['One', 'Two']);
  });

  it('keeps lessons without key points intact', () => {
    expect(splitKeyPoints('Just text')).toEqual({ markdown: 'Just text', keyPoints: [] });
  });
});
