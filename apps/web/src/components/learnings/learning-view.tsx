'use client';

import { useAssistantPage } from '@/components/assistant/assistant-context';
import {
  catalogLabel,
  JOURNEY_STRUCTURES,
  type LearningDetail,
  TEACHER_PERSONAS,
  shortTitle,
} from '@studythinker/shared';
import {
  ArrowLeft,
  ArrowRight,
  History,
  RefreshCw,
  Settings2,
  Sparkles,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AiActivityLine, FindingsList } from '@/components/engage/ai-working';
import { fireConfetti } from '@/components/engage/confetti';
import { FlowSteps } from '@/components/engage/flow-steps';
import { timeAgo } from '@/components/engage/progress-widgets';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { useHistory, useLearning, useSetLearning } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AssessmentsPanel } from './assessments-panel';
import { ConfigureView } from './configure-view';
import { JourneyView } from './journey-views';
import { ModeIcon } from './icons';
import { StructureIcon } from './structure-icon';

export function LearningView({ id }: { id: string }) {
  const learning = useLearning(id);
  const [changing, setChanging] = useState(false);

  if (learning.isPending) return <LoadingState label="Opening…" />;
  if (learning.isError)
    return <ErrorState error={learning.error} onRetry={() => void learning.refetch()} />;
  const l = learning.data;

  if (l.live?.phase === 'options') return <Preparing learning={l} />;
  if (l.status === 'BUILDING') return <Building learning={l} />;
  if (!l.options) return <NoOptions learning={l} />;
  if (
    l.status === 'DRAFT' ||
    changing ||
    (l.status === 'FAILED' && !l.steps.length && !l.preferences)
  ) {
    return (
      <ConfigureView
        learning={l}
        options={l.options}
        onCancel={l.steps.length ? () => setChanging(false) : undefined}
      />
    );
  }
  if (!l.steps.length) return <BuildFailed learning={l} onChange={() => setChanging(true)} />;
  return <Journey learning={l} onChange={() => setChanging(true)} />;
}

function BackLink() {
  return (
    <Link
      href="/learnings"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> Learnings
    </Link>
  );
}

function NoOptions({ learning }: { learning: LearningDetail }) {
  const setLearning = useSetLearning();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-xl space-y-6 py-10 text-center">
      <BackLink />
      <h1 className="text-3xl font-semibold tracking-tight">{shortTitle(learning.title)}</h1>
      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-5 text-left">
        <p className="font-medium">Couldn’t prepare options.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {learning.error ?? 'Please try again.'}
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/settings#ai">AI settings</Link>
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setLearning(await api.learnings.regenerateOptions(learning.id));
            } catch (err) {
              toast.error(describeError(err).description);
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw className={cn(busy && 'animate-spin')} aria-hidden />{' '}
          {busy ? 'Thinking…' : 'Try again'}
        </Button>
      </div>
    </div>
  );
}

/** The AI is proposing options: show each choice as it is decided. */
function Preparing({ learning }: { learning: LearningDetail }) {
  const live = learning.live!;
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <FlowSteps current={1} />
      <div className="space-y-3 text-center">
        <div className="relative mx-auto grid size-20 place-items-center rounded-3xl bg-[linear-gradient(135deg,#22D3EE,#6366F1,#A855F7)] text-white shadow-lift">
          <Sparkles className="size-9 animate-pulse" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Designing “{learning.topic}”
        </h1>
        <AiActivityLine live={live} />
      </div>
      <FindingsList live={live} />
    </div>
  );
}

function Building({ learning }: { learning: LearningDetail }) {
  const structure = learning.preferences?.structure ?? null;
  const live = learning.live?.phase === 'journey' ? learning.live : null;
  const steps = live?.steps ?? [];
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [steps.length]);
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <FlowSteps current={2} />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative grid size-20 place-items-center rounded-3xl bg-secondary text-primary">
          <StructureIcon structure={structure} className="size-9" />
          <Sparkles
            className="absolute -top-2 -right-2 size-7 animate-pulse text-highlight"
            aria-hidden
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Building your {catalogLabel(JOURNEY_STRUCTURES, structure).toLowerCase() || 'journey'}
          </h1>
          <p className="text-sm text-muted-foreground">Safe to leave this page.</p>
        </div>
        {live && <AiActivityLine live={live} />}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Steps</h2>
          <span className="text-sm text-muted-foreground tabular-nums">{steps.length}</span>
        </div>
        {steps.length ? (
          <ol ref={listRef} className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {steps.map((title, i) => (
              <li key={`${i}-${title}`} className="flex animate-rise items-center gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                {title}
              </li>
            ))}
          </ol>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 animate-pulse text-primary" aria-hidden />
            {live?.stage === 'writing' ? 'Writing overview…' : 'Writing first step…'}
          </p>
        )}
        {live && live.groups.length > 1 && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {live.groups.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

function BuildFailed({ learning, onChange }: { learning: LearningDetail; onChange: () => void }) {
  const setLearning = useSetLearning();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-xl space-y-6 py-10 text-center">
      <BackLink />
      <h1 className="text-3xl font-semibold tracking-tight">{shortTitle(learning.title)}</h1>
      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-5 text-left">
        <p className="font-medium">Build failed.</p>
        <p className="mt-1 text-sm text-muted-foreground">{learning.error}</p>
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={onChange}>
          <Settings2 aria-hidden /> Change
        </Button>
        <Button
          disabled={busy || !learning.preferences}
          onClick={async () => {
            setBusy(true);
            try {
              setLearning(await api.learnings.build(learning.id, learning.preferences!));
            } catch (err) {
              toast.error(describeError(err).description);
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw aria-hidden /> Try again
        </Button>
      </div>
    </div>
  );
}

function Journey({ learning, onChange }: { learning: LearningDetail; onChange: () => void }) {
  const setLearning = useSetLearning();
  const [tab, setTab] = useState<'journey' | 'assessments' | 'history'>('journey');
  const prefs = learning.preferences!;
  const done = learning.progress.done;
  const total = learning.progress.total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const nextStep =
    learning.steps.find((s) => s.status === 'in_progress') ??
    learning.steps.find((s) => s.status === 'todo');
  const minutesLeft = learning.steps
    .filter((s) => s.status !== 'done')
    .reduce((n, s) => n + s.minutes, 0);
  const finished = total > 0 && done === total;
  const fresh = useFreshSteps(learning);

  // Celebrate finishing the journey (once per device).
  useEffect(() => {
    if (!finished) return;
    const key = `st-finished-${learning.id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable: celebrate anyway */
    }
    fireConfetti({ count: 220 });
  }, [finished, learning.id]);

  async function undo() {
    try {
      setLearning(await api.learnings.undo(learning.id));
      toast.success('Change undone');
    } catch (err) {
      toast.error(describeError(err).description);
    }
  }

  const chips = [
    catalogLabel(JOURNEY_STRUCTURES, prefs.structure),
    `${prefs.duration.amount} ${prefs.duration.unit}`,
    `${prefs.sessionsPerWeek}× ${prefs.minutesPerSession} min/wk`,
    catalogLabel(TEACHER_PERSONAS, prefs.teacher),
  ];

  useAssistantPage(`Journey page of the learning “${shortTitle(learning.title)}” (${tab} tab)`, {
    learningId: learning.id,
    title: shortTitle(learning.title),
    language: prefs.language,
  });

  return (
    <div>
      <div className="min-w-0 space-y-6">
        <BackLink />
        <header className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                {shortTitle(learning.title)}
              </h1>
            </div>
            <div className="flex shrink-0 gap-2">
              {learning.canUndo && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void undo()}
                  title={learning.lastChange ? `Undo: ${learning.lastChange}` : 'Undo'}
                  aria-label="Undo last change"
                >
                  <Undo2 aria-hidden />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onChange}
                title="Change choices"
                aria-label="Change choices"
              >
                <Settings2 aria-hidden />
              </Button>
            </div>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Your choices">
            {chips.map((c, i) => (
              <li
                key={`${c}-${i}`}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              >
                {c}
              </li>
            ))}
          </ul>
          {learning.error && (
            <p role="alert" className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm">
              {learning.error}
            </p>
          )}
          {finished ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success-soft p-6 text-center">
              <span className="text-5xl" aria-hidden>
                🎓
              </span>
              <h2 className="text-xl font-semibold">Journey complete!</h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {total} steps · {formatMinutes(learning.steps.reduce((n, s) => n + s.minutes, 0))}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => setTab('assessments')}>
                  Test yourself
                </Button>
                <Button asChild>
                  <Link href="/learnings">New learning</Link>
                </Button>
              </div>
            </div>
          ) : (
            <Link
              href={nextStep ? `/learnings/${learning.id}/steps/${nextStep.id}` : '#'}
              className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow outline-none hover:shadow-lift focus-visible:ring-4 focus-visible:ring-ring/40"
            >
              <div className="flex items-center gap-4 p-4 sm:p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#22D3EE,#6366F1,#A855F7)] text-white shadow-soft">
                  <ModeIcon id={nextStep?.mode ?? null} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-muted-foreground">
                    {milestone(pct, done)}
                  </span>
                  <span className="block truncate text-lg font-semibold">{nextStep?.title}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform group-hover:translate-x-0.5">
                  {done === 0 && nextStep?.status !== 'in_progress' ? 'Start' : 'Continue'}
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 pb-4 sm:px-5">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#22D3EE,#6366F1,#A855F7)] transition-[width] duration-700"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {done}/{total} · {formatMinutes(minutesLeft)} left
                </span>
              </div>
            </Link>
          )}
        </header>

        <div role="tablist" aria-label="Sections" className="flex gap-1 border-b border-border">
          {(['journey', 'assessments', 'history'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'journey' ? 'Journey' : t === 'assessments' ? 'Assessments' : 'History'}
            </button>
          ))}
        </div>

        {tab === 'journey' ? (
          <JourneyView
            structure={prefs.structure}
            learningId={learning.id}
            steps={learning.steps}
            fresh={fresh}
            nextId={nextStep?.id ?? null}
          />
        ) : tab === 'assessments' ? (
          <AssessmentsPanel learning={learning} />
        ) : (
          <HistoryPanel learningId={learning.id} />
        )}
      </div>
    </div>
  );
}

function milestone(pct: number, done: number) {
  if (done === 0) return 'Ready to start';
  if (pct >= 75) return 'Nearly there 🏁';
  if (pct >= 50) return 'Halfway there! 🚀';
  if (pct >= 25) return 'Quarter way 🎯';
  return 'Good start 💪';
}

function formatMinutes(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** Steps added or changed since the last render (e.g. by the coach), highlighted for a moment. */
function useFreshSteps(learning: LearningDetail) {
  const previous = useRef<Map<string, string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const signature = useMemo(
    () =>
      new Map(
        learning.steps.map((s) => [
          s.id,
          `${s.title}|${s.summary}|${s.kind}|${s.minutes}|${s.group}`,
        ]),
      ),
    [learning.steps],
  );
  useEffect(() => {
    const before = previous.current;
    previous.current = signature;
    if (!before) return;
    const changed = [...signature].filter(([id, sig]) => before.get(id) !== sig).map(([id]) => id);
    if (!changed.length) return;
    setFresh(new Set(changed));
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-step-id="${changed[0]}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
    const t = setTimeout(() => setFresh(new Set()), 7000);
    return () => clearTimeout(t);
  }, [signature]);
  return fresh;
}

/** What changed in the plan and what the learner did, newest first. */
function HistoryPanel({ learningId }: { learningId: string }) {
  const history = useHistory(learningId);
  if (history.isPending) return <LoadingState label="Loading…" />;
  if (history.isError)
    return <ErrorState error={history.error} onRetry={() => void history.refetch()} />;
  if (!history.data.length)
    return <p className="py-8 text-center text-muted-foreground">Nothing yet.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-6">
      {history.data.map((h) => (
        <li key={h.id} className="relative">
          <span
            className={cn(
              'absolute top-0.5 -left-[2.06rem] grid size-6 place-items-center rounded-full text-white',
              h.kind === 'change' ? 'bg-info' : 'bg-success',
            )}
            aria-hidden
          >
            {h.kind === 'change' ? (
              <Settings2 className="size-3.5" />
            ) : (
              <History className="size-3.5" />
            )}
          </span>
          <p className="text-sm font-medium">
            {h.text}
            {h.xp > 0 && (
              <span className="ml-2 rounded-full bg-success-soft px-1.5 py-0.5 text-xs font-semibold text-success">
                +{h.xp} XP
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {h.kind === 'change' ? 'Plan changed' : 'You'} · {timeAgo(h.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}
