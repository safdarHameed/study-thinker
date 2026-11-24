'use client';

import type { GameSet, StepDetail } from '@studythinker/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Clock,
  Gamepad2,
  GripVertical,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fireConfetti } from '@/components/engage/confetti';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api';
import { useRefreshProgress } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { type GameId, HowToPlay, HowToSteps } from './games-howto';

const GAMES: Record<GameId, { name: string; blurb: string; emoji: string; tint: string }> = {
  memory: {
    name: 'Memory cards',
    blurb: 'Flip and match',
    emoji: '🃏',
    tint: 'from-sky-400 to-indigo-500',
  },
  words: {
    name: 'Word search',
    blurb: 'Find the hidden terms',
    emoji: '🔎',
    tint: 'from-emerald-400 to-teal-600',
  },
  sort: {
    name: 'Sort it',
    blurb: 'Drag into groups',
    emoji: '🧺',
    tint: 'from-amber-400 to-orange-500',
  },
  sequence: {
    name: 'Sequence',
    blurb: 'Put it in order',
    emoji: '🧩',
    tint: 'from-fuchsia-400 to-purple-600',
  },
  fact: {
    name: 'Fact or fiction',
    blurb: 'Beat the clock',
    emoji: '⚡',
    tint: 'from-rose-400 to-pink-600',
  },
};

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const starsFor = (score: number) => (score >= 90 ? 3 : score >= 65 ? 2 : score >= 35 ? 1 : 0);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function useClock(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return seconds;
}

/** Puzzle words from the key terms: one word, letters only, 3-10 long. */
function puzzleWords(pairs: GameSet['pairs']) {
  const seen = new Set<string>();
  return pairs
    .map((p) => ({
      word: p.left.toLocaleUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]/g, ''),
      clue: p.right,
    }))
    .filter((w) => /^\p{L}{3,10}$/u.test(w.word) && !seen.has(w.word) && seen.add(w.word))
    .slice(0, 7);
}

/** Which games this set can make. */
function available(games: GameSet): GameId[] {
  return [
    games.pairs.length >= 3 && ('memory' as const),
    puzzleWords(games.pairs).length >= 3 && ('words' as const),
    (games.groups?.length ?? 0) >= 2 && ('sort' as const),
    games.order && games.order.items.length >= 3 && ('sequence' as const),
    games.truths.length >= 3 && ('fact' as const),
  ].filter(Boolean) as GameId[];
}

/** Learning games for a step. Practice only — results give XP, not a grade. */
export function GamesPanel({
  detail,
  onUpdate,
}: {
  detail: StepDetail;
  onUpdate: (d: StepDetail) => void;
}) {
  const { learning, step } = detail;
  const games = detail.media.games;
  const refreshProgress = useRefreshProgress();
  const [making, setMaking] = useState(false);
  const [playing, setPlaying] = useState<GameId | null>(null);
  /** The rules and demo were seen (shown before every game is opened). */
  const [ready, setReady] = useState(false);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState<Partial<Record<GameId, number>>>({});

  async function make() {
    setMaking(true);
    try {
      onUpdate(await api.learnings.games(learning.id, step.id));
      setBest({});
      setPlaying(null);
    } catch (err) {
      toast.error(describeError(err).description);
    } finally {
      setMaking(false);
    }
  }

  const finish = useCallback(
    (id: GameId, score: number) => {
      setBest((b) => ({ ...b, [id]: Math.max(b[id] ?? 0, score) }));
      if (score >= 65) fireConfetti();
      void api.learnings
        .gameResult(learning.id, step.id, score)
        .then(refreshProgress)
        .catch(() => undefined);
    },
    [learning.id, step.id, refreshProgress],
  );

  if (!games)
    return (
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-border bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_70%)] px-6 py-14 text-center">
        <div className="flex gap-2 text-3xl" aria-hidden>
          {Object.values(GAMES).map((g) => (
            <span
              key={g.name}
              className={cn(
                'grid size-14 place-items-center rounded-2xl bg-linear-to-br shadow-soft',
                g.tint,
              )}
            >
              {g.emoji}
            </span>
          ))}
        </div>
        <Button size="lg" onClick={() => void make()} disabled={making}>
          {making ? <RefreshCw className="animate-spin" aria-hidden /> : <Gamepad2 aria-hidden />}
          {making ? 'Making games…' : 'Make games'}
        </Button>
      </div>
    );

  const list = available(games);
  const props = { onExit: () => setPlaying(null) };

  if (playing && !ready)
    return (
      <Frame id={playing} result={null} onAgain={() => undefined} onExit={props.onExit} intro>
        <HowToPlay id={playing} onPlay={() => setReady(true)} />
      </Frame>
    );

  if (playing) {
    const done = (score: number) => finish(playing, score);
    const again = () => setRound((r) => r + 1);
    return (
      <div key={`${playing}-${round}`}>
        {playing === 'memory' && (
          <MemoryGame pairs={games.pairs} onFinish={done} onAgain={again} {...props} />
        )}
        {playing === 'words' && (
          <WordSearch pairs={games.pairs} onFinish={done} onAgain={again} {...props} />
        )}
        {playing === 'sort' && (
          <SortGame groups={games.groups ?? []} onFinish={done} onAgain={again} {...props} />
        )}
        {playing === 'sequence' && games.order && (
          <SequenceGame order={games.order} onFinish={done} onAgain={again} {...props} />
        )}
        {playing === 'fact' && (
          <FactOrFiction truths={games.truths} onFinish={done} onAgain={again} {...props} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((id) => {
          const g = GAMES[id];
          const score = best[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setReady(false);
                setPlaying(id);
              }}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all outline-none hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-4 focus-visible:ring-ring/40"
            >
              <span
                className={cn(
                  'grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-3xl shadow-soft transition-transform group-hover:scale-110 group-hover:-rotate-6',
                  g.tint,
                )}
                aria-hidden
              >
                {g.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{g.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {score === undefined ? g.blurb : <Stars score={score} small />}
                </span>
              </span>
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Play
              </span>
            </button>
          );
        })}
      </div>
      <Button size="sm" variant="ghost" onClick={() => void make()} disabled={making}>
        <RefreshCw className={cn(making && 'animate-spin')} aria-hidden /> New games
      </Button>
    </div>
  );
}

function Stars({ score, small = false }: { score: number; small?: boolean }) {
  const n = starsFor(score);
  return (
    <span
      className={cn('tracking-tight', small ? 'text-sm' : 'text-4xl')}
      aria-label={`${n} of 3 stars`}
    >
      {'★'
        .repeat(n)
        .split('')
        .map((s, i) => (
          <span key={i} className="text-amber-400">
            {s}
          </span>
        ))}
      {'★'
        .repeat(3 - n)
        .split('')
        .map((s, i) => (
          <span key={`e${i}`} className="text-muted-foreground/30">
            {s}
          </span>
        ))}
    </span>
  );
}

interface GameProps {
  onFinish: (score: number) => void;
  onAgain: () => void;
  onExit: () => void;
}

/** The frame every game shares: back, name, live stats, and the result at the end. */
function Frame({
  id,
  stats,
  result,
  onAgain,
  onExit,
  intro = false,
  children,
}: {
  id: GameId;
  stats?: React.ReactNode;
  result: { score: number; line: string } | null;
  onAgain: () => void;
  onExit: () => void;
  /** The how-to-play screen (no help button). */
  intro?: boolean;
  children: React.ReactNode;
}) {
  const g = GAMES[id];
  const [help, setHelp] = useState(false);
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <header
        className={cn(
          'flex items-center gap-3 bg-linear-to-r px-4 py-3 text-white sm:px-5',
          g.tint,
        )}
      >
        <button
          type="button"
          onClick={onExit}
          aria-label="All games"
          className="grid size-9 place-items-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="hidden text-2xl sm:inline" aria-hidden>
          {g.emoji}
        </span>
        <h3 className="flex-1 truncate text-lg font-semibold">{g.name}</h3>
        <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">{stats}</div>
        {!intro && (
          <button
            type="button"
            onClick={() => setHelp((h) => !h)}
            aria-label="How to play"
            aria-expanded={help}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 font-bold transition-colors hover:bg-white/30"
          >
            ?
          </button>
        )}
      </header>
      <div className={cn('relative p-4 sm:p-6', (result || help) && 'min-h-80')}>
        {children}
        {help && !result && (
          <div className="absolute inset-0 z-10 flex animate-pop flex-col justify-center gap-4 bg-card/97 p-6 backdrop-blur-sm sm:px-10">
            <h4 className="font-semibold">How to play</h4>
            <HowToSteps id={id} />
            <Button className="self-start" onClick={() => setHelp(false)}>
              Got it
            </Button>
          </div>
        )}
        {result && (
          <div className="absolute inset-0 z-10 flex animate-pop flex-col items-center justify-center gap-3 bg-card/95 p-6 text-center backdrop-blur-sm">
            <Stars score={result.score} />
            <p className="text-2xl font-semibold">
              {result.score >= 90
                ? 'Brilliant!'
                : result.score >= 65
                  ? 'Great job!'
                  : result.score >= 35
                    ? 'Good effort!'
                    : 'Keep practising!'}
            </p>
            <p className="text-muted-foreground">{result.line}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={onExit}>
                All games
              </Button>
              <Button onClick={onAgain}>
                <RefreshCw aria-hidden /> Play again
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      className={cn(
        'items-center gap-1 rounded-full bg-white/20 px-2.5 py-1',
        wide ? 'hidden sm:inline-flex' : 'inline-flex',
      )}
    >
      {children}
    </span>
  );
}

// ───────────── Memory cards ─────────────

function MemoryGame({ pairs, onFinish, onAgain, onExit }: GameProps & { pairs: GameSet['pairs'] }) {
  const used = useMemo(() => pairs.slice(0, 6), [pairs]);
  const [cards] = useState(() =>
    shuffled(
      used.flatMap((p, i) => [
        { key: `${i}t`, pair: i, text: p.left, term: true },
        { key: `${i}c`, pair: i, text: p.right, term: false },
      ]),
    ),
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [miss, setMiss] = useState(false);
  const [result, setResult] = useState<{ score: number; line: string } | null>(null);
  const seconds = useClock(!result);

  function flip(i: number) {
    const card = cards[i]!;
    if (result || miss || matched.has(card.pair) || open.includes(i) || open.length === 2) return;
    if (open.length === 0) return setOpen([i]);
    const first = cards[open[0]!]!;
    setOpen([open[0]!, i]);
    const m = moves + 1;
    setMoves(m);
    if (first.pair === card.pair) {
      const next = new Set(matched).add(card.pair);
      setTimeout(() => {
        setMatched(next);
        setOpen([]);
        if (next.size === used.length) {
          const score = clamp(100 - (m - used.length) * (100 / (used.length * 2)));
          setResult({ score, line: `${m} moves · ${mmss(seconds)}` });
          onFinish(score);
        }
      }, 350);
    } else {
      setMiss(true);
      setTimeout(() => {
        setOpen([]);
        setMiss(false);
      }, 950);
    }
  }

  return (
    <Frame
      id="memory"
      result={result}
      onAgain={onAgain}
      onExit={onExit}
      stats={
        <>
          <Stat>
            {matched.size}/{used.length}
          </Stat>
          <Stat>
            {moves} {moves === 1 ? 'move' : 'moves'}
          </Stat>
          <Stat wide>
            <Clock className="size-3.5" aria-hidden /> {mmss(seconds)}
          </Stat>
        </>
      }
    >
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {cards.map((c, i) => {
          const up = open.includes(i) || matched.has(c.pair);
          const done = matched.has(c.pair);
          const wrong = miss && open.includes(i);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => flip(i)}
              aria-label={up ? c.text : 'Hidden card'}
              className="aspect-[4/3] [perspective:900px] outline-none focus-visible:ring-4 focus-visible:ring-ring/40 rounded-xl"
            >
              <span
                className={cn(
                  'relative block size-full transition-transform duration-500 [transform-style:preserve-3d]',
                  up && '[transform:rotateY(180deg)]',
                  wrong && 'animate-shake',
                )}
              >
                <span className="absolute inset-0 grid place-items-center rounded-xl bg-linear-to-br from-sky-400 to-indigo-500 shadow-soft [backface-visibility:hidden]">
                  <span className="grid size-10 place-items-center rounded-full border-2 border-white/50 text-lg font-bold text-white/90">
                    ?
                  </span>
                </span>
                <span
                  className={cn(
                    'absolute inset-0 grid place-items-center rounded-xl border-2 p-2 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]',
                    done
                      ? 'border-success bg-success-soft'
                      : wrong
                        ? 'border-destructive bg-destructive/10'
                        : 'border-primary/40 bg-background',
                    c.term ? 'text-sm font-bold sm:text-base' : 'text-xs leading-snug sm:text-sm',
                  )}
                >
                  {c.text}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Frame>
  );
}

// ───────────── Word search ─────────────

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
] as const;
const HUES = ['#38BDF8', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#FB923C', '#22D3EE'];

function buildGrid(words: { word: string }[]) {
  const size = Math.min(12, Math.max(8, ...words.map((w) => w.word.length + 1)));
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''));
  const placed: { word: string; cells: [number, number][] }[] = [];
  for (const { word } of words) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)]!;
      const r0 = Math.floor(Math.random() * size);
      const c0 = Math.floor(Math.random() * size);
      const cells: [number, number][] = [];
      let ok = true;
      for (let k = 0; k < word.length; k++) {
        const r = r0 + dr * k;
        const c = c0 + dc * k;
        if (r < 0 || c < 0 || r >= size || c >= size) {
          ok = false;
          break;
        }
        const cur = grid[r]![c]!;
        if (cur && cur !== word[k]) {
          ok = false;
          break;
        }
        cells.push([r, c]);
      }
      if (!ok) continue;
      cells.forEach(([r, c], k) => (grid[r]![c] = word[k]!));
      placed.push({ word, cells });
      break;
    }
  }
  const latin = words.every((w) => /^[A-Z]+$/.test(w.word));
  const letters = latin
    ? 'ABCDEFGHIJKLMNOPRSTUVWY'
    : [...new Set(words.map((w) => w.word).join(''))].join('');
  for (const row of grid)
    for (let c = 0; c < size; c++)
      if (!row[c]) row[c] = letters[Math.floor(Math.random() * letters.length)]!;
  return { size, grid, placed };
}

function lineBetween(a: [number, number], b: [number, number]): [number, number][] | null {
  const dr = b[0] - a[0];
  const dc = b[1] - a[1];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const n = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + sr * k, a[1] + sc * k]);
}

function WordSearch({ pairs, onFinish, onAgain, onExit }: GameProps & { pairs: GameSet['pairs'] }) {
  const words = useMemo(() => puzzleWords(pairs), [pairs]);
  const [{ size, grid, placed }] = useState(() => buildGrid(words));
  const clues = useMemo(
    () => placed.map((p) => ({ ...p, clue: words.find((w) => w.word === p.word)!.clue })),
    [placed, words],
  );
  const [found, setFound] = useState<string[]>([]);
  const [start, setStart] = useState<[number, number] | null>(null);
  const [end, setEnd] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bad, setBad] = useState(false);
  const [result, setResult] = useState<{ score: number; line: string } | null>(null);
  const seconds = useClock(!result);

  const selection = start && end ? (lineBetween(start, end) ?? [start]) : start ? [start] : [];
  const colorOf = new Map<string, string>();
  found.forEach((w) => {
    const p = placed.find((x) => x.word === w)!;
    const hue = HUES[placed.indexOf(p) % HUES.length]!;
    p.cells.forEach(([r, c]) => colorOf.set(`${r},${c}`, hue));
  });

  const cellAt = (x: number, y: number): [number, number] | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    if (!el) return null;
    const [r, c] = el.dataset.cell!.split(',').map(Number);
    return [r!, c!];
  };

  function check(a: [number, number], b: [number, number]) {
    const cells = lineBetween(a, b);
    if (!cells || cells.length < 2) return false;
    const text = cells.map(([r, c]) => grid[r]![c]).join('');
    const hit = placed.find(
      (p) =>
        !found.includes(p.word) && (p.word === text || p.word === [...text].reverse().join('')),
    );
    if (!hit) {
      setBad(true);
      setTimeout(() => setBad(false), 400);
      return true;
    }
    const next = [...found, hit.word];
    setFound(next);
    if (next.length === placed.length) {
      setResult({ score: 100, line: `All ${placed.length} words · ${mmss(seconds)}` });
      onFinish(100);
    }
    return true;
  }

  function giveUp() {
    const score = clamp((found.length / placed.length) * 100);
    setFound(placed.map((p) => p.word));
    setTimeout(() => {
      setResult({ score, line: `${found.length} of ${placed.length} found` });
      onFinish(score);
    }, 1400);
  }

  return (
    <Frame
      id="words"
      result={result}
      onAgain={onAgain}
      onExit={onExit}
      stats={
        <>
          <Stat>
            {found.length}/{placed.length}
          </Stat>
          <Stat wide>
            <Clock className="size-3.5" aria-hidden /> {mmss(seconds)}
          </Stat>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div
          className={cn(
            'mx-auto grid w-full max-w-md touch-none gap-1 select-none',
            bad && 'animate-shake',
          )}
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          onPointerDown={(e) => {
            const cell = cellAt(e.clientX, e.clientY);
            if (!cell) return;
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
            if (start && !dragging && !end) {
              // tap, tap: the second tap ends the word
              if (!check(start, cell)) setStart(cell);
              else setStart(null);
              return;
            }
            setStart(cell);
            setEnd(null);
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            const cell = cellAt(e.clientX, e.clientY);
            if (cell) setEnd(cell);
          }}
          onPointerUp={(e) => {
            if (!dragging) return;
            setDragging(false);
            // Where the finger lifts, not the last move React has rendered.
            const last = cellAt(e.clientX, e.clientY) ?? end;
            if (start && last && (last[0] !== start[0] || last[1] !== start[1])) {
              check(start, last);
              setStart(null);
            }
            setEnd(null);
          }}
        >
          {grid.map((row, r) =>
            row.map((ch, c) => {
              const key = `${r},${c}`;
              const hue = colorOf.get(key);
              const selected = selection.some(([a, b]) => a === r && b === c);
              return (
                <span
                  key={key}
                  data-cell={key}
                  className={cn(
                    'grid aspect-square cursor-pointer place-items-center rounded-md text-sm font-bold transition-colors sm:text-base',
                    selected
                      ? 'scale-105 bg-primary text-primary-foreground'
                      : hue
                        ? 'text-slate-900'
                        : 'bg-muted/70 hover:bg-secondary',
                  )}
                  style={hue && !selected ? { background: hue } : undefined}
                >
                  {ch}
                </span>
              );
            }),
          )}
        </div>
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {clues.map((p, i) => {
              const got = found.includes(p.word);
              return (
                <li
                  key={p.word}
                  className={cn(
                    'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                    got ? 'border-transparent' : 'border-border',
                  )}
                  style={got ? { background: `${HUES[i % HUES.length]}33` } : undefined}
                >
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: HUES[i % HUES.length] }}
                  />
                  <span className="min-w-0">
                    {got ? (
                      <b className="tracking-wide">{p.word}</b>
                    ) : (
                      <span className="text-muted-foreground">
                        {p.clue}{' '}
                        <span className="text-xs whitespace-nowrap">({p.word.length})</span>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {!result && found.length < placed.length && (
            <Button size="sm" variant="ghost" onClick={giveUp}>
              Show answers
            </Button>
          )}
        </div>
      </div>
    </Frame>
  );
}

// ───────────── Sort into groups ─────────────

const BUCKETS = [
  'border-sky-400/60 bg-sky-50 dark:bg-sky-950/40',
  'border-amber-400/60 bg-amber-50 dark:bg-amber-950/40',
  'border-fuchsia-400/60 bg-fuchsia-50 dark:bg-fuchsia-950/40',
];

function SortGame({
  groups,
  onFinish,
  onAgain,
  onExit,
}: GameProps & { groups: NonNullable<GameSet['groups']> }) {
  const [items] = useState(() =>
    shuffled(groups.flatMap((g, gi) => g.items.map((text) => ({ text, group: gi })))),
  );
  const [placed, setPlaced] = useState<Map<number, number>>(new Map());
  const [slips, setSlips] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ i: number; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const dragRef = useRef<{ i: number; x: number; y: number; moved: boolean } | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [wrongBucket, setWrongBucket] = useState<number | null>(null);
  const [result, setResult] = useState<{ score: number; line: string } | null>(null);
  const seconds = useClock(!result);

  const bucketAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-bucket]');
    return el ? Number(el.dataset.bucket) : null;
  };

  function drop(i: number, b: number) {
    if (items[i]!.group === b) {
      const next = new Map(placed).set(i, b);
      setPlaced(next);
      setSelected(null);
      if (next.size === items.length) {
        const score = clamp(((items.length - slips.size) / items.length) * 100);
        setResult({
          score,
          line: `${items.length - slips.size} of ${items.length} first time · ${mmss(seconds)}`,
        });
        onFinish(score);
      }
    } else {
      setSlips((s) => new Set(s).add(i));
      setWrongBucket(b);
      setTimeout(() => setWrongBucket(null), 450);
    }
  }

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = {
        ...d,
        x: e.clientX,
        y: e.clientY,
        moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6,
      };
      dragRef.current = next;
      setDrag(next);
      setOver(bucketAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      setOver(null);
      if (!d.moved) return setSelected((s) => (s === d.i ? null : d.i));
      const b = bucketAt(e.clientX, e.clientY);
      if (b !== null) drop(d.i, b);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.i]);

  const left = items.map((it, i) => ({ ...it, i })).filter((it) => !placed.has(it.i));

  return (
    <Frame
      id="sort"
      result={result}
      onAgain={onAgain}
      onExit={onExit}
      stats={
        <>
          <Stat>
            {placed.size}/{items.length}
          </Stat>
          <Stat wide>
            <Clock className="size-3.5" aria-hidden /> {mmss(seconds)}
          </Stat>
        </>
      }
    >
      <div className="space-y-5 select-none">
        <div className="flex min-h-14 flex-wrap justify-center gap-2 rounded-2xl bg-muted/50 p-3">
          {left.map((it) => (
            <button
              key={it.i}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                dragRef.current = { i: it.i, x: e.clientX, y: e.clientY, moved: false };
                setDrag(dragRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected((s) => (s === it.i ? null : it.i));
                }
              }}
              className={cn(
                'cursor-grab touch-none rounded-xl border-2 bg-card px-3.5 py-2 text-sm font-medium shadow-soft transition-all active:cursor-grabbing',
                selected === it.i
                  ? 'scale-105 border-primary ring-4 ring-primary/20'
                  : 'border-border hover:border-primary/50',
                drag?.i === it.i && drag.moved && 'opacity-30',
              )}
            >
              {it.text}
            </button>
          ))}
          {!left.length && <span className="self-center text-sm text-muted-foreground">✓</span>}
        </div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
        >
          {groups.map((g, b) => (
            <button
              key={g.name}
              type="button"
              data-bucket={b}
              onClick={() => selected !== null && drop(selected, b)}
              className={cn(
                'flex min-h-40 flex-col gap-2 rounded-2xl border-2 border-dashed p-3 text-left transition-all',
                BUCKETS[b % BUCKETS.length],
                over === b && 'scale-[1.02] border-solid shadow-lift',
                selected !== null && 'cursor-pointer',
                wrongBucket === b && 'animate-shake border-destructive',
              )}
            >
              <span className="text-center text-sm font-bold tracking-wide uppercase">
                {g.name}
              </span>
              {[...placed]
                .filter(([, pb]) => pb === b)
                .map(([i]) => (
                  <span
                    key={i}
                    className="animate-pop rounded-lg bg-card px-2.5 py-1.5 text-center text-sm shadow-soft"
                  >
                    <Check className="mr-1 inline size-3.5 text-success" aria-hidden />
                    {items[i]!.text}
                  </span>
                ))}
            </button>
          ))}
        </div>
      </div>
      {drag?.moved && (
        <span
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rotate-3 rounded-xl border-2 border-primary bg-card px-3.5 py-2 text-sm font-medium shadow-lift"
          style={{ left: drag.x, top: drag.y }}
        >
          {items[drag.i]!.text}
        </span>
      )}
    </Frame>
  );
}

// ───────────── Sequence ─────────────

function SequenceGame({
  order,
  onFinish,
  onAgain,
  onExit,
}: GameProps & { order: NonNullable<GameSet['order']> }) {
  const [list, setList] = useState(() => {
    let s = shuffled(order.items);
    for (let i = 0; i < 5 && s.every((x, k) => x === order.items[k]); i++)
      s = shuffled(order.items);
    return s;
  });
  const [tries, setTries] = useState(0);
  const [checked, setChecked] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; line: string } | null>(null);
  const seconds = useClock(!result);
  const refs = useRef(new Map<string, HTMLElement>());

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    setList(next);
    setChecked(false);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      setList((cur) => {
        const from = cur.indexOf(dragging);
        const above = cur[from - 1] && refs.current.get(cur[from - 1]!)?.getBoundingClientRect();
        const below = cur[from + 1] && refs.current.get(cur[from + 1]!)?.getBoundingClientRect();
        const next = [...cur];
        if (above && e.clientY < above.top + above.height / 2) {
          [next[from - 1], next[from]] = [next[from]!, next[from - 1]!];
          return next;
        }
        if (below && e.clientY > below.top + below.height / 2) {
          [next[from + 1], next[from]] = [next[from]!, next[from + 1]!];
          return next;
        }
        return cur;
      });
      setChecked(false);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  function check() {
    const t = tries + 1;
    setTries(t);
    setChecked(true);
    if (list.every((x, k) => x === order.items[k])) {
      const score = [100, 75, 50, 30][t - 1] ?? 20;
      setTimeout(() => {
        setResult({ score, line: `${t} ${t === 1 ? 'try' : 'tries'} · ${mmss(seconds)}` });
        onFinish(score);
      }, 600);
    }
  }

  return (
    <Frame
      id="sequence"
      result={result}
      onAgain={onAgain}
      onExit={onExit}
      stats={
        <>
          <Stat>
            {tries} {tries === 1 ? 'try' : 'tries'}
          </Stat>
          <Stat wide>
            <Clock className="size-3.5" aria-hidden /> {mmss(seconds)}
          </Stat>
        </>
      }
    >
      <p className="mb-4 text-center font-medium">{order.prompt}</p>
      <ol className="mx-auto max-w-lg space-y-2 select-none">
        {list.map((item, k) => {
          const right = checked && item === order.items[k];
          const wrong = checked && !right;
          return (
            <li
              key={item}
              ref={(el) => {
                if (el) refs.current.set(item, el);
                else refs.current.delete(item);
              }}
              className={cn(
                'flex items-center gap-2 rounded-2xl border-2 bg-card p-2 shadow-soft transition-colors',
                dragging === item && 'scale-[1.02] border-primary shadow-lift',
                right && 'border-success bg-success-soft',
                wrong && 'border-destructive/60',
                !dragging && !checked && 'border-border',
              )}
            >
              <span
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDragging(item);
                }}
                className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-xl bg-muted text-muted-foreground active:cursor-grabbing"
                aria-hidden
              >
                <GripVertical className="size-4" />
              </span>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                {k + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium sm:text-base">{item}</span>
              <span className="flex shrink-0">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => move(k, k - 1)}
                  disabled={k === 0}
                  aria-label={`Move “${item}” up`}
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => move(k, k + 1)}
                  disabled={k === list.length - 1}
                  aria-label={`Move “${item}” down`}
                >
                  <ArrowDown />
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex justify-center">
        <Button size="lg" onClick={check} disabled={!!result}>
          <Check aria-hidden /> Check order
        </Button>
      </div>
    </Frame>
  );
}

// ───────────── Fact or fiction ─────────────

const SECONDS_PER_CARD = 12;

function FactOrFiction({
  truths,
  onFinish,
  onAgain,
  onExit,
}: GameProps & { truths: GameSet['truths'] }) {
  const [cards] = useState(() => shuffled(truths).slice(0, 10));
  const [at, setAt] = useState(0);
  const [right, setRight] = useState(0);
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [answer, setAnswer] = useState<{ correct: boolean; timeout?: boolean } | null>(null);
  const [left, setLeft] = useState(SECONDS_PER_CARD);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [result, setResult] = useState<{ score: number; line: string } | null>(null);
  const card = cards[at];

  const choose = useCallback(
    (fact: boolean | null) => {
      if (!card || answer) return;
      const correct = fact !== null && fact === card.answer;
      setAnswer({ correct, timeout: fact === null });
      setDx(fact === null ? 0 : fact ? 400 : -400);
      if (correct) {
        const s = streak + 1;
        setStreak(s);
        setRight((r) => r + 1);
        setPoints((p) => p + 10 * Math.min(s, 5) + left);
      } else setStreak(0);
    },
    [card, answer, streak, left],
  );

  const next = useCallback(() => {
    setAnswer(null);
    setDx(0);
    setLeft(SECONDS_PER_CARD);
    if (at + 1 >= cards.length) {
      const score = clamp((right / cards.length) * 100);
      setResult({ score, line: `${right} of ${cards.length} right · ${points} points` });
      onFinish(score);
    } else setAt(at + 1);
  }, [at, cards.length, right, points, onFinish]);

  // The clock for this card.
  useEffect(() => {
    if (answer || result) return;
    const t = setTimeout(() => {
      if (left <= 1) {
        setLeft(0);
        choose(null);
      } else setLeft(left - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [left, answer, result, choose]);

  // Keys: ← fiction, → fact, Enter next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) return;
      if (!answer && e.key === 'ArrowRight') choose(true);
      else if (!answer && e.key === 'ArrowLeft') choose(false);
      else if (answer && e.key === 'Enter') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, result, choose, next]);

  return (
    <Frame
      id="fact"
      result={result}
      onAgain={onAgain}
      onExit={onExit}
      stats={
        <>
          <Stat>
            {Math.min(at + 1, cards.length)}/{cards.length}
          </Stat>
          {streak > 1 && <Stat>🔥 ×{Math.min(streak, 5)}</Stat>}
          <Stat>{points} pts</Stat>
        </>
      }
    >
      {card && (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-1000 ease-linear',
                left <= 3 ? 'bg-destructive' : 'bg-primary',
              )}
              style={{ width: `${(left / SECONDS_PER_CARD) * 100}%` }}
            />
          </div>
          <div
            key={at}
            onPointerDown={(e) => {
              if (answer) return;
              startX.current = e.clientX;
              setSwiping(true);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (startX.current !== null) setDx(e.clientX - startX.current);
            }}
            onPointerUp={() => {
              if (startX.current === null) return;
              startX.current = null;
              setSwiping(false);
              if (dx > 90) choose(true);
              else if (dx < -90) choose(false);
              else setDx(0);
            }}
            className={cn(
              'relative grid min-h-48 w-full animate-pop cursor-grab touch-none place-items-center rounded-3xl border-2 bg-card p-6 text-center shadow-lift select-none active:cursor-grabbing',
              answer
                ? answer.correct
                  ? 'border-success'
                  : 'border-destructive'
                : dx > 40
                  ? 'border-success/60'
                  : dx < -40
                    ? 'border-destructive/60'
                    : 'border-border',
            )}
            style={{
              transform: answer ? undefined : `translateX(${dx}px) rotate(${dx / 18}deg)`,
              transition: swiping ? undefined : 'transform 0.25s ease',
            }}
          >
            {!answer && dx > 40 && (
              <span className="absolute top-4 left-4 -rotate-12 rounded-lg border-2 border-success px-2 py-0.5 text-sm font-bold text-success">
                FACT
              </span>
            )}
            {!answer && dx < -40 && (
              <span className="absolute top-4 right-4 rotate-12 rounded-lg border-2 border-destructive px-2 py-0.5 text-sm font-bold text-destructive">
                FICTION
              </span>
            )}
            <p className="text-lg leading-relaxed font-semibold sm:text-xl">{card.statement}</p>
          </div>
          {answer ? (
            <div className="flex w-full animate-rise flex-col items-center gap-3 text-center">
              <p
                className={cn(
                  'text-lg font-bold',
                  answer.correct ? 'text-success' : 'text-destructive',
                )}
              >
                {answer.timeout ? '⏰ Time’s up!' : answer.correct ? '✓ Correct!' : '✗ Not quite'}{' '}
                <span className="font-medium text-muted-foreground">
                  It’s {card.answer ? 'a fact' : 'fiction'}.
                </span>
              </p>
              {card.why && <p className="text-sm text-muted-foreground">{card.why}</p>}
              <Button onClick={next} autoFocus>
                {at + 1 >= cards.length ? 'See score' : 'Next'}
              </Button>
            </div>
          ) : (
            <div className="grid w-full grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="outline"
                className="h-14 border-2 border-destructive/40 text-base text-destructive hover:bg-destructive/10"
                onClick={() => choose(false)}
              >
                <X aria-hidden /> Fiction
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 border-2 border-success/40 text-base text-success hover:bg-success-soft"
                onClick={() => choose(true)}
              >
                <Check aria-hidden /> Fact
              </Button>
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}
