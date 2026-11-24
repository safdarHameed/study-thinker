'use client';

import type { LiveStatus } from '@studythinker/shared';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSeconds, useElapsed } from './use-elapsed';

const STAGE: Record<LiveStatus['stage'], string> = {
  waiting: 'Starting…',
  writing: 'Writing…',
  fixing: 'Fixing…',
  saving: 'Saving…',
};

/** The model name without the organisation, e.g. "DeepSeek-V4.1-Flash". */
export function shortModel(model: string | null | undefined) {
  return model ? (model.split('/').pop() ?? model) : 'The AI';
}

/** A live line about what the AI is doing: model, stage, time, amount received. */
export function AiActivityLine({ live, className }: { live: LiveStatus; className?: string }) {
  const seconds = useElapsed(live.startedAt);
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        {STAGE[live.stage]}
      </span>
      <span>{shortModel(live.model)}</span>
      <span>· {formatSeconds(seconds)}</span>
      {live.received > 0 && <span>· {(live.received / 1000).toFixed(1)}k chars</span>}
    </div>
  );
}

/** Findings appear one by one as the AI decides them. */
export function FindingsList({ live }: { live: LiveStatus }) {
  return (
    <ul className="space-y-2">
      {live.findings.map((f) => (
        <li
          key={f.label}
          className="flex animate-rise items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-soft"
        >
          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {f.label}
            </p>
            <p className="font-medium">{f.value}</p>
          </div>
        </li>
      ))}
      {live.stage !== 'saving' && (
        <li className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="size-4 animate-pulse text-primary" aria-hidden />
          {live.findings.length ? 'Thinking…' : 'Reading…'}
        </li>
      )}
    </ul>
  );
}
