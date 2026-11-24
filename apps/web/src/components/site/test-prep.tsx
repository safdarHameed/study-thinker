'use client';

import { Check, Clock3, FileText, ListChecks, Target } from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { LogoMark } from '@/components/brand/logo';
import { Reveal, useInView } from '@/components/marketing/motion';
import { useReducedMotion } from '@/components/marketing/use-reduced-motion';
import { cn } from '@/lib/utils';
import { SectionHeader } from './section-header';
import { aiText, container, headerGap, sectionY } from './tokens';

interface Exam {
  id: string;
  label: string;
  title: string;
  minutes: number;
  count: number;
  readiness: number;
  topics: { name: string; share: number; weak?: boolean }[];
  questions: { type: string; topic: string; text: string }[];
}

const EXAMS: Exam[] = [
  {
    id: 'school',
    label: 'School final',
    title: 'Biology final · mock paper',
    minutes: 60,
    count: 30,
    readiness: 71,
    topics: [
      { name: 'Genetics', share: 40, weak: true },
      { name: 'Cells', share: 25 },
      { name: 'Ecology', share: 20 },
      { name: 'Evolution', share: 15 },
    ],
    questions: [
      { type: 'Multiple choice', topic: 'Genetics', text: 'Which cross gives a 3:1 ratio?' },
      { type: 'Short answer', topic: 'Cells', text: 'Name the organelle that makes ATP.' },
      { type: 'Diagram', topic: 'Genetics', text: 'Complete this Punnett square.' },
    ],
  },
  {
    id: 'sat',
    label: 'SAT Math',
    title: 'SAT Math · practice section',
    minutes: 70,
    count: 44,
    readiness: 64,
    topics: [
      { name: 'Advanced math', share: 35, weak: true },
      { name: 'Algebra', share: 30 },
      { name: 'Data analysis', share: 20 },
      { name: 'Geometry', share: 15 },
    ],
    questions: [
      { type: 'Grid-in', topic: 'Advanced math', text: 'If f(x) = x² − 4x, find f(5).' },
      { type: 'Multiple choice', topic: 'Algebra', text: 'Solve 3(x − 2) = 2x + 1.' },
      { type: 'Word problem', topic: 'Data analysis', text: 'What is the median of the table?' },
    ],
  },
  {
    id: 'ielts',
    label: 'IELTS',
    title: 'IELTS Academic · mock test',
    minutes: 165,
    count: 4,
    readiness: 68,
    topics: [
      { name: 'Writing', share: 35, weak: true },
      { name: 'Reading', share: 25 },
      { name: 'Listening', share: 20 },
      { name: 'Speaking', share: 20 },
    ],
    questions: [
      { type: 'Essay', topic: 'Writing', text: 'Discuss both views and give your opinion.' },
      { type: 'True / False / NG', topic: 'Reading', text: 'The author supports the policy.' },
      { type: 'Spoken prompt', topic: 'Speaking', text: 'Describe a place you’d like to visit.' },
    ],
  },
  {
    id: 'aws',
    label: 'AWS certification',
    title: 'AWS SAA-C03 · timed mock',
    minutes: 130,
    count: 65,
    readiness: 58,
    topics: [
      { name: 'Networking', share: 40, weak: true },
      { name: 'Security', share: 25 },
      { name: 'Databases', share: 20 },
      { name: 'Cost', share: 15 },
    ],
    questions: [
      { type: 'Scenario', topic: 'Networking', text: 'Private subnets need outbound internet…' },
      { type: 'Multiple response', topic: 'Security', text: 'Choose two ways to encrypt S3 data.' },
      { type: 'Scenario', topic: 'Databases', text: 'Which database fits millisecond reads?' },
    ],
  },
  {
    id: 'driving',
    label: 'Driving theory',
    title: 'Driving theory · practice test',
    minutes: 57,
    count: 50,
    readiness: 82,
    topics: [
      { name: 'Road signs', share: 35, weak: true },
      { name: 'Hazards', share: 30 },
      { name: 'Rules', share: 20 },
      { name: 'Safety', share: 15 },
    ],
    questions: [
      { type: 'Image question', topic: 'Road signs', text: 'What does this sign mean?' },
      { type: 'Multiple choice', topic: 'Rules', text: 'When may you use hazard lights?' },
      { type: 'Hazard clip', topic: 'Hazards', text: 'Spot the developing hazard.' },
    ],
  },
];

const STEPS = [
  'Reading your mastery map',
  'Weighting your weak topics',
  'Matching the real exam format',
];
const TICKS_TOTAL = STEPS.length + 4;

type State = { exam: number; t: number };
type Action = { type: 'tick' } | { type: 'pick'; exam: number };
function reducer(s: State, a: Action): State {
  if (a.type === 'pick') return { exam: a.exam, t: 0 };
  return s.t >= TICKS_TOTAL ? s : { ...s, t: s.t + 1 };
}

export function TestPrep() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const [{ exam, t }, dispatch] = useReducer(reducer, { exam: 3, t: 0 });
  const e = EXAMS[exam]!;
  const now = reduced ? TICKS_TOTAL : t;
  const built = now > STEPS.length;

  useEffect(() => {
    if (reduced || !inView || t >= TICKS_TOTAL) return;
    const id = setTimeout(() => dispatch({ type: 'tick' }), 650);
    return () => clearTimeout(id);
  }, [reduced, inView, t]);

  return (
    <section id="tests" className={`scroll-mt-24 ${sectionY}`}>
      <div className={container} ref={ref}>
        <SectionHeader
          index="04"
          name="Test prep"
          title={
            <>
              Test prep that <span className={aiText}>targets your gaps.</span>
            </>
          }
        >
          Pick any exam. StudyThinker builds practice tests in the real format, weighted towards
          what you don’t know yet, and timed like the day itself.
        </SectionHeader>

        <Reveal delay={120} className={`${headerGap} flex flex-wrap gap-2`}>
          {EXAMS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={i === exam}
              onClick={() => dispatch({ type: 'pick', exam: i })}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-all',
                i === exam
                  ? 'bg-zinc-950 text-white shadow-md'
                  : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-950 hover:ring-zinc-300',
              )}
            >
              {x.label}
            </button>
          ))}
        </Reveal>

        <Reveal delay={200} className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          {/* Builder */}
          <div className="flex flex-col rounded-3xl bg-white p-6 ring-1 ring-zinc-200 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <LogoMark className="size-5" />
              {built ? 'Your practice test is ready' : 'Building your practice test…'}
            </p>
            <ol className="mt-6 space-y-3">
              {STEPS.map((s, i) => {
                const ok = i < now;
                const active = i === now;
                return (
                  <li
                    key={s}
                    className={cn(
                      'flex items-center gap-3 text-sm transition-opacity duration-300',
                      ok || active ? 'opacity-100' : 'opacity-30',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-5 place-items-center rounded-full',
                        ok ? 'bg-indigo-600 text-white' : 'ring-1 ring-zinc-300',
                      )}
                    >
                      {ok ? (
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                      ) : active ? (
                        <span className="size-2.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                      ) : null}
                    </span>
                    <span className="text-zinc-700">{s}</span>
                  </li>
                );
              })}
            </ol>

            <div
              className={cn(
                'mt-8 flex flex-1 flex-col transition-opacity duration-500',
                built ? 'opacity-100' : 'opacity-0',
              )}
            >
              <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Topic mix</p>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full">
                {e.topics.map((tp, i) => (
                  <div
                    key={tp.name}
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${built ? tp.share : 0}%`,
                      background: tp.weak
                        ? 'linear-gradient(90deg,#F43F5E,#E11D48)'
                        : ['#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE'][i],
                    }}
                  />
                ))}
              </div>
              <ul className="mt-3 mb-7 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                {e.topics.map((tp) => (
                  <li key={tp.name} className={cn(tp.weak && 'font-semibold text-rose-600')}>
                    {tp.name} {tp.share}%{tp.weak ? ' · weak spot' : ''}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center gap-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
                <div className="relative size-14 shrink-0">
                  <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#E4E4E7" strokeWidth="4" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={94.2}
                      strokeDashoffset={built ? 94.2 * (1 - e.readiness / 100) : 94.2}
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)' }}
                    />
                  </svg>
                  <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-zinc-950">
                    {e.readiness}%
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-zinc-950">Exam readiness</p>
                  <p className="text-zinc-500">Updates after every practice test</p>
                </div>
              </div>
            </div>
          </div>

          {/* Generated test deck */}
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#EEF2FF,#FAF5FF)] p-6 ring-1 ring-indigo-100 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold tracking-tight text-zinc-950">{e.title}</p>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200">
                  <Clock3 className="size-3.5" aria-hidden /> {e.minutes} min
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200">
                  <ListChecks className="size-3.5" aria-hidden /> {e.count} questions
                </span>
              </div>
            </div>

            <div className="relative mt-8 min-h-[19rem]">
              {e.questions.map((q, i) => {
                const show = built && now - STEPS.length > i;
                return (
                  <div
                    key={`${e.id}-${i}`}
                    className={cn(
                      'absolute inset-x-0 rounded-2xl bg-white p-5 shadow-[0_20px_40px_-24px_rgba(30,27,75,0.45)] ring-1 ring-zinc-200 transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      show ? 'opacity-100' : 'translate-y-10 opacity-0',
                    )}
                    style={{
                      top: `${i * 6}rem`,
                      transform: show ? `rotate(${(i - 1) * 1.2}deg)` : undefined,
                      zIndex: 10 + i,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-indigo-600">
                        <FileText className="size-3.5" aria-hidden /> {q.type}
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                          e.topics.find((tp) => tp.name === q.topic)?.weak
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-zinc-100 text-zinc-600',
                        )}
                      >
                        <Target className="size-3" aria-hidden /> {q.topic}
                      </span>
                    </div>
                    <p className="mt-2.5 font-medium text-zinc-950">{q.text}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Example questions · explanations after every answer
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
