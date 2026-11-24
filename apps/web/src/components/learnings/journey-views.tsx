'use client';

import { type JourneyStep } from '@studythinker/shared';
import { Box, Check, CircleDashed, List, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { JourneyWorld } from './journey3d/world';

/**
 * The journey is shown as a small 3D world that matches its shape
 * (a real tree, a mountain quest, a bookshelf…). A plain list is one tap away.
 */

function groupsOf(steps: JourneyStep[]) {
  const map = new Map<string, JourneyStep[]>();
  for (const s of steps) {
    const g = s.group?.trim() || '';
    map.set(g, [...(map.get(g) ?? []), s]);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

function StatusDot({ status }: { status: JourneyStep['status'] }) {
  if (status === 'done')
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-white">
        <Check className="size-3.5" strokeWidth={3} aria-label="Done" />
      </span>
    );
  if (status === 'in_progress')
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight">
        <LoaderCircle className="size-3.5" aria-label="In progress" />
      </span>
    );
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
      <CircleDashed className="size-3.5" aria-label="To do" />
    </span>
  );
}

function StepList({
  learningId,
  steps,
  fresh,
  nextId,
}: {
  learningId: string;
  steps: JourneyStep[];
  fresh: ReadonlySet<string>;
  nextId: string | null;
}) {
  return (
    <div className="space-y-6">
      {groupsOf(steps).map((g) => (
        <section key={g.name || 'steps'}>
          {g.name && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{g.name}</h3>}
          <ol className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
            {g.items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/learnings/${learningId}/steps/${s.id}`}
                  data-step-id={s.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 outline-none hover:text-primary focus-visible:bg-muted',
                    nextId === s.id && 'bg-primary/[0.06] font-medium',
                    fresh.has(s.id) && 'animate-pop bg-highlight-soft',
                  )}
                >
                  <StatusDot status={s.status} />
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  {(nextId === s.id || fresh.has(s.id)) && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase',
                        fresh.has(s.id)
                          ? 'bg-highlight text-white'
                          : 'bg-primary text-primary-foreground',
                      )}
                    >
                      {fresh.has(s.id) ? 'New' : 'Next'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">{s.minutes}′</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

const VIEW_KEY = 'journey-view';

export function JourneyView({
  structure,
  learningId,
  steps,
  fresh = new Set(),
  nextId = null,
}: {
  structure: string;
  learningId: string;
  steps: JourneyStep[];
  fresh?: ReadonlySet<string>;
  nextId?: string | null;
}) {
  const [mode, setMode] = useState<'3d' | 'list'>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(VIEW_KEY) === 'list'
        ? 'list'
        : '3d';
    } catch {
      return '3d';
    }
  });
  const choose = (m: '3d' | 'list') => {
    setMode(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {
      /* private mode */
    }
  };
  if (!steps.length) return null;
  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Journey view"
        className="ml-auto flex w-fit gap-1 rounded-full bg-muted p-1"
      >
        {(
          [
            ['3d', Box, '3D'],
            ['list', List, 'List'],
          ] as const
        ).map(([m, Icon, text]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => choose(m)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors',
              mode === m
                ? 'bg-card text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {text}
          </button>
        ))}
      </div>
      {mode === '3d' ? (
        <JourneyWorld
          structure={structure}
          learningId={learningId}
          steps={steps}
          fresh={fresh}
          nextId={nextId}
          onUnsupported={() => setMode('list')}
        />
      ) : (
        <StepList learningId={learningId} steps={steps} fresh={fresh} nextId={nextId} />
      )}
    </div>
  );
}
