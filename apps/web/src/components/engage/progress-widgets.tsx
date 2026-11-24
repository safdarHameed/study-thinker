'use client';

import { type ActivityEntry, BADGES, type LearnerProgress } from '@studythinker/shared';
import { Flame, Lock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86_400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Level number in a ring that fills with XP towards the next level. */
export function LevelRing({ progress, size = 72 }: { progress: LearnerProgress; size?: number }) {
  const span = progress.levelCeil - progress.levelFloor;
  const pct = span ? (progress.xp - progress.levelFloor) / span : 0;
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="fill-none stroke-muted"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <p className="text-[0.6rem] font-semibold tracking-wider text-muted-foreground uppercase">
            Level
          </p>
          <p className="text-xl font-bold">{progress.level}</p>
        </div>
      </div>
    </div>
  );
}

export function StreakPill({ streak, today }: { streak: number; today: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold',
        streak > 0 ? 'bg-highlight-soft text-highlight' : 'bg-muted text-muted-foreground',
      )}
      title={today ? 'Learned today' : 'Learn today to keep it'}
    >
      <Flame className={cn('size-4', streak > 0 && today && 'fill-current')} aria-hidden />
      {streak} day{streak === 1 ? '' : 's'}
    </span>
  );
}

export function WeekDots({ progress }: { progress: LearnerProgress }) {
  const active = progress.week.filter(Boolean).length;
  const todayIndex = (new Date().getDay() + 6) % 7;
  return (
    <div>
      <div className="flex gap-1.5" aria-label={`${active} of ${progress.weekGoal} days this week`}>
        {progress.week.map((on, i) => (
          <span
            key={i}
            className={cn(
              'grid size-7 place-items-center rounded-full text-[0.7rem] font-semibold',
              on
                ? 'bg-primary text-primary-foreground'
                : i === todayIndex
                  ? 'border-2 border-dashed border-primary/50 text-primary'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {DAYS[i]}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {active >= progress.weekGoal
          ? `Goal reached 🎉`
          : `${active}/${progress.weekGoal} this week`}
      </p>
    </div>
  );
}

export function BadgeShelf({
  progress,
  compact = false,
}: {
  progress: LearnerProgress;
  compact?: boolean;
}) {
  const earned = new Map(progress.badges.map((b) => [b.id, b.earnedAt]));
  const list = compact ? BADGES.filter((b) => earned.get(b.id)) : BADGES;
  if (compact && !list.length) return null;
  return (
    <ul
      className={cn(
        'grid gap-2',
        compact ? 'grid-cols-6 sm:grid-cols-8' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-7',
      )}
    >
      {list.map((b) => {
        const at = earned.get(b.id);
        return (
          <li
            key={b.id}
            title={`${b.label} — ${b.description}${at ? '' : ' (not earned yet)'}`}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl p-2 text-center',
              !compact && 'border border-border bg-card',
              !at && 'opacity-50',
            )}
          >
            <span className={cn('relative text-2xl', !at && 'grayscale')} aria-hidden>
              {b.emoji}
              {!at && (
                <Lock className="absolute -right-1.5 -bottom-1 size-3.5 rounded-full bg-background p-0.5 text-muted-foreground" />
              )}
            </span>
            {!compact && <span className="text-xs leading-tight font-medium">{b.label}</span>}
            <span className="sr-only">{at ? 'earned' : 'not earned yet'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityFeed({ items, empty }: { items: ActivityEntry[]; empty?: string }) {
  if (!items.length)
    return <p className="text-sm text-muted-foreground">{empty ?? 'Nothing yet.'}</p>;
  return (
    <ol className="space-y-2.5">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-3 text-sm">
          <span className="mt-0.5 shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
            +{a.xp}
          </span>
          <span className="min-w-0 flex-1">{a.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}

export function XpSummary({ progress }: { progress: LearnerProgress }) {
  return (
    <div className="flex items-center gap-4">
      <LevelRing progress={progress} />
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            <Trophy className="size-4 text-highlight" aria-hidden /> {progress.xp} XP
          </span>
          <StreakPill streak={progress.streak} today={progress.learnedToday} />
        </div>
      </div>
    </div>
  );
}
