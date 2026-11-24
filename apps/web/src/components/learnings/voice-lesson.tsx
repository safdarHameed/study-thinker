'use client';

import type { ChatMessage, Conversation, LearningPreferences } from '@studythinker/shared';
import { DEFAULT_TEACHER_VOICE, TEACHER_PERSONAS } from '@studythinker/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, PhoneOff, Square, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { useAiSettings, useRefreshProgress } from '@/lib/queries';
import {
  createSpeechStream,
  dictationMethod,
  speak,
  speakable,
  speechSupported,
  stopSpeaking,
  useDictation,
} from '@/lib/speech';
import { cn } from '@/lib/utils';
import { TeacherFace } from './teacher-face';

type Phase = 'idle' | 'speaking' | 'listening' | 'thinking';

/** A spoken lesson: the teacher talks (browser voice), the learner answers out loud. */
export function VoiceLesson({
  learningId,
  stepId,
  prefs,
}: {
  learningId: string;
  stepId: string;
  prefs: LearningPreferences;
}) {
  const qc = useQueryClient();
  const queryKey = ['voice', learningId, stepId];
  const conversation = useQuery({
    queryKey,
    queryFn: () => api.learnings.openConversation(learningId, 'voice', stepId),
  });
  const settings = useAiSettings();
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voice = prefs.voice ?? DEFAULT_TEACHER_VOICE;
  const persona = TEACHER_PERSONAS.find((t) => t.id === prefs.teacher);
  const activeRef = useRef(false);
  const speechRef = useRef<ReturnType<typeof createSpeechStream> | null>(null);
  /** What the teacher is saying right now, shown as a live caption. */
  const [caption, setCaption] = useState('');
  const refreshProgress = useRefreshProgress();

  /** Streams a teacher reply: captions and speech start with the first words. */
  const streamTeacher = useCallback(
    async (run: (h: { onDelta: (t: string) => void }) => Promise<{ message: ChatMessage }>) => {
      setCaption('');
      const speech = !muted && speechSupported() ? createSpeechStream(voice, prefs.language) : null;
      speechRef.current = speech;
      let first = true;
      const res = await run({
        onDelta: (t) => {
          if (first) {
            first = false;
            setPhase(speech ? 'speaking' : 'idle');
          }
          setCaption((c) => c + t);
          speech?.push(t);
        },
      });
      if (speech) {
        setPhase('speaking');
        await speech.finish();
      }
      speechRef.current = null;
      return res;
    },
    [muted, voice, prefs.language],
  );

  const append = useCallback(
    (msgs: ChatMessage[]) =>
      qc.setQueryData<Conversation>(queryKey, (c) =>
        c ? { ...c, messages: [...c.messages, ...msgs] } : c,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, learningId, stepId],
  );

  const dictation = useDictation({
    method: dictationMethod(settings.data?.serverTranscription ?? false),
    language: prefs.language,
    onText: (text) => void reply(text),
  });

  const say = useCallback(
    async (text: string) => {
      if (muted || !speechSupported()) return;
      setPhase('speaking');
      await speak(speakable(text), voice, prefs.language);
    },
    [muted, voice, prefs.language],
  );

  const afterTeacher = useCallback(() => {
    if (!activeRef.current) return;
    // Like a phone call: after the teacher speaks, listen for the answer.
    if (dictation.supported) {
      setPhase('listening');
      void dictation.start();
    } else setPhase('idle');
  }, [dictation]);

  async function reply(text: string) {
    const conv = conversation.data;
    if (!conv) return;
    setPhase('thinking');
    setError(null);
    append([
      {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        changes: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      const res = await streamTeacher((h) => api.conversations.sendStream(conv.id, text, h));
      refreshProgress();
      append([res.message]);
      afterTeacher();
    } catch (err) {
      setError(describeError(err).description);
      setPhase('idle');
    }
  }

  async function start() {
    const conv = conversation.data;
    if (!conv) return;
    activeRef.current = true;
    setStarted(true);
    setError(null);
    const last = conv.messages.at(-1);
    if (!conv.messages.length) {
      setPhase('thinking');
      try {
        const res = await streamTeacher((h) => api.conversations.openingStream(conv.id, h));
        append([res.message]);
      } catch (err) {
        setError(describeError(err).description);
        setPhase('idle');
        return;
      }
    } else if (last?.role === 'assistant') {
      await say(last.content);
    }
    afterTeacher();
  }

  function hangUp() {
    activeRef.current = false;
    speechRef.current?.cancel();
    stopSpeaking();
    dictation.stop();
    setStarted(false);
    setPhase('idle');
  }

  useEffect(
    () => () => {
      activeRef.current = false;
      stopSpeaking();
    },
    [],
  );

  // The dictation hook flips back from listening when the learner stops.
  const listening = dictation.listening;
  const shownPhase: Phase = listening
    ? 'listening'
    : dictation.transcribing
      ? 'thinking'
      : phase === 'listening'
        ? 'idle'
        : phase;
  const messages = conversation.data?.messages ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-[linear-gradient(160deg,var(--color-secondary),transparent)] px-4 py-8 text-center">
        <div
          className={cn(
            'rounded-full shadow-lift transition-transform',
            shownPhase === 'listening' && 'ring-8 ring-primary/20',
          )}
        >
          <TeacherFace
            look={prefs.look}
            size={168}
            state={
              shownPhase === 'speaking'
                ? 'speaking'
                : shownPhase === 'listening'
                  ? 'listening'
                  : shownPhase === 'thinking'
                    ? 'thinking'
                    : 'idle'
            }
          />
        </div>
        <div>
          <p className="font-semibold">{persona?.label ?? 'Your teacher'}</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {!started
              ? 'Ready'
              : shownPhase === 'speaking'
                ? 'Speaking…'
                : shownPhase === 'listening'
                  ? dictation.interim || 'Listening…'
                  : shownPhase === 'thinking'
                    ? 'Thinking…'
                    : 'Your turn'}
          </p>
        </div>

        {started && caption && (shownPhase === 'speaking' || shownPhase === 'thinking') && (
          <p
            className="max-w-xl rounded-2xl bg-card/80 px-4 py-3 text-left text-[0.95rem] leading-relaxed shadow-soft"
            aria-live="off"
          >
            {caption}
          </p>
        )}

        {!started ? (
          <Button size="lg" onClick={() => void start()} disabled={!conversation.data}>
            <Mic aria-hidden /> {messages.length ? 'Continue' : 'Start'}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              size="icon-lg"
              className="rounded-full"
              variant={listening ? 'destructive' : 'default'}
              disabled={!dictation.supported || shownPhase === 'thinking'}
              onClick={() => {
                if (listening) dictation.stop();
                else {
                  stopSpeaking();
                  void dictation.start();
                }
              }}
              aria-label={listening ? 'Finish speaking' : 'Answer out loud'}
            >
              {shownPhase === 'thinking' ? (
                <Spinner className="size-5 border-white/40 border-t-white" />
              ) : listening ? (
                <Square />
              ) : (
                <Mic />
              )}
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setMuted((m) => !m);
                stopSpeaking();
              }}
              aria-label={muted ? 'Unmute teacher' : 'Mute teacher'}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button
              size="icon"
              variant="destructive-soft"
              className="rounded-full"
              onClick={hangUp}
              aria-label="End the lesson"
            >
              <PhoneOff />
            </Button>
          </div>
        )}

        {!dictation.supported && (
          <p className="max-w-md text-sm text-warning">No mic here — answer in Chat.</p>
        )}
        {(error || dictation.error) && (
          <p role="alert" className="max-w-md text-sm text-destructive">
            {error ?? dictation.error}
          </p>
        )}
      </div>

      {messages.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-4" open={!speechSupported()}>
          <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
          <ol className="mt-3 space-y-2.5 text-sm">
            {messages.map((m) => (
              <li key={m.id}>
                <span className="font-semibold">
                  {m.role === 'user' ? 'You' : (persona?.label ?? 'Teacher')}:{' '}
                </span>
                {m.content}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
