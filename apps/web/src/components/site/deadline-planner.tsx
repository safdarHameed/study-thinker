'use client';

import { CalendarRange, Check, Clock3, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';
import { Reveal } from '@/components/marketing/motion';
import { cn } from '@/lib/utils';
import { SectionHeader } from './section-header';
import { aiText, container, headerGap, sectionY } from './tokens';

const DEADLINES = [
  { id: '1w', label: '1 week', weeks: 1 },
  { id: '1m', label: '1 month', weeks: 4 },
  { id: '3m', label: '3 months', weeks: 12 },
  { id: '6m', label: '6 months', weeks: 24 },
  { id: 'none', label: 'No rush', weeks: 16 },
] as const;
const DAILY = [
  { id: 15, label: '15 min' },
  { id: 30, label: '30 min' },
  { id: 60, label: '1 hour' },
  { id: 120, label: '2 hours' },
] as const;
const SITUATIONS = [
  { id: 'busy', label: 'Busy weekdays' },
  { id: 'beginner', label: 'Complete beginner' },
  { id: 'exam', label: 'Fixed exam date' },
  { id: 'night', label: 'Night owl' },
] as const;
type Situation = (typeof SITUATIONS)[number]['id'];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const EXAMPLE_GOAL_HOURS = 40;
const MAX_COLUMNS = 12;

/** Interactive illustration: the plan reshapes around deadline, time and situation. */
export function DeadlinePlanner() {
  const [deadline, setDeadline] = useState<(typeof DEADLINES)[number]['id']>('3m');
  const [daily, setDaily] = useState<(typeof DAILY)[number]['id']>(30);
  const [sits, setSits] = useState<Situation[]>(['busy']);
  const has = (s: Situation) => sits.includes(s);
  const toggle = (s: Situation) =>
    setSits((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const d = DEADLINES.find((x) => x.id === deadline)!;
  const columns = Math.min(d.weeks, MAX_COLUMNS);
  const weeksPerColumn = d.weeks / columns;
  const sessionsPerWeek = has('busy') ? 4 : d.weeks <= 1 ? 7 : 5;
  const available = (d.weeks * sessionsPerWeek * daily) / 60;
  const tight = deadline !== 'none' && available < EXAMPLE_GOAL_HOURS;

  const intensity = (col: number, day: number) => {
    const weekend = day >= 5;
    let v = daily / 120 + 0.25;
    if (has('busy')) v *= weekend ? 1.5 : day % 2 === 0 ? 0.55 : 0;
    else if (sessionsPerWeek === 5 && weekend) v *= 0.35;
    if (has('beginner') && col < Math.ceil(columns / 4)) v *= 0.7;
    if (tight) v *= 1.25;
    return Math.min(1, v);
  };
  const isMock = (col: number, day: number) => has('exam') && col === columns - 1 && day % 2 === 1;

  const notes = [
    tight && 'Tight deadline: focuses on the highest-impact topics first',
    deadline === 'none' && 'No deadline: a steady pace with more depth',
    has('beginner') && 'Starts from the fundamentals, with no assumptions',
    has('busy') && 'Lighter weekdays, deeper weekend sessions',
    has('exam') && 'Final week becomes timed mock exams',
    has('night') && 'Sessions are scheduled for your evenings',
    'Reviews are spaced in before you forget',
  ].filter(Boolean) as string[];

  return (
    <section
      id="plans"
      className={`relative isolate scroll-mt-24 border-y border-zinc-200/70 bg-zinc-50 ${sectionY}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgba(24,24,27,0.07)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] bg-[size:22px_22px]"
      />
      <div className={container}>
        <SectionHeader
          index="02"
          name="Plans"
          title={
            <>
              Any deadline. <span className={aiText}>Any schedule.</span>
            </>
          }
        >
          A week before an exam or six relaxed months. Tell StudyThinker your time and your
          situation, and the plan reshapes itself. Try it below.
        </SectionHeader>

        <Reveal delay={120} className={`${headerGap} grid gap-5 lg:grid-cols-[22rem_1fr]`}>
          <div className="flex flex-col gap-7 rounded-3xl bg-white p-6 ring-1 ring-zinc-200 sm:p-7">
            <Group icon={CalendarRange} label="I need to be ready in">
              {DEADLINES.map((x) => (
                <Chip key={x.id} active={deadline === x.id} onClick={() => setDeadline(x.id)}>
                  {x.label}
                </Chip>
              ))}
            </Group>
            <Group icon={Clock3} label="Time I can give a day">
              {DAILY.map((x) => (
                <Chip key={x.id} active={daily === x.id} onClick={() => setDaily(x.id)}>
                  {x.label}
                </Chip>
              ))}
            </Group>
            <Group icon={Target} label="My situation">
              {SITUATIONS.map((x) => (
                <Chip key={x.id} active={has(x.id)} onClick={() => toggle(x.id)} check>
                  {x.label}
                </Chip>
              ))}
            </Group>
            <p className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-5 text-sm text-zinc-500">
              <Sparkles className="size-4 text-indigo-500" aria-hidden />
              Your plan updates instantly.
            </p>
          </div>

          <div
            className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-[0_40px_100px_-50px_rgba(30,27,75,0.45)] ring-1 ring-zinc-200 sm:p-8"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500">Your plan</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                  {deadline === 'none' ? 'At your own pace' : `${d.label} to be ready`}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <Stat value={`${sessionsPerWeek}×`} label="a week" />
                <Stat value={DAILY.find((x) => x.id === daily)!.label} label="a session" />
              </div>
            </div>

            {/* Heatmap */}
            <div className="mt-8 overflow-x-auto">
              <div className="flex min-w-max gap-1.5 sm:min-w-0">
                <div className="flex flex-col gap-1.5 pt-5 pr-1.5">
                  {DAYS.map((day, i) => (
                    <span
                      key={i}
                      className="grid h-5 place-items-center text-[0.65rem] text-zinc-400 sm:h-7"
                    >
                      {day}
                    </span>
                  ))}
                </div>
                {Array.from({ length: columns }, (_, col) => (
                  <div
                    key={`${deadline}-${col}`}
                    className="flex flex-col gap-1.5 sm:max-w-14 sm:flex-1"
                  >
                    <span className="h-4 text-center text-[0.65rem] text-zinc-400">
                      {col === 0 || col === columns - 1
                        ? `W${Math.round((col + 1) * weeksPerColumn)}`
                        : ''}
                    </span>
                    {DAYS.map((_, day) => {
                      const mock = isMock(col, day);
                      const v = intensity(col, day);
                      return (
                        <span
                          key={day}
                          className={cn(
                            'size-5 animate-pop rounded-[5px] sm:h-7 sm:w-full sm:rounded-md',
                            mock && 'ring-2 ring-rose-400 ring-offset-1',
                          )}
                          style={{
                            background: mock
                              ? 'linear-gradient(135deg,#FB7185,#E11D48)'
                              : v === 0
                                ? '#F4F4F5'
                                : `rgba(79,70,229,${0.12 + v * 0.78})`,
                            animationDelay: `${col * 25 + day * 10}ms`,
                          }}
                          title={mock ? 'Mock exam' : undefined}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] bg-indigo-200" /> lighter
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] bg-indigo-600" /> deeper
              </span>
              {has('exam') && (
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[3px] bg-rose-500" /> mock exam
                </span>
              )}
            </div>

            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {notes.map((n) => (
                <li
                  key={n}
                  className="flex animate-rise items-start gap-2.5 rounded-2xl bg-indigo-50/70 px-3.5 py-3 text-sm text-indigo-950"
                >
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-zinc-400">
              Illustration for an example goal of about 40 hours.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Group({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
        <Icon className="size-4 text-indigo-500" /> {label}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  check,
  children,
}: {
  active: boolean;
  onClick: () => void;
  check?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all',
        active
          ? 'bg-zinc-950 text-white shadow-sm'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950',
      )}
    >
      {check && active && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-3.5 py-2 text-center ring-1 ring-zinc-100">
      <p className="font-semibold tabular-nums text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
