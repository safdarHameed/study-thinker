'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, describeError } from '@/lib/api';
import { takePendingTopic } from '@/lib/pending-topic';
import { useSetLearning } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function NewLearningForm({ className }: { className?: string }) {
  const router = useRouter();
  const setLearning = useSetLearning();
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pending = takePendingTopic();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hand-off from the landing page
    if (pending) setTopic(pending);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 2) {
      setError('Enter a topic.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const learning = await api.learnings.create({
        topic: topic.trim(),
        description: description.trim() || undefined,
      });
      setLearning(learning);
      router.push(`/learnings/${learning.id}`);
      // Fresh again when the learner comes back to this page.
      setTopic('');
      setDescription('');
      setShowMore(false);
    } catch (err) {
      setError(describeError(err).description);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-lift sm:p-7',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.18),transparent)]"
      />
      <label htmlFor="topic" className="block text-lg font-semibold tracking-tight sm:text-xl">
        What do you want to learn?
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          disabled={busy}
          placeholder="Photosynthesis, Japanese, chess…"
          className="h-12 w-full min-w-0 rounded-xl sm:flex-1 border border-input bg-background px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        />
        <Button type="submit" size="lg" disabled={busy} className="sm:w-auto">
          {busy ? (
            <>
              <Sparkles className="size-4 animate-pulse" aria-hidden /> Starting…
            </>
          ) : (
            <>
              Start <ArrowRight aria-hidden />
            </>
          )}
        </Button>
      </div>
      {showMore ? (
        <div className="mt-3">
          <label htmlFor="description" className="text-sm font-medium">
            About you <span className="text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            disabled={busy}
            rows={3}
            className="mt-1.5"
            placeholder="e.g. Exam in May, I learn by doing"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          + About you
        </button>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
