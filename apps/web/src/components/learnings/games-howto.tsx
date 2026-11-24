'use client';

import { Check, GripVertical, MousePointer2, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GameId = 'memory' | 'words' | 'sort' | 'sequence' | 'fact';

/** How each game is played, in three short steps. */
export const HOW_TO: Record<GameId, string[]> = {
  memory: [
    'Tap a card to flip it over.',
    'Flip a second card. If the term and its meaning belong together, both stay open.',
    'If not, they flip back. Remember where they were and match every pair in as few moves as you can.',
  ],
  words: [
    'Read a clue on the right.',
    'Find its word hidden in the grid: across, down or diagonal.',
    'Drag from the first letter to the last (or tap both). Find every word.',
  ],
  sort: [
    'Each card belongs to one of the groups.',
    'Drag it into the right box, or tap the card and then the box.',
    'A wrong box shakes; try another. Sort every card.',
  ],
  sequence: [
    'These steps are mixed up.',
    'Drag the ⋮⋮ handle (or use the arrows) to put them in order, first at the top.',
    'Press Check order. Green means the right place.',
  ],
  fact: [
    'Read the statement on the card.',
    'True? Swipe right or press Fact. False? Swipe left or press Fiction.',
    'Be quick: the bar is your time. Right answers in a row multiply your points.',
  ],
};

/** Steps through frames 0…n-1 forever. */
function useLoop(frames: number, ms = 900) {
  const [f, setF] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setF((x) => (x + 1) % frames), ms);
    return () => clearInterval(t);
  }, [frames, ms]);
  return f;
}

function Pointer({ className }: { className?: string }) {
  return (
    <MousePointer2
      className={cn(
        'pointer-events-none absolute z-10 size-6 fill-white text-slate-900 drop-shadow transition-all duration-500',
        className,
      )}
      aria-hidden
    />
  );
}

// ───────────── Demos (sample data, no real answers) ─────────────

function MemoryDemo() {
  const f = useLoop(8);
  const cards = ['Sun', 'Moon', 'Star at our centre', 'Circles the Earth'];
  // which cards are up, and which are matched, in each frame
  const up = [[], [0], [0, 2], [0, 2], [0, 2, 1], [0, 2, 1, 3], [0, 2, 1, 3], [0, 2, 1, 3]][f]!;
  const matched = f >= 3 ? (f >= 6 ? [0, 1, 2, 3] : [0, 2]) : [];
  const at = [0, 0, 2, 2, 1, 3, 3, 3][f]!;
  return (
    <div className="relative mx-auto grid w-56 grid-cols-2 gap-2">
      {cards.map((c, i) => {
        const open = up.includes(i);
        return (
          <div key={c} className="aspect-[4/3] [perspective:600px]">
            <div
              className={cn(
                'relative size-full transition-transform duration-500 [transform-style:preserve-3d]',
                open && '[transform:rotateY(180deg)]',
              )}
            >
              <div className="absolute inset-0 grid place-items-center rounded-lg bg-linear-to-br from-sky-400 to-indigo-500 text-white/80 [backface-visibility:hidden]">
                ?
              </div>
              <div
                className={cn(
                  'absolute inset-0 grid place-items-center rounded-lg border-2 p-1 text-center text-[11px] leading-tight font-semibold [transform:rotateY(180deg)] [backface-visibility:hidden]',
                  matched.includes(i)
                    ? 'border-success bg-success-soft'
                    : 'border-primary/40 bg-card',
                )}
              >
                {c}
              </div>
            </div>
          </div>
        );
      })}
      <Pointer
        className={cn(at % 2 ? 'left-[72%]' : 'left-[22%]', at >= 2 ? 'top-[70%]' : 'top-[22%]')}
      />
    </div>
  );
}

function WordsDemo() {
  const f = useLoop(6, 700);
  const grid = ['QSUNT', 'BRMOX', 'LKAPE', 'ZEDWO', 'HIVNC'];
  // S-U-N across the first row
  const lit = f === 0 ? [] : f === 1 ? [1] : f === 2 ? [1, 2] : [1, 2, 3];
  const found = f >= 4;
  return (
    <div className="relative mx-auto w-48">
      <div className="grid grid-cols-5 gap-1">
        {grid.map((row, r) =>
          [...row].map((ch, c) => {
            const on = r === 0 && lit.includes(c);
            return (
              <span
                key={`${r}${c}`}
                className={cn(
                  'grid aspect-square place-items-center rounded text-xs font-bold transition-colors',
                  on
                    ? found
                      ? 'bg-emerald-400 text-slate-900'
                      : 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                {ch}
              </span>
            );
          }),
        )}
      </div>
      <Pointer
        className={cn('top-[6%]', f <= 1 ? 'left-[26%]' : f === 2 ? 'left-[46%]' : 'left-[66%]')}
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Clue: <i>The star we orbit</i> {found && <b className="text-foreground">→ SUN ✓</b>}
      </p>
    </div>
  );
}

function SortDemo() {
  const f = useLoop(5, 850);
  const moving = f >= 1 && f <= 2;
  const dropped = f >= 3;
  return (
    <div className="relative mx-auto w-60 space-y-3">
      <div className="flex h-9 justify-center gap-1.5">
        {!dropped && (
          <span
            className={cn(
              'rounded-lg border-2 border-primary bg-card px-2.5 py-1 text-xs font-medium shadow-soft transition-all duration-700',
              moving && 'translate-x-[-3.4rem] translate-y-[3.6rem] rotate-3',
            )}
          >
            Mars
          </span>
        )}
        <span className="rounded-lg border-2 border-border bg-card px-2.5 py-1 text-xs font-medium">
          Comet
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div
          className={cn(
            'min-h-16 rounded-xl border-2 border-dashed border-sky-400/60 bg-sky-50 p-1.5 text-center text-[11px] font-bold uppercase dark:bg-sky-950/40',
            moving && 'border-solid',
          )}
        >
          Planets
          {dropped && (
            <span className="mt-1 block animate-pop rounded bg-card py-0.5 text-xs font-medium normal-case">
              ✓ Mars
            </span>
          )}
        </div>
        <div className="min-h-16 rounded-xl border-2 border-dashed border-amber-400/60 bg-amber-50 p-1.5 text-center text-[11px] font-bold uppercase dark:bg-amber-950/40">
          Not planets
        </div>
      </div>
      <Pointer
        className={cn(
          'transition-all duration-700',
          moving || dropped ? 'top-[62%] left-[22%]' : 'top-[4%] left-[44%]',
        )}
      />
    </div>
  );
}

function SequenceDemo() {
  const f = useLoop(5, 900);
  const order = f >= 2 ? ['Seed', 'Sprout', 'Flower'] : ['Sprout', 'Seed', 'Flower'];
  const checked = f >= 3;
  return (
    <div className="relative mx-auto w-52 space-y-1.5">
      {order.map((x) => (
        <div
          key={x}
          className={cn(
            'flex items-center gap-2 rounded-lg border-2 bg-card px-2 py-1.5 text-xs font-medium transition-all duration-500',
            checked ? 'border-success bg-success-soft' : 'border-border',
            f === 1 && x === 'Seed' && '-translate-y-2 border-primary shadow-lift',
          )}
        >
          <GripVertical className="size-3.5 text-muted-foreground" aria-hidden />
          {x}
          {checked && <Check className="ml-auto size-3.5 text-success" aria-hidden />}
        </div>
      ))}
      <Pointer className={cn(f <= 1 ? 'top-[45%] left-[6%]' : 'top-[10%] left-[6%]')} />
    </div>
  );
}

function FactDemo() {
  const f = useLoop(5, 900);
  const swiping = f === 1 || f === 2;
  const answered = f >= 3;
  return (
    <div className="relative mx-auto w-56 space-y-2 overflow-hidden py-1">
      <div
        className={cn(
          'relative grid h-20 place-items-center rounded-xl border-2 bg-card px-3 text-center text-sm font-semibold shadow-soft transition-all duration-700',
          swiping && 'translate-x-10 rotate-6 border-success/70',
          answered && 'border-success',
        )}
      >
        {swiping && (
          <span className="absolute top-1.5 left-2 -rotate-12 rounded border-2 border-success px-1 text-[10px] font-bold text-success">
            FACT
          </span>
        )}
        The Sun is a star.
      </div>
      <p
        className={cn(
          'text-center text-xs font-bold text-success transition-opacity',
          answered ? 'opacity-100' : 'opacity-0',
        )}
      >
        ✓ Correct! It’s a fact.
      </p>
      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold">
        <span className="flex items-center justify-center gap-1 rounded-md border border-destructive/40 py-1 text-destructive">
          <X className="size-3" aria-hidden /> Fiction
        </span>
        <span className="flex items-center justify-center gap-1 rounded-md border border-success/40 py-1 text-success">
          <Check className="size-3" aria-hidden /> Fact
        </span>
      </div>
      <Pointer
        className={cn(
          'top-[30%] transition-all duration-700',
          swiping || answered ? 'left-[68%]' : 'left-[40%]',
        )}
      />
    </div>
  );
}

const DEMOS: Record<GameId, () => React.ReactElement> = {
  memory: MemoryDemo,
  words: WordsDemo,
  sort: SortDemo,
  sequence: SequenceDemo,
  fact: FactDemo,
};

export function HowToSteps({ id }: { id: GameId }) {
  return (
    <ol className="space-y-2.5">
      {HOW_TO[id].map((s, i) => (
        <li key={i} className="flex gap-2.5 text-sm">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {i + 1}
          </span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Before a game starts: a looping demo with sample data, the rules, and Play. */
export function HowToPlay({ id, onPlay }: { id: GameId; onPlay: () => void }) {
  const Demo = DEMOS[id];
  return (
    <div className="grid items-center gap-6 sm:grid-cols-2">
      <div className="rounded-2xl bg-muted/50 p-5" aria-label="Demo with sample data">
        <Demo />
        <p className="mt-3 text-center text-[11px] tracking-wide text-muted-foreground uppercase">
          Demo
        </p>
      </div>
      <div className="space-y-5">
        <h4 className="font-semibold">How to play</h4>
        <HowToSteps id={id} />
        <Button size="lg" onClick={onPlay} autoFocus>
          <Play aria-hidden /> Play
        </Button>
      </div>
    </div>
  );
}
