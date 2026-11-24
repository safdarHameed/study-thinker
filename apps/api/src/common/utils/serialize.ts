/** Helpers for mapping Prisma rows to API contracts. */

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** `@db.Date` columns are serialised as `YYYY-MM-DD`. */
export const isoDate = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

export const toDate = (s: string | null | undefined): Date | null | undefined =>
  s === undefined ? undefined : s === null ? null : new Date(s);

export const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 140) || 'item'
  );
}
