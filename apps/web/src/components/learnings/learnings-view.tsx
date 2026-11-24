'use client';

import { useAssistantPage } from '@/components/assistant/assistant-context';
import { shortTitle, type LearningSummary } from '@studythinker/shared';
import { ArrowRight, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { CardGridSkeleton } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import {
  ActivityFeed,
  BadgeShelf,
  WeekDots,
  XpSummary,
} from '@/components/engage/progress-widgets';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';
import { useAiStatus, useLearnings, useProgress } from '@/lib/queries';
import { LearningCard } from './learning-card';
import { NewLearningForm } from './new-learning-form';
import { StructureIcon } from './structure-icon';

export function LearningsView() {
  const { user } = useAuth();
  const learnings = useLearnings();
  const progress = useProgress();
  const ai = useAiStatus();
  const list = learnings.data ?? [];
  // The learning touched most recently that still has something to do.
  const current = list.find((l) => l.status === 'READY' && l.next);
  const hasAny = list.length > 0;
  useAssistantPage('Home: start a new learning, continue one, see XP, streak and badges');

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        {user ? `Hi ${user.displayName.split(' ')[0]} 👋` : 'Your learnings'}
      </h1>

      {ai.data && !ai.data.available && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center">
          <KeyRound className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-sm font-medium">AI isn’t set up yet.</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings#ai">Add a key</Link>
          </Button>
        </div>
      )}

      {hasAny && progress.data && (
        <section aria-label="Today" className="grid gap-4 lg:grid-cols-5">
          {current ? <ContinueCard learning={current} /> : null}
          <div
            className={
              current
                ? 'space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2'
                : 'space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-5'
            }
          >
            <XpSummary progress={progress.data} />
            <WeekDots progress={progress.data} />
          </div>
        </section>
      )}

      <NewLearningForm />

      <section aria-labelledby="mine" className="space-y-4">
        <h2 id="mine" className="text-sm font-medium text-muted-foreground">
          My learnings
        </h2>
        {learnings.isPending ? (
          <CardGridSkeleton count={3} />
        ) : learnings.isError ? (
          <ErrorState error={learnings.error} onRetry={() => void learnings.refetch()} />
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-muted-foreground">
            Nothing yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((l) => (
              <LearningCard key={l.id} learning={l} />
            ))}
          </div>
        )}
      </section>

      {hasAny && progress.data && (
        <section className="grid gap-6 lg:grid-cols-5" aria-label="Your achievements">
          <div className="space-y-3 lg:col-span-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Badges{' '}
              <span className="font-normal">
                {progress.data.badges.filter((b) => b.earnedAt).length} of{' '}
                {progress.data.badges.length}
              </span>
            </h2>
            <BadgeShelf progress={progress.data} />
          </div>
          <div className="space-y-3 lg:col-span-2">
            <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
            <div className="rounded-2xl border border-border bg-card p-4">
              <ActivityFeed items={progress.data.recent.slice(0, 8)} empty="Nothing yet." />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ContinueCard({ learning }: { learning: LearningSummary }) {
  const next = learning.next!;
  const pct = learning.progress.total
    ? Math.round((learning.progress.done / learning.progress.total) * 100)
    : 0;
  return (
    <Link
      href={`/learnings/${learning.id}/steps/${next.id}`}
      className="group relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#4F46E5,#7C3AED_60%,#A855F7)] p-6 text-white shadow-lift outline-none focus-visible:ring-4 focus-visible:ring-ring/50 lg:col-span-3"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl"
      />
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
          <StructureIcon structure={learning.structure} className="size-5" />
        </span>
        <p className="min-w-0 self-center truncate text-2xl leading-snug font-semibold sm:text-3xl">
          {shortTitle(learning.title)}
        </p>
      </div>
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-white/80">
            <span>
              {learning.progress.done}/{learning.progress.total}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition-transform group-hover:translate-x-0.5">
          Continue <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
