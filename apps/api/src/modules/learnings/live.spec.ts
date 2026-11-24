import { describe, expect, it } from 'vitest';
import { streaks } from '../progress/progress.service.js';
import { journeyFindings, optionsFindings, partialString } from './live.js';

describe('reading an unfinished AI answer', () => {
  it('reports the options decided so far, using catalog names', () => {
    const partial =
      '{"title":"Fractions fun","audience":{"id":"child","reason":"x"},"duration":{"amount":3,"unit":"weeks"},' +
      '"structures":[{"id":"quest","reason":"a"},{"id":"ladder"';
    expect(optionsFindings(partial)).toEqual([
      { label: 'Title', value: 'Fractions fun' },
      { label: 'Who it suits', value: 'Child' },
      { label: 'How long', value: '3 weeks' },
      { label: 'Journey shapes', value: 'Quest map, Ladder' },
    ]);
  });

  it('ignores ids that are not in the catalogs', () => {
    const text = '{"modes":[{"id":"telepathy"},{"id":"voice"}]}';
    expect(optionsFindings(text)).toEqual([{ label: 'Ways of learning', value: 'Voice lessons' }]);
  });

  it('lists step titles as they are written, not the overall title', () => {
    const text =
      '{"title":"Guitar","overview":"x","steps":[{"key":"a","title":"Hold it","group":"Basics"},{"key":"b","title":"Tune \\"it\\"","group":"Basics"},{"key":"c","title":"Str';
    expect(journeyFindings(text)).toEqual({ steps: ['Hold it', 'Tune "it"'], groups: ['Basics'] });
  });

  it('streams a string field even while it is unfinished', () => {
    expect(partialString('{"reply":"Hel', 'reply')).toBe('Hel');
    expect(partialString('{"reply":"Line\\nTwo \\u00e9', 'reply')).toBe('Line\nTwo é');
    // An escape cut in half is held back.
    expect(partialString('{"reply":"Say \\', 'reply')).toBe('Say ');
    expect(partialString('{"actions":[]}', 'reply')).toBeNull();
  });
});

describe('streaks', () => {
  it('counts consecutive days ending today or yesterday', () => {
    const days = new Set(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-18', '2026-11-19']);
    expect(streaks(days, '2026-11-20')).toMatchObject({ current: 2, best: 3 });
    expect(streaks(days, '2026-11-22')).toMatchObject({ current: 0, best: 3 });
    expect(streaks(days, '2026-11-20').reached.get(3)).toBe('2026-11-12');
  });
});
