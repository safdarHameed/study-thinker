'use client';

import type { ChatMessage, Conversation } from '@studythinker/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Mic, RotateCcw, SendHorizontal, Sparkles, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Markdown } from '@/components/common/markdown';
import { Spinner } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { shortModel } from '@/components/engage/ai-working';
import { keys, useAiSettings, useAiStatus, useRefreshProgress } from '@/lib/queries';
import { dictationMethod, useDictation } from '@/lib/speech';
import { cn } from '@/lib/utils';

/**
 * A conversation with the AI: the learning's coach, or a tutor/debate for a step.
 * The conversation is opened (or created) by `open`.
 */
export function ChatPanel({
  queryKey,
  open,
  language,
  placeholder = 'Type a message…',
  suggestions = [],
  emptyHint,
  onLearningChanged,
  teacherFirst = false,
  choicesFromReply = false,
  disabled = false,
  onBusyChange,
  className,
}: {
  queryKey: readonly unknown[];
  open: () => Promise<Conversation>;
  language?: string;
  placeholder?: string;
  suggestions?: string[];
  emptyHint?: React.ReactNode;
  onLearningChanged?: () => void;
  /** Ask the AI to speak first when the conversation is empty. */
  teacherFirst?: boolean;
  /** Offer "A) / B) / C)" options in the last reply as buttons (simulations). */
  choicesFromReply?: boolean;
  disabled?: boolean;
  /** Called when the AI starts or stops answering. */
  onBusyChange?: (busy: boolean) => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const conversation = useQuery({ queryKey, queryFn: open });
  const settings = useAiSettings();
  const aiStatus = useAiStatus();
  const refreshProgress = useRefreshProgress();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  /** The reply as it streams in, and what the server is doing. */
  const [live, setLive] = useState<{ text: string; status: string | null }>({
    text: '',
    status: null,
  });
  const handlers = {
    onDelta: (t: string) => setLive((l) => ({ ...l, text: l.text + t })),
    onStatus: (status: string) => setLive((l) => ({ ...l, status })),
  };
  const [error, setError] = useState<{ text: string; message: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => onBusyChange?.(pending !== null), [pending, onBusyChange]);

  const conv = conversation.data;
  const messages = conv?.messages ?? [];

  const dictation = useDictation({
    method: dictationMethod(settings.data?.serverTranscription ?? false),
    language,
    onText: (t) => setDraft((d) => (d ? `${d} ${t}` : t)),
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending, live.text.length]);

  const append = (msgs: ChatMessage[]) =>
    qc.setQueryData<Conversation>(queryKey, (c) =>
      c ? { ...c, messages: [...c.messages, ...msgs] } : c,
    );

  // Let the teacher open the conversation (voice lessons, debates).
  useEffect(() => {
    if (!teacherFirst || !conv || conv.messages.length || startedRef.current) return;
    startedRef.current = true;
    setPending('');
    setLive({ text: '', status: null });
    api.conversations
      .openingStream(conv.id, handlers)
      .then((r) => append([r.message]))
      .catch((err: unknown) => setError({ text: '', message: describeError(err).description }))
      .finally(() => setPending(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherFirst, conv?.id, conv?.messages.length]);

  async function send(text: string) {
    if (!conv || !text.trim() || pending !== null) return;
    setError(null);
    setPending(text);
    setDraft('');
    setLive({ text: '', status: null });
    try {
      const res = await api.conversations.sendStream(conv.id, text.trim(), handlers);
      const userMsg: ChatMessage = {
        id: `local-${res.message.id}`,
        role: 'user',
        content: text.trim(),
        changes: [],
        createdAt: res.message.createdAt,
      };
      append([userMsg, res.message]);
      if (res.learningChanged) onLearningChanged?.();
      refreshProgress();
    } catch (err) {
      setError({ text, message: describeError(err).description });
      // The server kept the message; reload so it shows, then offer a retry.
      void qc.invalidateQueries({ queryKey });
    } finally {
      setPending(null);
    }
  }

  async function restart() {
    if (!conv) return;
    const fresh = await api.conversations.restart(conv.id);
    startedRef.current = false;
    qc.setQueryData(queryKey, fresh);
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        aria-live="polite"
      >
        {conversation.isPending && (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        )}
        {conv && !messages.length && pending === null && (
          <div className="space-y-3 py-4 text-sm text-muted-foreground">
            {emptyHint}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={disabled}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-foreground hover:border-primary/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {pending !== null && (
          <>
            {pending && (
              <Bubble
                message={{ id: 'p', role: 'user', content: pending, changes: [], createdAt: '' }}
              />
            )}
            {live.text ? (
              <Bubble
                message={{
                  id: 'l',
                  role: 'assistant',
                  content: live.text,
                  changes: [],
                  createdAt: '',
                }}
                streaming
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse text-primary" aria-hidden />
                {shortModel(aiStatus.data?.model)} thinking…
              </div>
            )}
            {live.status && (
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Spinner className="size-4" /> {live.status}
              </div>
            )}
          </>
        )}
        {choicesFromReply && pending === null && messages.at(-1)?.role === 'assistant' && (
          <div className="flex flex-col gap-2" aria-label="What do you do?">
            {replyChoices(messages.at(-1)!.content).map((c) => (
              <button
                key={c.letter}
                type="button"
                onClick={() => void send(`${c.letter}) ${c.text}`)}
                className="flex animate-rise items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-primary/10"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {c.letter}
                </span>
                {c.text}
              </button>
            ))}
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}{' '}
            {error.text && (
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => void send(error.text)}
              >
                Try again
              </button>
            )}
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
        {dictation.error && <p className="mb-2 text-xs text-destructive">{dictation.error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={dictation.interim || draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            maxLength={4000}
            disabled={disabled || !conv}
            placeholder={dictation.listening ? 'Listening…' : placeholder}
            aria-label="Message"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-[0.95rem] outline-none field-sizing-content focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          {dictation.supported && (
            <Button
              type="button"
              size="icon"
              variant={dictation.listening ? 'destructive' : 'outline'}
              onClick={() => (dictation.listening ? dictation.stop() : void dictation.start())}
              disabled={disabled || dictation.transcribing}
              aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
            >
              {dictation.transcribing ? (
                <Spinner className="size-4" />
              ) : dictation.listening ? (
                <Square />
              ) : (
                <Mic />
              )}
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !draft.trim() || pending !== null}
            aria-label="Send"
          >
            <SendHorizontal />
          </Button>
        </div>
        {messages.length > 2 && (
          <button
            type="button"
            onClick={() => void restart()}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" aria-hidden /> New chat
          </button>
        )}
      </form>
    </div>
  );
}

/** "A) Do this" lines at the end of a simulation reply. */
export function replyChoices(text: string) {
  return [...text.matchAll(/^\s*\**\s*([A-D])[).:]\**\s+(.+)$/gm)]
    .map((m) => ({ letter: m[1]!, text: m[2]!.replace(/\*\*/g, '').trim() }))
    .slice(-4);
}

export function Bubble({
  message,
  streaming = false,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  const mine = message.role === 'user';
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[0.95rem]',
          mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted',
        )}
      >
        {mine ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {/* Keep "A) … / B) …" choices on their own lines. */}
            <Markdown className="lw-prose-sm">
              {message.content.replace(/\n(?=\s*\**[A-D][).:]\**\s)/g, '\n\n')}
            </Markdown>
            {streaming && (
              <span
                className="ml-0.5 inline-block h-4 w-1.5 animate-blink rounded-sm bg-primary align-middle"
                aria-hidden
              />
            )}
          </>
        )}
        {message.changes.length > 0 && (
          <ul className="mt-2.5 space-y-1 border-t border-border/60 pt-2.5 text-sm">
            {message.changes.map((c, i) => (
              <li key={i} className="flex gap-1.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <Markdown className="lw-prose-sm [&_p]:m-0">{c}</Markdown>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { keys };
