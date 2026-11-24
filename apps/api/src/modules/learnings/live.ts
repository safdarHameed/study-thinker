/**
 * Reads what the AI has written so far (an unfinished JSON answer) so the
 * learner can watch real progress: the choices it is making, the steps it is
 * drafting. Nothing here is invented — every line comes from the answer itself.
 */
import {
  ASSESSMENT_STYLES,
  AUDIENCES,
  type CatalogEntry,
  catalogLabel,
  JOURNEY_STRUCTURES,
  LEARNING_MODES,
  type LiveFinding,
  STARTING_LEVELS,
  TEACHER_PERSONAS,
} from '@studythinker/shared';

const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;

function decode(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

/** Every complete string value of `field`, in order. */
export function stringsOf(text: string, field: string): string[] {
  const re = new RegExp(String.raw`"${field}"\s*:\s*${STRING}`, 'g');
  return [...text.matchAll(re)].map((m) => decode(m[1]!).trim()).filter(Boolean);
}

/**
 * The value of a string field, even if the AI is still writing it.
 * Used to stream the coach's `reply` out of its JSON answer.
 */
export function partialString(text: string, field: string): string | null {
  const m = new RegExp(String.raw`"${field}"\s*:\s*"`).exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  let raw = '';
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '\\') {
      if (i + 1 >= text.length) break; // escape not finished yet
      if (text[i + 1] === 'u' && i + 6 > text.length) break;
      const len = text[i + 1] === 'u' ? 6 : 2;
      raw += text.slice(i, i + len);
      i += len;
      continue;
    }
    if (ch === '"') break;
    raw += ch;
    i++;
  }
  return decode(raw);
}

/** The text of a JSON array that starts at `"field": [` (unfinished arrays included). */
function arrayAfter(text: string, field: string): string | null {
  const m = new RegExp(String.raw`"${field}"\s*:\s*\[`).exec(text);
  if (!m) return null;
  let depth = 1;
  let inString = false;
  const start = m.index + m[0].length;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i);
    }
  }
  return text.slice(start);
}

function idOf(text: string, field: string): string | null {
  const m = new RegExp(String.raw`"${field}"\s*:\s*\{[^}]*?"id"\s*:\s*"([\w-]+)"`).exec(text);
  return m?.[1] ?? null;
}

function idsIn(list: string | null): string[] {
  if (!list) return [];
  return [...list.matchAll(/"id"\s*:\s*"([\w-]+)"/g)].map((m) => m[1]!);
}

function labels(catalog: readonly CatalogEntry<string>[], ids: string[]) {
  const known = ids.filter((id) => catalog.some((c) => c.id === id));
  return [...new Set(known)].map((id) => catalogLabel(catalog, id)).join(', ');
}

/** What the AI has decided so far while proposing options for a topic. */
export function optionsFindings(text: string): LiveFinding[] {
  const out: LiveFinding[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) out.push({ label, value });
  };
  add('Title', stringsOf(text, 'title')[0]);
  const audience = idOf(text, 'audience');
  if (audience && AUDIENCES.some((a) => a.id === audience))
    add('Who it suits', catalogLabel(AUDIENCES, audience));
  const level = idOf(text, 'level');
  if (level && STARTING_LEVELS.some((l) => l.id === level))
    add('Starting point', catalogLabel(STARTING_LEVELS, level));
  const amount = /"amount"\s*:\s*(\d+)/.exec(text)?.[1];
  const unit = /"unit"\s*:\s*"(\w+)"/.exec(text)?.[1];
  if (amount && unit) add('How long', `${amount} ${unit}`);
  add('Journey shapes', labels(JOURNEY_STRUCTURES, idsIn(arrayAfter(text, 'structures'))));
  add('Ways of learning', labels(LEARNING_MODES, idsIn(arrayAfter(text, 'modes'))));
  add('Assessments', labels(ASSESSMENT_STYLES, idsIn(arrayAfter(text, 'assessments'))));
  const teacher = idOf(text, 'teacher');
  if (teacher && TEACHER_PERSONAS.some((t) => t.id === teacher))
    add('Teacher', catalogLabel(TEACHER_PERSONAS, teacher));
  const extras = stringsOf(arrayAfter(text, 'extraQuestions') ?? '', 'label');
  add('Questions for you', extras.join(' · '));
  return out;
}

/** The step titles the AI has written so far while designing a journey. */
export function journeyFindings(text: string): { steps: string[]; groups: string[] } {
  const list = arrayAfter(text, 'steps') ?? '';
  return {
    steps: stringsOf(list, 'title').slice(0, 200),
    groups: [...new Set(stringsOf(list, 'group'))].slice(0, 50),
  };
}
