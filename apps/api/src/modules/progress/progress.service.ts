import { Injectable, Logger } from '@nestjs/common';
import {
  ACTIVITY_XP,
  type ActivityEntry,
  type ActivityKind,
  BADGES,
  type HistoryEntry,
  type LearnerProgress,
  learningPreferencesSchema,
  levelFor,
  xpForLevel,
} from '@studythinker/shared';
import type { Activity } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface RecordInput {
  kind: ActivityKind;
  label: string;
  learningId?: string | null;
  ref?: string;
  /** Overrides the default XP for this kind. */
  xp?: number;
  value?: number;
  /** Reward only once per `ref` ever, or once per `ref` in the last 20 hours. */
  once?: 'ever' | 'day';
}

const DAY = 86_400_000;

/** Validates an IANA time zone name; falls back to UTC. */
export function safeTimeZone(tz: string | undefined) {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD of `date` in `tz`. */
export function localDay(date: Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

/** Current streak (ending today or yesterday) and best streak, from a set of active days. */
export function streaks(days: Set<string>, today: string) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  const reached = new Map<number, string>();
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    if (!reached.has(run)) reached.set(run, day);
    prev = day;
  }
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best, reached };
}

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records an activity. Never throws: a missed reward must not break learning. */
  async record(userId: string, input: RecordInput): Promise<void> {
    try {
      if (input.once && input.ref) {
        const since = input.once === 'day' ? new Date(Date.now() - 20 * 3_600_000) : undefined;
        const seen = await this.prisma.activity.findFirst({
          where: {
            userId,
            kind: input.kind,
            ref: input.ref,
            ...(since ? { createdAt: { gte: since } } : {}),
          },
          select: { id: true },
        });
        if (seen) return;
      }
      await this.prisma.activity.create({
        data: {
          userId,
          learningId: input.learningId ?? null,
          kind: input.kind,
          ref: input.ref ?? null,
          label: input.label.slice(0, 200),
          xp: input.xp ?? ACTIVITY_XP[input.kind],
          value: input.value ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not record activity: ${(err as Error).message}`);
    }
  }

  async progress(userId: string, timeZone?: string): Promise<LearnerProgress> {
    const tz = safeTimeZone(timeZone);
    const [activities, learnings, questions] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kind: true,
          label: true,
          xp: true,
          value: true,
          learningId: true,
          createdAt: true,
        },
      }),
      this.prisma.learning.findMany({
        where: { userId, status: 'READY' },
        select: { preferences: true },
      }),
      this.prisma.message.findMany({
        where: { role: 'user', conversation: { kind: { not: 'coach' }, learning: { userId } } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
        skip: 9,
        take: 1,
      }),
    ]);

    const xp = activities.reduce((n, a) => n + a.xp, 0);
    const level = levelFor(xp);
    const now = new Date();
    const today = localDay(now, tz);
    const days = new Set(activities.map((a) => localDay(a.createdAt, tz)));
    const { current, best, reached } = streaks(days, today);

    // This week, Monday first.
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = addDays(today, -weekday);
    const week = Array.from({ length: 7 }, (_, i) => days.has(addDays(monday, i)));

    const goals = learnings
      .map((l) => learningPreferencesSchema.safeParse(l.preferences))
      .filter((r) => r.success)
      .map((r) => r.data.sessionsPerWeek);
    const weekGoal = Math.min(7, Math.max(1, goals.length ? Math.max(...goals) : 3));

    // When each badge was earned (the moment its threshold was reached).
    const nth = (
      kinds: string[],
      n: number,
      filter: (a: (typeof activities)[number]) => boolean = () => true,
    ) => activities.filter((a) => kinds.includes(a.kind) && filter(a))[n - 1]?.createdAt ?? null;
    const dayAt = (d: string | undefined) => (d ? new Date(`${d}T12:00:00Z`) : null);
    const earned: Record<string, Date | null> = {
      'first-step': nth(['step_done'], 1),
      'on-a-roll': nth(['step_done'], 5),
      unstoppable: nth(['step_done'], 25),
      'streak-3': dayAt(reached.get(3)),
      'streak-7': dayAt(reached.get(7)),
      'streak-30': dayAt(reached.get(30)),
      curious: questions[0]?.createdAt ?? null,
      voice: nth(['voice'], 1),
      debater: nth(['debate'], 1),
      player: nth(['game'], 1),
      tested: nth(['assessment_done'], 1),
      perfect: nth(['assessment_done'], 1, (a) => a.value === 100),
      finisher: nth(['journey_finished'], 1),
      explorer: nth(['learning_created'], 3),
    };

    return {
      xp,
      level,
      levelFloor: xpForLevel(level),
      levelCeil: xpForLevel(level + 1),
      streak: current,
      bestStreak: best,
      learnedToday: days.has(today),
      week,
      weekGoal,
      badges: BADGES.map((b) => ({ id: b.id, earnedAt: earned[b.id]?.toISOString() ?? null })),
      recent: activities.slice(-12).reverse().map(toEntry),
    };
  }

  /** Changes to the plan and things the learner did, newest first. */
  async history(learningId: string): Promise<HistoryEntry[]> {
    const [activities, revisions] = await Promise.all([
      this.prisma.activity.findMany({
        where: { learningId },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      this.prisma.revision.findMany({
        where: { learningId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, summary: true, createdAt: true },
      }),
    ]);
    return [
      ...activities.map((a) => ({
        id: a.id,
        kind: 'activity' as const,
        text: a.label,
        xp: a.xp,
        createdAt: a.createdAt.toISOString(),
      })),
      ...revisions.map((r) => ({
        id: r.id,
        kind: 'change' as const,
        text: r.summary,
        xp: 0,
        createdAt: r.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60);
  }
}

function toEntry(
  a: Pick<Activity, 'id' | 'kind' | 'label' | 'xp' | 'learningId' | 'createdAt'>,
): ActivityEntry {
  return {
    id: a.id,
    kind: a.kind as ActivityKind,
    label: a.label,
    xp: a.xp,
    learningId: a.learningId,
    createdAt: a.createdAt.toISOString(),
  };
}
