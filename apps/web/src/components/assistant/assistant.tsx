'use client';

import type { ChatMessage } from '@studythinker/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RotateCcw, SendHorizontal } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bubble, ChatPanel } from '@/components/learnings/chat-panel';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-provider';
import { keys } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { useAssistantContext } from './assistant-context';
import { BotFace } from './bot-face';

type Mode = 'coach' | 'guide';

/** A fallback description of the screen, from the address. */
function describePath(path: string) {
  if (path.startsWith('/settings')) return 'Settings: profile, AI models (own key), password, data';
  if (path.startsWith('/assessments')) return 'An assessment';
  if (/^\/learnings\/[^/]+\/steps\//.test(path)) return 'A step of a learning';
  if (/^\/learnings\/[^/]+/.test(path)) return 'A learning';
  if (path.startsWith('/learnings')) return 'Home (Learnings)';
  return path;
}

/**
 * The app's assistant, on every screen: a guide that knows where the learner is
 * and, on a learning's journey, the coach that changes the plan.
 */
export function Assistant() {
  const { page } = useAssistantContext();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Mode>('coach');
  const [busy, setBusy] = useState(false);
  const coach = page?.coach;
  const mode: Mode = coach ? picked : 'guide';
  const here = `${page?.page ?? describePath(pathname)}${typeof window !== 'undefined' && window.location.hash ? ` (${window.location.hash})` : ''}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const name = mode === 'coach' ? 'Coach' : 'Guide';

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={coach ? 'Open coach' : 'Open guide'}
          title={coach ? 'Coach' : 'Guide'}
          className="fixed right-4 bottom-4 z-40 grid size-15 animate-pop place-items-center rounded-full border border-border bg-card shadow-lift transition-transform outline-none hover:scale-105 focus-visible:ring-4 focus-visible:ring-ring/50 sm:right-6 sm:bottom-6"
        >
          <BotFace className="size-11" />
          {coach && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-success"
            />
          )}
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-label={name}
          className="bot-panel-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-card sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(640px,calc(100dvh-7rem))] sm:w-[400px] sm:rounded-3xl sm:border sm:border-border sm:shadow-lift"
        >
          <header className="flex items-center gap-3 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(99,102,241,0.14),rgba(168,85,247,0.16))] px-4 py-3">
            <BotFace talking={busy} className="size-11 shrink-0" />
            <div className="min-w-0 flex-1">
              {coach ? (
                <div
                  role="radiogroup"
                  aria-label="Assistant"
                  className="inline-flex rounded-full bg-background/70 p-0.5 text-sm font-semibold"
                >
                  {(['coach', 'guide'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setPicked(m)}
                      className={cn(
                        'rounded-full px-3 py-1 transition-colors',
                        mode === m
                          ? 'bg-primary text-primary-foreground shadow-soft'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {m === 'coach' ? 'Coach' : 'Guide'}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="font-semibold">Guide</p>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span
                  className={cn('size-1.5 rounded-full', busy ? 'bg-highlight' : 'bg-success')}
                />
                {busy ? 'Thinking…' : mode === 'coach' ? 'Can change this plan' : 'Here to help'}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              aria-label="Minimise"
              title="Minimise"
            >
              <ChevronDown />
            </Button>
          </header>
          {mode === 'coach' && coach ? (
            <CoachChat key={coach.learningId} coach={coach} onBusyChange={setBusy} />
          ) : (
            <GuideChat here={here} onBusyChange={setBusy} />
          )}
        </section>
      )}
    </>
  );
}

function CoachChat({
  coach,
  onBusyChange,
}: {
  coach: { learningId: string; title: string; language?: string };
  onBusyChange: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  return (
    <ChatPanel
      className="min-h-0 flex-1"
      queryKey={['coach', coach.learningId]}
      open={() => api.learnings.openConversation(coach.learningId, 'coach')}
      language={coach.language}
      onBusyChange={onBusyChange}
      onLearningChanged={() =>
        void qc.invalidateQueries({ queryKey: keys.learning(coach.learningId) })
      }
      placeholder="What should change?"
      emptyHint={
        <Intro>
          Want a change in <b className="text-foreground">{coach.title}</b>? Tell me — shorter, more
          practice, another shape, new topics — and I’ll update your journey.
        </Intro>
      }
    />
  );
}

function Intro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <BotFace className="size-20" />
      <p className="text-[0.95rem] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/** The guide keeps its chat while the learner moves between screens. */
let guideHistory: ChatMessage[] = [];

function GuideChat({
  here,
  onBusyChange,
}: {
  here: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessagesState] = useState<ChatMessage[]>(guideHistory);
  const [draft, setDraft] = useState('');
  const [live, setLive] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; message: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const setMessages = useCallback((next: ChatMessage[]) => {
    guideHistory = next;
    setMessagesState(next);
  }, []);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, live]);
  useEffect(() => onBusyChange(live !== null), [live, onBusyChange]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || live !== null) return;
    const mine: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      changes: [],
      createdAt: new Date().toISOString(),
    };
    const before = messages;
    setMessages([...before, mine]);
    setDraft('');
    setError(null);
    setLive('');
    try {
      const { reply } = await api.guide.ask(
        {
          page: here,
          messages: [...before, mine].slice(-12).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content.slice(0, 4000),
          })),
        },
        { onDelta: (t) => setLive((l) => (l ?? '') + t) },
      );
      setMessages([
        ...before,
        mine,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply,
          changes: [],
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages(before);
      setError({ text: content, message: describeError(err).description });
    } finally {
      setLive(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        aria-live="polite"
      >
        {!messages.length && live === null && (
          <Intro>
            Hi{user ? ` ${user.displayName.split(' ')[0]}` : ''}! Ask me how anything works or where
            to find it.
          </Intro>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {live !== null &&
          (live ? (
            <Bubble
              message={{ id: 'l', role: 'assistant', content: live, changes: [], createdAt: '' }}
              streaming
            />
          ) : (
            <div className="flex gap-1 px-1" aria-label="Thinking">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 animate-bounce rounded-full bg-primary/60"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          ))}
        {error && (
          <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void send(error.text)}
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="border-t border-border p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask anything…"
            aria-label="Message"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-[0.95rem] outline-none field-sizing-content focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || live !== null}
            aria-label="Send"
          >
            <SendHorizontal />
          </Button>
        </div>
        {messages.length > 2 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" aria-hidden /> New chat
          </button>
        )}
      </form>
    </div>
  );
}
