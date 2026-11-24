'use client';

import { ASSESSMENT_STYLES, catalogLabel, type LearningDetail } from '@studythinker/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ListSkeleton } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { keys, useAssessments } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AssessmentIcon } from './icons';

/** The learning's assessments, plus a way to create one in any of the learner's styles. */
export function AssessmentsPanel({ learning }: { learning: LearningDetail }) {
  const list = useAssessments(learning.id);
  const prefs = learning.preferences!;
  const available = ASSESSMENT_STYLES.filter((s) => s.available);
  const [style, setStyle] = useState<string>(prefs.assessments[0] ?? 'quiz');
  const [focus, setFocus] = useState('');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="sr-only">Test yourself</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Assessment style">
          {available.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              aria-pressed={style === s.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium',
                style === s.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <AssessmentIcon id={s.id} className="size-3.5" />
              {s.label}
              {prefs.assessments.includes(s.id) && style !== s.id && (
                <span className="text-highlight">★</span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={500}
            aria-label="Focus (optional)"
            placeholder="Focus on… (optional)"
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          <CreateAssessmentButton learningId={learning.id} style={style} focus={focus} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="sr-only">Your assessments</h2>
        {list.isPending ? (
          <ListSkeleton rows={2} />
        ) : !list.data?.length ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {list.data.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/assessments/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 hover:border-primary/40"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                    <AssessmentIcon id={a.style} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {catalogLabel(ASSESSMENT_STYLES, a.style)} ·{' '}
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  {a.status === 'graded' ? (
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-sm font-semibold',
                        (a.score ?? 0) >= 60
                          ? 'bg-success-soft text-success'
                          : 'bg-warning-soft text-warning',
                      )}
                    >
                      {a.score}%
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {a.status === 'failed' ? 'Not marked' : 'Open'}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function CreateAssessmentButton({
  learningId,
  style,
  stepId,
  focus,
  label = 'Create',
  variant = 'default',
}: {
  learningId: string;
  style?: string;
  stepId?: string;
  focus?: string;
  label?: string;
  variant?: 'default' | 'outline';
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <Button
        variant={variant}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const a = await api.learnings.createAssessmentStream(
              learningId,
              { style: style as never, stepId, focus: focus?.trim() || undefined },
              { onStatus: setStatus },
            );
            void qc.invalidateQueries({ queryKey: keys.assessments(learningId) });
            router.push(`/assessments/${a.id}`);
          } catch (err) {
            setError(describeError(err).description);
          } finally {
            // Also when coming back to this page later: the button is ready again.
            setBusy(false);
            setStatus(null);
          }
        }}
      >
        {busy ? <Sparkles className="animate-pulse" aria-hidden /> : <Plus aria-hidden />}
        <span aria-live="polite">{busy ? (status ?? 'Starting…') : label}</span>
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
