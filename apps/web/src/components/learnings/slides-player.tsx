'use client';

import { DEFAULT_TEACHER_VOICE, type StepDetail } from '@studythinker/shared';
import {
  ChevronLeft,
  ChevronRight,
  Captions,
  MonitorPlay,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MermaidDiagram } from '@/components/common/mermaid';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { speak, speechSupported, stopSpeaking } from '@/lib/speech';
import { cn } from '@/lib/utils';
import { TeacherFace } from './teacher-face';

/** A narrated slideshow: slides on screen, the teacher's voice reading the narration. */
export function SlidesPlayer({
  detail,
  onUpdate,
}: {
  detail: StepDetail;
  onUpdate: (d: StepDetail) => void;
}) {
  const { learning, step } = detail;
  const slides = useMemo(() => detail.media.slides ?? [], [detail.media.slides]);
  const prefs = learning.preferences;
  const [making, setMaking] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(true);

  async function make() {
    setMaking(true);
    try {
      onUpdate(await api.learnings.slides(learning.id, step.id));
      setIndex(0);
    } catch (err) {
      toast.error(describeError(err).description);
    } finally {
      setMaking(false);
    }
  }

  // Narrate the current slide while playing, then move on.
  useEffect(() => {
    if (!playing || !slides[index]) return;
    let cancelled = false;
    const voice = prefs?.voice ?? DEFAULT_TEACHER_VOICE;
    const wait = speechSupported()
      ? speak(slides[index].narration, voice, prefs?.language)
      : new Promise<void>((r) => setTimeout(r, 6000));
    void wait.then(() => {
      if (cancelled) return;
      if (index < slides.length - 1) setTimeout(() => !cancelled && setIndex(index + 1), 500);
      else setPlaying(false);
    });
    return () => {
      cancelled = true;
    };
  }, [playing, index, slides, prefs]);

  useEffect(() => () => stopSpeaking(), []);

  const go = (i: number) => {
    stopSpeaking();
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
  };

  if (!slides.length)
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <MonitorPlay className="size-9 text-primary" aria-hidden />
        <Button size="lg" onClick={() => void make()} disabled={making}>
          {making ? <RefreshCw className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {making ? 'Making…' : 'Make slideshow'}
        </Button>
      </div>
    );

  const slide = slides[index]!;
  return (
    <div className="space-y-3">
      <div className="relative flex min-h-80 w-full flex-col sm:aspect-video sm:min-h-72 overflow-hidden rounded-2xl bg-[linear-gradient(150deg,#1E1B4B,#312E81_55%,#4C1D95)] p-6 text-white shadow-lift sm:p-10">
        <p className="text-xs font-medium tracking-wide text-white/60 uppercase">
          {index + 1} / {slides.length}
        </p>
        <h2 key={`t${index}`} className="mt-2 animate-rise text-2xl font-semibold sm:text-3xl">
          {slide.title}
        </h2>
        <div className="mt-4 flex min-h-0 flex-1 gap-6">
          <ul className="flex-1 space-y-2.5 text-base sm:text-lg">
            {slide.bullets.map((b, i) => (
              <li
                key={`${index}-${i}`}
                className="flex animate-rise gap-2"
                style={{ animationDelay: `${250 + i * 350}ms` }}
              >
                <span className="mt-2.5 size-2 shrink-0 rounded-full bg-cyan-300" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
          {slide.diagram && (
            <div className="hidden max-w-[45%] min-w-0 flex-1 rounded-xl bg-white p-2 text-foreground sm:block">
              <MermaidDiagram code={slide.diagram} className="my-0 border-0 p-1" />
            </div>
          )}
        </div>
        <div className="absolute right-4 bottom-4 rounded-full bg-white/10 p-1 backdrop-blur">
          <TeacherFace look={prefs?.look} size={72} state={playing ? 'speaking' : 'idle'} />
        </div>
      </div>
      {slide.diagram && (
        <div className="sm:hidden">
          <MermaidDiagram code={slide.diagram} />
        </div>
      )}
      {captions && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed" aria-live="polite">
          {slide.narration}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft />
        </Button>
        <Button
          onClick={() => {
            if (playing) {
              setPlaying(false);
              stopSpeaking();
            } else {
              if (index === slides.length - 1 && !playing) setIndex(0);
              setPlaying(true);
            }
          }}
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          {playing ? 'Pause' : index === 0 ? 'Play' : 'Resume'}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => go(index + 1)}
          disabled={index === slides.length - 1}
          aria-label="Next slide"
        >
          <ChevronRight />
        </Button>
        <div className="mx-2 flex flex-1 gap-1" aria-hidden>
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
        <Button
          size="icon"
          variant={captions ? 'secondary' : 'ghost'}
          onClick={() => setCaptions((c) => !c)}
          aria-label={captions ? 'Hide captions' : 'Show captions'}
        >
          <Captions />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => void make()}
          disabled={making}
          aria-label="Remake slides"
          title="Remake slides"
        >
          <RefreshCw className={cn(making && 'animate-spin')} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
