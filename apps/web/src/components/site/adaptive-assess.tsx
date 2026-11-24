'use client';

import { Check, Sparkles, X } from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { Reveal, useInView } from '@/components/marketing/motion';
import { useReducedMotion } from '@/components/marketing/use-reduced-motion';
import { cn } from '@/lib/utils';
import { SectionHeader } from './section-header';
import { aiTextDark, container, headerGap, sectionY } from './tokens';

const QUESTIONS = [
  { q: 'What is 15% of 80?', options: ['8', '12', '15'], pick: 1, ok: true, level: 2 },
  { q: 'Solve 2x + 5 = 17', options: ['x = 6', 'x = 11', 'x = 4'], pick: 0, ok: true, level: 3 },
  { q: 'Derivative of x³?', options: ['x²', '3x²', '3x'], pick: 1, ok: true, level: 4 },
  { q: '∫ 1/x dx = ?', options: ['x⁻²', 'eˣ', 'ln|x| + C'], pick: 0, ok: false, level: 5 },
  { q: 'P(two heads in 2 flips)?', options: ['1/2', '1/4', '1/3'], pick: 0, ok: false, level: 4 },
  { q: 'Mean of 4, 8, 6, 2?', options: ['5', '6', '4'], pick: 0, ok: true, level: 3 },
];
const SKILLS = [
  { name: 'Arithmetic', v: 0.92 },
  { name: 'Algebra', v: 0.8 },
  { name: 'Calculus', v: 0.58 },
  { name: 'Probability', v: 0.32 },
  { name: 'Statistics', v: 0.7 },
];
const STEP_MS = 1700;
const RESULT_TICKS = 4;

/**
 * Each question has two half-steps: shown, then answered. After the last
 * question the results stay up for a few ticks, then the check loops.
 */
type Phase = { t: number; half: boolean };
function reducer(p: Phase): Phase {
  if (!p.half) return { t: p.t, half: true };
  return { t: p.t >= QUESTIONS.length + RESULT_TICKS ? 0 : p.t + 1, half: false };
}

export function AdaptiveAssess() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const [{ t, half }, tick] = useReducer(reducer, { t: 0, half: false });

  useEffect(() => {
    if (reduced || !inView) return;
    const id = setInterval(() => tick(), STEP_MS / 2);
    return () => clearInterval(id);
  }, [reduced, inView]);

  const done = reduced || t >= QUESTIONS.length;
  const qi = Math.min(t, QUESTIONS.length - 1);
  const question = QUESTIONS[qi]!;
  const answered = done || half;
  const level = done ? 3.6 : question.level;

  return (
    <section id="assess" className="scroll-mt-24 px-3 py-6 sm:px-6">
      <div
        className={`relative isolate overflow-hidden rounded-[2rem] bg-[#07071a] text-white sm:rounded-[2.5rem] ${sectionY}`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 right-0 size-[34rem] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(79,70,229,0.4),transparent)] blur-3xl" />
          <div className="absolute bottom-0 -left-20 size-[28rem] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.25),transparent)] blur-3xl [animation-delay:-8s]" />
        </div>
        <div className={container} ref={ref}>
          <SectionHeader
            dark
            index="03"
            name="Assessment"
            title={
              <>
                It finds out what you <span className={aiTextDark}>really know.</span>
              </>
            }
          >
            A short adaptive check gets harder when you’re right and easier when you’re not, so ten
            minutes is enough to find your true level, skill by skill.
          </SectionHeader>

          <Reveal delay={150} className={`${headerGap} grid gap-5 lg:grid-cols-2`}>
            {/* Question + difficulty ladder */}
            <div className="flex gap-5 rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur sm:p-8">
              <div className="flex flex-col items-center gap-2" aria-hidden>
                <span className="text-[0.65rem] text-zinc-500">Harder</span>
                <div className="relative flex h-full min-h-56 w-3 flex-col-reverse gap-1.5">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <span
                      key={r}
                      className={cn(
                        'flex-1 rounded-full transition-colors duration-500',
                        r <= Math.round(level)
                          ? 'bg-[linear-gradient(#A855F7,#6366F1)]'
                          : 'bg-white/10',
                      )}
                    />
                  ))}
                </div>
                <span className="text-[0.65rem] text-zinc-500">Easier</span>
              </div>

              <div className="min-w-0 flex-1">
                {done ? (
                  <div key="done" className="animate-rise">
                    <p className="text-sm text-zinc-400">Check complete</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">Intermediate</p>
                    <p className="mt-2 text-zinc-400">6 questions · about 10 minutes</p>
                    <ul className="mt-6 space-y-2.5 text-sm">
                      <li className="flex items-center gap-2.5">
                        <span className="grid size-5 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        Strong in arithmetic and algebra
                      </li>
                      <li className="flex items-center gap-2.5">
                        <span className="grid size-5 place-items-center rounded-full bg-amber-400/20 text-amber-300">
                          <Sparkles className="size-3" />
                        </span>
                        Probability needs work: it’s where your plan starts
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div key={qi} className="animate-rise">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>
                        Question {qi + 1} of {QUESTIONS.length}
                      </span>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-zinc-300">
                        Level {question.level}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-semibold tracking-tight">{question.q}</p>
                    <ul className="mt-6 space-y-2.5">
                      {question.options.map((o, i) => {
                        const picked = answered && i === question.pick;
                        return (
                          <li
                            key={o}
                            className={cn(
                              'flex items-center justify-between rounded-xl px-4 py-3 text-sm ring-1 transition-all duration-300',
                              picked && question.ok && 'bg-emerald-400/15 ring-emerald-400/60',
                              picked && !question.ok && 'bg-rose-400/15 ring-rose-400/60',
                              !picked && 'bg-white/[0.03] ring-white/10',
                            )}
                          >
                            {o}
                            {picked &&
                              (question.ok ? (
                                <Check className="size-4 text-emerald-300" aria-hidden />
                              ) : (
                                <X className="size-4 text-rose-300" aria-hidden />
                              ))}
                          </li>
                        );
                      })}
                    </ul>
                    <p
                      className={cn(
                        'mt-4 text-sm transition-opacity duration-300',
                        answered ? 'opacity-100' : 'opacity-0',
                        question.ok ? 'text-emerald-300' : 'text-rose-300',
                      )}
                    >
                      {question.ok ? '↑ Next question gets harder' : '↓ Next question gets easier'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Skill radar */}
            <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur sm:p-8">
              <p className="text-sm text-zinc-400">Your skill profile</p>
              <Radar progress={done ? 1 : Math.min(1, (t + (half ? 0.5 : 0)) / QUESTIONS.length)} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Radar({ progress }: { progress: number }) {
  const cx = 150;
  const cy = 140;
  const r = 100;
  const n = SKILLS.length;
  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v] as const;
  };
  const poly = SKILLS.map((s, i) => point(i, Math.max(0.08, s.v * progress)).join(',')).join(' ');
  return (
    <svg
      viewBox="0 0 300 290"
      className="mx-auto mt-2 w-full max-w-sm"
      role="img"
      aria-label="Example skill profile radar"
    >
      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#6366F1" stopOpacity="0.5" />
          <stop offset="1" stopColor="#A855F7" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={SKILLS.map((_, i) => point(i, k).join(',')).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
        />
      ))}
      {SKILLS.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />;
      })}
      <polygon
        points={poly}
        fill="url(#radar-fill)"
        stroke="#A5B4FC"
        strokeWidth="2"
        strokeLinejoin="round"
        style={{ transition: 'all 700ms cubic-bezier(.2,.7,.2,1)' }}
      />
      {SKILLS.map((s, i) => {
        const [x, y] = point(i, Math.max(0.08, s.v * progress));
        const [lx, ly] = point(i, 1.22);
        return (
          <g key={s.name}>
            <circle
              cx={x}
              cy={y}
              r="4"
              fill="#fff"
              style={{ transition: 'all 700ms cubic-bezier(.2,.7,.2,1)' }}
            />
            <text x={lx} y={ly + 4} textAnchor="middle" className="fill-zinc-300 text-[11px]">
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
