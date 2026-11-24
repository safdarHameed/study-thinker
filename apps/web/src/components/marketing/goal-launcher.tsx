'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { savePendingTopic } from '@/lib/pending-topic';
import { cn } from '@/lib/utils';

/**
 * "What do you want to learn?" on the landing page. The topic is kept for the
 * next screen, so signing up doesn't make the visitor type it again.
 */
export function GoalLauncher({
  className,
  inputId = 'hero-goal',
}: {
  className?: string;
  inputId?: string;
}) {
  const router = useRouter();
  const { status } = useAuth();
  const [topic, setTopic] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim()) savePendingTopic(topic.trim());
    router.push(status === 'authenticated' ? '/learnings' : '/register');
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'flex w-full max-w-xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-[0_1px_2px_rgba(9,9,11,0.06),0_12px_32px_-12px_rgba(30,27,75,0.25)] ring-1 ring-zinc-950/10',
        className,
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        What do you want to learn?
      </label>
      <input
        id={inputId}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        maxLength={200}
        placeholder="What do you want to learn?"
        className="h-11 min-w-0 flex-1 bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
      />
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Start
        <ArrowRight className="size-4" aria-hidden />
      </button>
    </form>
  );
}
