/** Lenient parsing of the AI's slides and games into strict, safe shapes. */
import type { GameSet, Slide } from '@studythinker/shared';
import { z } from 'zod';

const str = (max: number) =>
  z
    .unknown()
    .transform((v) =>
      typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '',
    );

const list = <T extends z.ZodType>(item: T) => z.array(item).catch([]).default([]);

export const rawSlidesSchema = z.object({
  slides: list(
    z.object({
      title: str(160),
      bullets: list(str(300)),
      narration: str(2000),
      diagram: str(2000).optional(),
    }),
  ),
});

export function normalizeSlides(raw: z.infer<typeof rawSlidesSchema>): Slide[] {
  return raw.slides
    .filter((s) => s.title && (s.narration || s.bullets.some(Boolean)))
    .slice(0, 12)
    .map((s) => ({
      title: s.title,
      bullets: s.bullets.filter(Boolean).slice(0, 6),
      narration: s.narration || s.bullets.join('. '),
      ...(s.diagram && /^(flowchart|graph|mindmap|timeline|sequenceDiagram)/.test(s.diagram)
        ? { diagram: s.diagram }
        : {}),
    }));
}

export const rawGamesSchema = z.object({
  pairs: list(z.object({ left: str(120), right: str(160) })),
  order: z
    .object({ prompt: str(300), items: list(str(160)) })
    .nullable()
    .catch(null)
    .default(null),
  truths: list(
    z.object({
      statement: str(300),
      answer: z.unknown().transform((v) => v === true || v === 'true' || v === 'True'),
      why: str(300),
    }),
  ),
  groups: list(z.object({ name: str(60), items: list(str(80)) })),
});

const unique = (items: string[]) =>
  new Set(items.map((i) => i.toLowerCase())).size === items.length;

export function normalizeGames(raw: z.infer<typeof rawGamesSchema>): GameSet {
  const pairs = raw.pairs.filter((p) => p.left && p.right).slice(0, 8);
  const items = raw.order?.items.filter(Boolean).slice(0, 8) ?? [];
  return {
    pairs: unique(pairs.map((p) => p.right)) && unique(pairs.map((p) => p.left)) ? pairs : [],
    order:
      raw.order && items.length >= 3 && unique(items)
        ? { prompt: raw.order.prompt || 'Put these in order', items }
        : null,
    truths: raw.truths.filter((t) => t.statement).slice(0, 10),
    groups: groupsOf(raw.groups),
  };
}

/** 2-3 categories of 2-5 items, with no item in two categories. */
function groupsOf(raw: { name: string; items: string[] }[]) {
  const seen = new Set<string>();
  const groups = raw
    .filter((g) => g.name)
    .slice(0, 3)
    .map((g) => ({
      name: g.name,
      items: g.items
        .filter((i) => i && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()))
        .slice(0, 5),
    }))
    .filter((g) => g.items.length >= 2);
  return groups.length >= 2 ? groups : [];
}

export function hasGames(g: GameSet) {
  return g.pairs.length >= 3 || !!g.order || g.truths.length >= 3 || (g.groups?.length ?? 0) >= 2;
}
