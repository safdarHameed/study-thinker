'use client';

import {
  ASSESSMENT_STYLES,
  type AssessmentDetail,
  type AssessmentQuestion,
  catalogLabel,
  DEFAULT_TEACHER_VOICE,
} from '@studythinker/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Mic,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState, Spinner } from '@/components/common/loading-state';
import { Markdown } from '@/components/common/markdown';
import { MermaidDiagram } from '@/components/common/mermaid';
import { AssessmentIcon } from '@/components/learnings/icons';
import { ChatPanel } from '@/components/learnings/chat-panel';
import { Button } from '@/components/ui/button';
import { Picker } from '@/components/ui/picker';
import { api, describeError } from '@/lib/api';
import { fireConfetti } from '@/components/engage/confetti';
import { keys, useAiSettings, useAssessment, useLearning } from '@/lib/queries';
import { dictationMethod, speak, useDictation } from '@/lib/speech';
import { cn } from '@/lib/utils';

export function AssessmentView({ id }: { id: string }) {
  const query = useAssessment(id);
  if (query.isPending) return <LoadingState label="Opening…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <Assessment key={id} assessment={query.data} />;
}

function Assessment({ assessment: a }: { assessment: AssessmentDetail }) {
  const qc = useQueryClient();
  const learning = useLearning(a.learningId);
  const prefs = learning.data?.preferences ?? null;
  const [answers, setAnswers] = useState<Record<string, string>>(a.answers);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDetail = (d: AssessmentDetail) => {
    qc.setQueryData(keys.assessment(d.id), d);
    void qc.invalidateQueries({ queryKey: keys.assessments(d.learningId) });
    void qc.invalidateQueries({ queryKey: keys.learning(d.learningId) });
    void qc.invalidateQueries({ queryKey: keys.progress });
  };

  function answer(qid: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: value };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => void api.assessments.save(a.id, next).catch(() => undefined),
        800,
      );
      return next;
    });
  }

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  async function submit() {
    // The answers are sent with the submission; a pending autosave would arrive too late.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSubmitting(true);
    try {
      const result =
        a.style === 'debate'
          ? await api.assessments.finish(a.id)
          : await api.assessments.submit(a.id, answers);
      setDetail(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if ((result.score ?? 0) >= 60) fireConfetti({ count: result.score === 100 ? 220 : 140 });
    } catch (err) {
      toast.error(describeError(err).description);
      void qc.invalidateQueries({ queryKey: keys.assessment(a.id) });
    } finally {
      setSubmitting(false);
    }
  }

  const graded = a.status === 'graded' && a.result;
  const unanswered = a.questions.filter(
    (q) => q.type !== 'order' && !(answers[q.id] ?? '').trim(),
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/learnings/${a.learningId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {learning.data?.title ?? 'Back'}
      </Link>

      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <AssessmentIcon id={a.style} className="size-4" />{' '}
          {catalogLabel(ASSESSMENT_STYLES, a.style)}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">{a.title}</h1>
        {a.instructions && <p className="text-muted-foreground">{a.instructions}</p>}
      </header>

      {graded && <Results assessment={a} />}

      {a.status === 'failed' && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl bg-warning-soft p-4 sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-sm">
            <strong>Marking failed.</strong> {a.error}
          </p>
          <Button onClick={() => void submit()} disabled={submitting}>
            <RefreshCw aria-hidden /> Mark again
          </Button>
        </div>
      )}

      {a.style === 'debate' && a.conversationId ? (
        <div className="space-y-4">
          <div className="h-[30rem] overflow-hidden rounded-2xl border border-border bg-card">
            <ChatPanel
              className="h-full"
              queryKey={keys.conversation(a.conversationId)}
              open={() => api.conversations.get(a.conversationId!)}
              language={prefs?.language}
              teacherFirst={a.status === 'open'}
              disabled={a.status !== 'open' && a.status !== 'failed'}
              placeholder="Make your argument…"
            />
          </div>
          {!graded && (
            <Button size="lg" onClick={() => void submit()} disabled={submitting}>
              {submitting ? (
                <Spinner className="size-4 border-white/40 border-t-white" />
              ) : (
                <Check aria-hidden />
              )}
              {submitting ? 'Marking…' : 'Finish debate'}
            </Button>
          )}
        </div>
      ) : (
        <ol className="space-y-5">
          {a.questions.map((q, i) => (
            <li key={q.id} className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-1 text-xs text-muted-foreground tabular-nums">
                {i + 1}/{a.questions.length}
              </p>
              <QuestionInput
                question={q}
                value={answers[q.id] ?? ''}
                onChange={(v) => answer(q.id, v)}
                locked={!!graded || submitting}
                language={prefs?.language}
                voice={prefs?.voice ?? DEFAULT_TEACHER_VOICE}
              />
              {graded && <QuestionFeedback assessment={a} question={q} />}
            </li>
          ))}
        </ol>
      )}

      {!graded && a.style !== 'debate' && (
        <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-muted-foreground">
              {unanswered ? `${unanswered} unanswered` : 'All answered'}
            </p>
            <Button size="lg" onClick={() => void submit()} disabled={submitting}>
              {submitting ? (
                <Sparkles className="animate-pulse" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              {submitting ? 'Marking…' : 'Submit'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionInput({
  question: q,
  value,
  onChange,
  locked,
  language,
  voice,
}: {
  question: AssessmentQuestion;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  language?: string;
  voice: typeof DEFAULT_TEACHER_VOICE;
}) {
  const settings = useAiSettings();
  const [flipped, setFlipped] = useState(!!value);
  const dictation = useDictation({
    method: dictationMethod(settings.data?.serverTranscription ?? false),
    language,
    onText: (t) => onChange(value ? `${value} ${t}` : t),
  });

  if (q.type === 'flashcard') {
    return (
      <div className="space-y-3">
        <div className="grid min-h-28 place-items-center rounded-xl bg-secondary/60 p-5 text-center text-lg font-medium">
          {flipped ? (
            <div>
              <p className="text-sm text-muted-foreground">{q.prompt}</p>
              <p className="mt-2">{q.back}</p>
            </div>
          ) : (
            q.prompt
          )}
        </div>
        {!flipped ? (
          <Button variant="outline" onClick={() => setFlipped(true)} disabled={locked}>
            <RotateCcw aria-hidden /> Reveal
          </Button>
        ) : (
          <div className="flex gap-2" role="radiogroup" aria-label="Did you know it?">
            {[
              { id: 'knew', label: 'I knew it', icon: Check },
              { id: 'missed', label: 'I didn’t', icon: X },
            ].map((o) => (
              <Button
                key={o.id}
                role="radio"
                aria-checked={value === o.id}
                variant={value === o.id ? 'default' : 'outline'}
                disabled={locked}
                onClick={() => onChange(o.id)}
              >
                <o.icon aria-hidden /> {o.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const media = (
    <>
      {q.diagram && <MermaidDiagram code={q.diagram} />}
      {q.image && (
        <figure className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote, freely licensed image */}
          <img
            src={q.image.thumbUrl}
            alt="Question image"
            className="max-h-80 w-full bg-muted object-contain"
          />
          <figcaption className="p-2 text-xs text-muted-foreground">
            {q.image.credit} ·{' '}
            <a
              href={q.image.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              {q.image.license}, Wikimedia Commons
            </a>
          </figcaption>
        </figure>
      )}
    </>
  );

  if (q.type === 'match' || q.type === 'order') {
    const n = q.options.length;
    let current: number[];
    try {
      current = value ? (JSON.parse(value) as number[]) : [];
    } catch {
      current = [];
    }
    if (q.type === 'order' && current.length !== n)
      current = Array.from({ length: n }, (_, i) => i);
    const move = (i: number, d: -1 | 1) => {
      const next = [...current];
      const j = i + d;
      if (j < 0 || j >= n) return;
      [next[i], next[j]] = [next[j]!, next[i]!];
      onChange(JSON.stringify(next));
    };
    return (
      <div className="space-y-3">
        <Markdown className="lw-prose-sm font-medium">{q.prompt}</Markdown>
        {media}
        {q.type === 'match' ? (
          <ul className="space-y-2">
            {q.options.map((left, i) => (
              <li
                key={i}
                className="flex flex-col gap-1.5 rounded-xl border border-border p-3 sm:flex-row sm:items-center"
              >
                <span className="flex-1 font-medium">{left}</span>
                <Picker
                  aria-label={`Match for ${left}`}
                  disabled={locked}
                  size="sm"
                  value={(current[i] ?? -1) >= 0 ? String(current[i]) : ''}
                  onValueChange={(v) => {
                    const next = Array.from({ length: n }, (_, k) => current[k] ?? -1);
                    next[i] = v === '' ? -1 : Number(v);
                    onChange(JSON.stringify(next));
                  }}
                  options={(q.right ?? []).map((r, k) => ({ value: String(k), label: r }))}
                  searchable={false}
                  placeholder="Choose…"
                  className="sm:w-1/2"
                />
              </li>
            ))}
          </ul>
        ) : (
          <ol className="space-y-2">
            {current.map((itemIndex, pos) => (
              <li
                key={itemIndex}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
              >
                <span className="w-5 text-sm text-muted-foreground tabular-nums">{pos + 1}.</span>
                <span className="flex-1">{q.options[itemIndex]}</span>
                {!locked && (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => move(pos, -1)}
                      disabled={pos === 0}
                      aria-label={`Move "${q.options[itemIndex]}" up`}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => move(pos, 1)}
                      disabled={pos === n - 1}
                      aria-label={`Move "${q.options[itemIndex]}" down`}
                    >
                      <ArrowDown />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const spoken = q.type === 'spoken' || q.type === 'presentation';
  return (
    <div className="space-y-3">
      {media}
      <div className="flex items-start gap-2">
        <Markdown className="lw-prose-sm flex-1 font-medium">{q.prompt}</Markdown>
        {spoken && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void speak(q.prompt, voice, language)}
            aria-label="Hear the question"
          >
            <Volume2 />
          </Button>
        )}
      </div>
      {q.type === 'choice' ? (
        <div role="radiogroup" aria-label="Options" className="space-y-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === String(i)}
              disabled={locked}
              onClick={() => onChange(String(i))}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                value === String(i)
                  ? 'border-primary bg-primary/[0.07]'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                  value === String(i)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border',
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {o}
            </button>
          ))}
        </div>
      ) : (
        <>
          {q.type === 'presentation' && (
            <p className="rounded-xl bg-secondary/60 px-3.5 py-2.5 text-sm">
              🎤 Talk for 1–3 min: intro, key points, wrap-up.
            </p>
          )}
          {spoken && dictation.supported && (
            <Button
              variant={dictation.listening ? 'destructive' : 'default'}
              onClick={() => (dictation.listening ? dictation.stop() : void dictation.start())}
              disabled={locked || dictation.transcribing}
            >
              {dictation.transcribing ? (
                <Spinner className="size-4" />
              ) : dictation.listening ? (
                <Square aria-hidden />
              ) : (
                <Mic aria-hidden />
              )}
              {dictation.listening
                ? 'Done'
                : dictation.transcribing
                  ? 'Transcribing…'
                  : value
                    ? 'Add more'
                    : q.type === 'presentation'
                      ? 'Start'
                      : 'Speak'}
            </Button>
          )}
          <textarea
            value={dictation.interim || value}
            onChange={(e) => onChange(e.target.value)}
            disabled={locked}
            rows={q.type === 'task' || q.type === 'presentation' ? 8 : 4}
            maxLength={8000}
            placeholder={
              spoken
                ? 'Your words appear here'
                : q.type === 'task'
                  ? 'What you did…'
                  : 'Your answer…'
            }
            aria-label="Your answer"
            className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
          />
          {!spoken && dictation.supported && !locked && (
            <button
              type="button"
              onClick={() => (dictation.listening ? dictation.stop() : void dictation.start())}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Mic className="size-4" aria-hidden /> {dictation.listening ? 'Stop' : 'Dictate'}
            </button>
          )}
          {dictation.error && <p className="text-sm text-destructive">{dictation.error}</p>}
        </>
      )}
    </div>
  );
}

function QuestionFeedback({
  assessment,
  question,
}: {
  assessment: AssessmentDetail;
  question: AssessmentQuestion;
}) {
  const r = assessment.result?.questions.find((x) => x.questionId === question.id);
  if (!r) return null;
  const good = r.score >= 60;
  return (
    <div
      className={cn('mt-4 rounded-xl p-3.5 text-sm', good ? 'bg-success-soft' : 'bg-warning-soft')}
    >
      <p className="font-semibold">
        {good ? <Check className="mr-1 inline size-4 text-success" aria-hidden /> : null}
        {r.score}%
      </p>
      <p className="mt-1">{r.feedback}</p>
      {r.correctAnswer && question.type !== 'flashcard' && (
        <p className="mt-2 text-muted-foreground">
          <span className="font-medium text-foreground">
            {question.type === 'choice' ? 'Answer: ' : 'Model answer: '}
          </span>
          {r.correctAnswer}
        </p>
      )}
    </div>
  );
}

function Results({ assessment: a }: { assessment: AssessmentDetail }) {
  const r = a.result!;
  const good = r.score >= 60;
  return (
    <section
      className="rounded-3xl border border-border bg-card p-5 sm:p-7"
      aria-labelledby="result"
    >
      <div className="flex items-center gap-5">
        <div
          className={cn(
            'grid size-20 shrink-0 place-items-center rounded-full text-2xl font-bold',
            good ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
          )}
        >
          {r.score}%
        </div>
        <div>
          <h2 id="result" className="text-xl font-semibold">
            {r.score >= 85 ? 'Excellent!' : good ? 'Well done' : 'Keep going'}
          </h2>
          <p className="text-muted-foreground">{r.summary}</p>
        </div>
      </div>
      {(r.strengths.length > 0 || r.improvements.length > 0) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {r.strengths.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Strengths</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {r.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {r.improvements.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">To work on</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {r.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {a.style === 'debate' && r.questions[0] && (
        <p className="mt-4 text-sm">{r.questions[0].feedback}</p>
      )}
    </section>
  );
}
