import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_STYLES,
  JOURNEY_STRUCTURES,
  LEARNING_MODES,
  defaultPreferences,
  learningPreferencesSchema,
  shortTitle,
  type LearningOptions,
} from './index.js';

describe('catalogs', () => {
  it('offers at least ten journey shapes, all usable', () => {
    expect(JOURNEY_STRUCTURES.length).toBeGreaterThanOrEqual(10);
    expect(JOURNEY_STRUCTURES.every((s) => s.available)).toBe(true);
  });

  it('offers every way of learning and every assessment style', () => {
    const available = (list: readonly { id: string; available: boolean }[]) =>
      list.filter((e) => e.available).map((e) => e.id);
    expect(available(LEARNING_MODES)).toEqual(
      expect.arrayContaining(['reading', 'chat', 'voice', 'debate']),
    );
    // Simulations were removed from the choices (old learnings that chose them still load).
    expect(available(LEARNING_MODES)).toEqual(
      LEARNING_MODES.map((m) => m.id).filter((id) => id !== 'simulations'),
    );
    expect(available(ASSESSMENT_STYLES)).toHaveLength(ASSESSMENT_STYLES.length);
  });

  it('ids are unique', () => {
    for (const list of [JOURNEY_STRUCTURES, LEARNING_MODES, ASSESSMENT_STYLES]) {
      expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
    }
  });
});

describe('defaultPreferences', () => {
  it('turns the AI’s recommendations into valid preferences', () => {
    const options: LearningOptions = {
      title: 'Fractions',
      summary: '',
      language: 'English',
      audience: { id: 'child', reason: '' },
      level: { id: 'basics', reason: '' },
      duration: { amount: 3, unit: 'weeks', minutesPerSession: 15, sessionsPerWeek: 5, reason: '' },
      structures: [{ id: 'quest', reason: '' }],
      modes: [{ id: 'stories', reason: '' }],
      defaultModes: ['stories', 'voice'],
      theoryPractice: 70,
      assessments: [{ id: 'quiz', reason: '' }],
      defaultAssessments: ['quiz'],
      teacher: { id: 'buddy', reason: '' },
      extraQuestions: [
        {
          id: 'year',
          label: 'School year',
          multiple: false,
          options: ['Year 3', 'Year 4'],
          defaults: ['Year 4'],
        },
      ],
    };
    const prefs = defaultPreferences(options);
    expect(learningPreferencesSchema.safeParse(prefs).success).toBe(true);
    expect(prefs).toMatchObject({
      structure: 'quest',
      audience: 'child',
      extras: { year: ['Year 4'] },
    });
  });
});

describe('shortTitle', () => {
  it.each([
    ['Mastering Photosynthesis: How Plants Make Food', 'Photosynthesis'],
    ['“Spanish for Travelling”', 'Spanish for Travelling'],
    ['An Introduction to Machine Learning', 'Machine Learning'],
    ['The Art of Watercolour Painting', 'Watercolour Painting'],
    ['Python for Beginners', 'Python'],
    ['Chess — from first moves to checkmate', 'Chess'],
    ['Learn Japanese!', 'Japanese'],
    ['Fractions', 'Fractions'],
    ['Learning', 'Learning'],
  ])('%s → %s', (input, out) => expect(shortTitle(input)).toBe(out));
});
