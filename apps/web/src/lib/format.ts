/** Small, dependency-free formatting helpers. Date helpers are for client components. */

const LABEL_OVERRIDES: Record<string, string> = {
  NONE: 'Just starting',
  SELF_TAUGHT: 'Self-taught',
  CHECK_FOR_UNDERSTANDING: 'Check your understanding',
  SPACED_REVIEW: 'Spaced review',
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  AI_GENERATED: 'AI generated',
  LEARNER_CREATED: 'Created by you',
  WORKED_EXAMPLES: 'Worked examples',
  TRUE_FALSE: 'True or false',
  FILL_IN_BLANK: 'Fill in the blank',
};

/** `IN_PROGRESS` → `In progress`. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  if (LABEL_OVERRIDES[value]) return LABEL_OVERRIDES[value];
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatPercent(value: number | null | undefined, { fraction = true } = {}): string {
  if (value == null || Number.isNaN(value)) return '—';
  const pct = fraction ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

/** API percentages may be 0–1 or 0–100; normalise to 0–100. */
export function toPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return value <= 1 ? value * 100 : value;
}

export function formatDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function formatTime(iso: string): string {
  return formatDate(iso, { hour: 'numeric', minute: '2-digit' });
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Monday-based start of week (local time). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Value for `<input type="datetime-local">` in local time. */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
