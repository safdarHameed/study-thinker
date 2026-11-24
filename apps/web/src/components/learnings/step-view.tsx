'use client';

import { useAssistantPage } from '@/components/assistant/assistant-context';
import {
  ASSESSMENT_STYLES,
  catalogLabel,
  DEFAULT_TEACHER_VOICE,
  type StepDetail,
  type StepStatus,
  shortTitle,
} from '@studythinker/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Gamepad2,
  MonitorPlay,
  Check,
  Clock,
  MessageCircle,
  Phone,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Swords,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { Markdown } from '@/components/common/markdown';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { shortModel } from '@/components/engage/ai-working';
import { fireConfetti } from '@/components/engage/confetti';
import { formatSeconds, useElapsed } from '@/components/engage/use-elapsed';
import { keys, useAiStatus, useRefreshProgress, useStep } from '@/lib/queries';
import { speak, speakable, stopSpeaking } from '@/lib/speech';
import { cn } from '@/lib/utils';
import { CreateAssessmentButton } from './assessments-panel';
import { ChatPanel } from './chat-panel';
import { AssessmentIcon } from './icons';
import { GamesPanel } from './games-panel';
import { SlidesPlayer } from './slides-player';
import { VoiceLesson } from './voice-lesson';

type Tab = 'lesson' | 'chat' | 'voice' | 'debate' | 'watch' | 'play';

const TAB_FOR_MODE: Record<string, Tab> = {
  chat: 'chat',
  voice: 'voice',
  avatar: 'voice',
  debate: 'debate',
  socratic: 'chat',
  video: 'watch',
  games: 'play',
  simulations: 'chat',
};

/** Tabs for optional ways of learning, shown when chosen (or when the step uses them). */
const OPTIONAL: Partial<Record<Tab, string[]>> = {
  debate: ['debate'],
  watch: ['video'],
  play: ['games'],
};

const REWRITES = ['Simpler', 'More examples', 'Add practice', 'Go deeper'];

export function StepView({ learningId, stepId }: { learningId: string; stepId: string }) {
  const query = useStep(learningId, stepId);
  if (query.isPending) return <LoadingState label="Opening…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  // Remount per step so tabs and chats reset when moving between steps.
  return <Step key={stepId} detail={query.data} />;
}

/** "DeepSeek is writing your lesson · 12s · 1.4k characters" */
function WritingLine({ chars }: { chars: number }) {
  // Shown only while writing, so mounting marks the start.
  const [since] = useState(() => Date.now());
  const seconds = useElapsed(since);
  const ai = useAiStatus();
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground" role="status">
      <Sparkles className="size-4 animate-pulse text-primary" aria-hidden />
      <span className="font-medium text-foreground">{shortModel(ai.data?.model)} is writing</span>
      <span>· {formatSeconds(seconds)}</span>
      {chars > 0 && <span>· {(chars / 1000).toFixed(1)}k chars</span>}
    </p>
  );
}

function Step({ detail }: { detail: StepDetail }) {
  const qc = useQueryClient();
  const { step, learning, lesson } = detail;
  const prefs = learning.preferences;
  const [tab, setTab] = useState<Tab>(TAB_FOR_MODE[step.mode ?? ''] ?? 'lesson');
  const [writing, setWriting] = useState(false);
  /** The lesson as it streams in. */
  const [draft, setDraft] = useState('');
  const [custom, setCustom] = useState('');
  const [reading, setReading] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const refreshProgress = useRefreshProgress();
  useAssistantPage(
    `Step “${step.title}” of “${shortTitle(learning.title)}” (${tab} tab; status ${step.status})`,
  );

  const update = (d: StepDetail) => {
    qc.setQueryData(keys.step(learning.id, step.id), d);
    void qc.invalidateQueries({ queryKey: keys.learning(learning.id) });
  };

  async function writeLesson(instruction?: string) {
    setWriting(true);
    setDraft('');
    try {
      update(
        await api.learnings.lessonStream(learning.id, step.id, instruction, {
          onDelta: (t) => setDraft((d) => d + t),
        }),
      );
      setCustom('');
      refreshProgress();
    } catch (err) {
      toast.error(describeError(err).description);
    } finally {
      setWriting(false);
      setDraft('');
    }
  }

  async function setStatus(status: StepStatus) {
    try {
      update(await api.learnings.setStepStatus(learning.id, step.id, status));
      if (status === 'done') {
        fireConfetti();
        setJustDone(true);
      } else setJustDone(false);
      refreshProgress();
    } catch (err) {
      toast.error(describeError(err).description);
    }
  }

  async function readAloud() {
    if (!lesson) return;
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    await speak(speakable(lesson.markdown), prefs?.voice ?? DEFAULT_TEACHER_VOICE, prefs?.language);
    setReading(false);
  }

  const chosen = new Set<string>([...(prefs?.modes ?? []), step.mode ?? '']);
  const allTabs: { id: Tab; label: string; icon: typeof BookOpenText }[] = [
    { id: 'lesson', label: 'Lesson', icon: BookOpenText },
    { id: 'watch', label: 'Watch', icon: MonitorPlay },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    {
      id: 'voice',
      label: chosen.has('avatar') ? 'Face to face' : 'Voice',
      icon: Phone,
    },
    { id: 'play', label: 'Play', icon: Gamepad2 },
    { id: 'debate', label: 'Debate', icon: Swords },
  ];
  const [showAll, setShowAll] = useState(false);
  const tabs = allTabs.filter(
    (t) => showAll || t.id === tab || !OPTIONAL[t.id] || OPTIONAL[t.id]!.some((m) => chosen.has(m)),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/learnings/${learning.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {shortTitle(learning.title)}
      </Link>

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{step.title}</h1>
        {step.summary && <p className="text-muted-foreground sm:text-lg">{step.summary}</p>}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden /> {step.minutes} min
          </span>
          {step.status === 'done' ? (
            <Button size="sm" variant="outline" onClick={() => void setStatus('in_progress')}>
              <Check className="text-success" aria-hidden /> Undo done
            </Button>
          ) : (
            <Button size="sm" onClick={() => void setStatus('done')}>
              <Check aria-hidden /> Done
            </Button>
          )}
        </div>
      </header>

      {justDone && step.status === 'done' && (
        <div className="flex animate-pop flex-col gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 sm:flex-row sm:items-center">
          <span className="text-3xl" aria-hidden>
            🎉
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Nice work!</p>
            {detail.next && (
              <p className="truncate text-sm text-muted-foreground">{detail.next.title}</p>
            )}
          </div>
          {detail.next ? (
            <Button asChild>
              <Link href={`/learnings/${learning.id}/steps/${detail.next.id}`}>
                Next <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/learnings/${learning.id}`}>Journey</Link>
            </Button>
          )}
        </div>
      )}

      {step.kind === 'assessment' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-highlight/30 bg-highlight-soft p-4 sm:flex-row sm:items-center">
          <AssessmentIcon id={step.assessmentStyle} className="size-6 text-highlight" />
          <p className="flex-1 text-sm font-medium">
            {catalogLabel(ASSESSMENT_STYLES, step.assessmentStyle) || 'Check-in'}
          </p>
          <CreateAssessmentButton
            learningId={learning.id}
            stepId={step.id}
            style={step.assessmentStyle ?? undefined}
            label="Start"
          />
        </div>
      )}

      <div
        role="tablist"
        aria-label="Ways to learn this step"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </button>
        ))}
        {tabs.length < allTabs.length && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="-mb-px shrink-0 px-3 py-2.5 text-sm font-medium text-primary hover:underline"
          >
            + More
          </button>
        )}
      </div>

      {tab === 'lesson' && writing && (
        <article className="space-y-3" aria-busy>
          <WritingLine chars={draft.length} />
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
            {draft ? (
              <>
                <Markdown>{draft.replace(/^\s*\**PICTURES:.*$/gim, '')}</Markdown>
                <span
                  className="inline-block h-5 w-2 animate-blink rounded-sm bg-primary align-middle"
                  aria-hidden
                />
              </>
            ) : (
              <div className="space-y-3" aria-hidden>
                <div className="h-7 w-2/3 animate-pulse rounded-lg bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              </div>
            )}
          </div>
        </article>
      )}

      {tab === 'lesson' &&
        !writing &&
        (lesson ? (
          <article className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void readAloud()}>
                {reading ? <Square aria-hidden /> : <Play aria-hidden />}
                {reading ? 'Stop' : 'Listen'}
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
              <Markdown>{lesson.markdown}</Markdown>
            </div>
            {lesson.images && lesson.images.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lesson.images.map((img) => (
                  <figure
                    key={img.url}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote, freely licensed images */}
                    <img
                      src={img.thumbUrl}
                      alt={img.title}
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-muted object-cover"
                    />
                    <figcaption className="space-y-0.5 p-3 text-xs">
                      <p className="line-clamp-1 font-medium">{img.title}</p>
                      <p className="text-muted-foreground">
                        {img.credit} ·{' '}
                        <a
                          href={img.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline"
                        >
                          {img.license}, Wikimedia Commons
                        </a>
                      </p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {lesson.keyPoints.length > 0 && (
              <aside className="rounded-2xl bg-secondary/70 p-5">
                <h2 className="sr-only">Key points</h2>
                <ul className="list-disc space-y-1 pl-5">
                  {lesson.keyPoints.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </aside>
            )}
            <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
              <p className="sr-only">Rewrite this lesson</p>
              <div className="flex flex-wrap gap-2">
                {REWRITES.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant="outline"
                    disabled={writing}
                    onClick={() => void writeLesson(r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom.trim()) void writeLesson(custom.trim());
                }}
              >
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  maxLength={500}
                  disabled={writing}
                  aria-label="Rewrite instruction"
                  placeholder="Or say how…"
                  className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                />
                <Button size="sm" type="submit" disabled={writing || !custom.trim()}>
                  {writing ? <RefreshCw className="animate-spin" aria-hidden /> : 'Rewrite'}
                </Button>
              </form>
            </div>
          </article>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <Sparkles className="size-8 text-primary" aria-hidden />
            <Button size="lg" onClick={() => void writeLesson()}>
              <BookOpenText aria-hidden /> Write my lesson · +5 XP
            </Button>
          </div>
        ))}

      {tab === 'chat' && (
        <div className="h-[32rem] overflow-hidden rounded-2xl border border-border bg-card">
          <ChatPanel
            className="h-full"
            queryKey={['tutor', learning.id, step.id]}
            open={() => api.learnings.openConversation(learning.id, 'tutor', step.id)}
            language={prefs?.language}
            placeholder="Ask your teacher…"
          />
        </div>
      )}

      {tab === 'voice' && prefs && (
        <VoiceLesson learningId={learning.id} stepId={step.id} prefs={prefs} />
      )}

      {tab === 'watch' && <SlidesPlayer detail={detail} onUpdate={update} />}

      {tab === 'play' && <GamesPanel detail={detail} onUpdate={update} />}

      {tab === 'debate' && (
        <div className="h-[32rem] overflow-hidden rounded-2xl border border-border bg-card">
          <ChatPanel
            className="h-full"
            queryKey={['debate', learning.id, step.id]}
            open={() => api.learnings.openConversation(learning.id, 'debate', step.id)}
            language={prefs?.language}
            teacherFirst
            placeholder="Make your argument…"
          />
        </div>
      )}

      {step.kind !== 'assessment' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm font-medium">Ready?</p>
          <CreateAssessmentButton
            learningId={learning.id}
            stepId={step.id}
            style={step.assessmentStyle ?? prefs?.assessments[0]}
            label="Test myself"
            variant="outline"
          />
        </div>
      )}

      <nav className="flex justify-between gap-3 border-t border-border pt-5" aria-label="Steps">
        {detail.previous ? (
          <Link
            href={`/learnings/${learning.id}/steps/${detail.previous.id}`}
            className="inline-flex max-w-[45%] items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{detail.previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {detail.next && (
          <Link
            href={`/learnings/${learning.id}/steps/${detail.next.id}`}
            className="inline-flex max-w-[45%] items-center gap-1.5 text-sm font-medium hover:text-primary"
          >
            <span className="truncate">{detail.next.title}</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        )}
      </nav>
    </div>
  );
}
