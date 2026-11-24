'use client';

import type { JourneyStep } from '@studythinker/shared';
import {
  ArrowRight,
  Check,
  Clock,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Engine } from './engine';

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains('dark'));
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function JourneyWorld({
  structure,
  learningId,
  steps,
  fresh,
  nextId,
  onUnsupported,
}: {
  structure: string;
  learningId: string;
  steps: JourneyStep[];
  fresh: ReadonlySet<string>;
  nextId: string | null;
  onUnsupported(): void;
}) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const dark = useDark();
  const [hover, setHover] = useState<JourneyStep | null>(null);
  const [selected, setSelected] = useState<JourneyStep | null>(null);
  const [full, setFull] = useState(false);
  const [readySig, setReadySig] = useState('');

  // Rebuild only when something that changes the picture changes.
  const signature = `${structure}|${dark}|${nextId}|${[...fresh].join(',')}|${steps
    .map((s) => `${s.id}:${s.status}:${s.group}:${s.parentKey}`)
    .join(';')}`;

  useEffect(() => {
    let cancelled = false;
    const stage = stageRef.current!;
    void import('./engine').then(({ mountJourney }) => {
      if (cancelled) return;
      try {
        engine.current = mountJourney(stage, {
          structure,
          steps,
          seed: learningId,
          dark,
          nextId,
          fresh,
          tipEl: tipRef.current!,
          pinEl: pinRef.current!,
          onHover: setHover,
          onSelect: setSelected,
          onOpen: (step) => router.push(`/learnings/${learningId}/steps/${step.id}`),
        });
        setReadySig(signature);
      } catch {
        onUnsupported();
      }
    });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` captures every input
  }, [signature]);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === boxRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boxRef.current?.requestFullscreen?.();
  };

  const ready = readySig === signature;
  const tip = hover ?? null;
  const done = steps.filter((s) => s.status === 'done').length;

  return (
    <div
      ref={boxRef}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-border bg-surface-sunken shadow-soft',
        full ? 'h-screen rounded-none border-0' : 'h-[min(72vh,640px)] min-h-[420px]',
      )}
    >
      <div ref={stageRef} className="absolute inset-0" data-journey-3d={structure} />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      )}

      {/* "You are here" chip follows the 3D pin */}
      <div
        ref={pinRef}
        className="pointer-events-none absolute top-0 left-0 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-primary-foreground opacity-0 shadow-lift transition-opacity"
      >
        You are here
      </div>

      {/* Hover tooltip */}
      <div
        ref={tipRef}
        className="pointer-events-none absolute top-0 left-0 -mt-3 max-w-56 rounded-xl bg-card/95 px-3 py-2 text-sm opacity-0 shadow-lift backdrop-blur transition-opacity"
      >
        {(tip ?? selected) && <TipBody step={(tip ?? selected)!} fresh={fresh} />}
      </div>

      {/* Progress chip */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-full bg-card/85 px-3 py-1.5 text-sm font-medium shadow-soft backdrop-blur">
        <Check className="size-4 text-success" aria-hidden />
        {done}/{steps.length}
      </div>

      {/* Camera controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5">
        <CtrlButton label="Zoom in" onClick={() => engine.current?.zoom(0.7)}>
          <Plus />
        </CtrlButton>
        <CtrlButton label="Zoom out" onClick={() => engine.current?.zoom(1.4)}>
          <Minus />
        </CtrlButton>
        <CtrlButton label="Reset view" onClick={() => engine.current?.reset()}>
          <RotateCcw />
        </CtrlButton>
        <CtrlButton label={full ? 'Exit full screen' : 'Full screen'} onClick={toggleFull}>
          {full ? <Minimize2 /> : <Maximize2 />}
        </CtrlButton>
      </div>

      {/* Selected step */}
      {selected && (
        <div className="absolute inset-x-3 bottom-3 mx-auto flex max-w-md animate-pop items-center gap-3 rounded-2xl bg-card/95 p-3 pl-4 shadow-lift backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{selected.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden /> {selected.minutes} min
              {selected.group ? <span className="truncate">· {selected.group}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/learnings/${learningId}/steps/${selected.id}`)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {selected.status === 'done'
              ? 'Review'
              : selected.status === 'in_progress'
                ? 'Continue'
                : 'Start'}
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSelected(null)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Keyboard and screen-reader access to every step */}
      <ol className="sr-only">
        {steps.map((s) => (
          <li key={s.id}>
            <a href={`/learnings/${learningId}/steps/${s.id}`} data-step-id={s.id}>
              {s.title} (
              {s.status === 'done' ? 'done' : s.status === 'in_progress' ? 'in progress' : 'to do'})
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TipBody({ step, fresh }: { step: JourneyStep; fresh: ReadonlySet<string> }) {
  return (
    <>
      <p className="leading-snug font-medium">{step.title}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            'size-2 rounded-full',
            step.status === 'done'
              ? 'bg-success'
              : step.status === 'in_progress'
                ? 'bg-warning'
                : 'bg-border',
          )}
        />
        {step.minutes} min
        {fresh.has(step.id) && <span className="font-semibold text-highlight">· new</span>}
      </p>
    </>
  );
}

function CtrlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-xl bg-card/85 text-foreground shadow-soft backdrop-blur transition-colors hover:bg-card [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
