import { CalendarClock, Check, ClipboardCheck, Gauge } from 'lucide-react';
import { GoalLauncher } from '@/components/marketing/goal-launcher';
import { RotatingWord } from '@/components/marketing/motion';
import { LearnerScene } from './learner-scene';
import { aiText, container } from './tokens';

function FloatCard({
  className,
  children,
  delay = '0s',
}: {
  className?: string;
  children: React.ReactNode;
  delay?: string;
}) {
  return (
    <div
      className={`absolute z-10 hidden animate-float rounded-2xl bg-white/95 p-4 shadow-[0_24px_60px_-24px_rgba(30,27,75,0.45)] ring-1 ring-zinc-950/[0.06] backdrop-blur md:block ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[40rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.16),transparent)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(24,24,27,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(24,24,27,0.045)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_20%,black,transparent)]" />
      </div>

      <div className={`${container} pt-32 text-center sm:pt-40`}>
        <h1 className="mx-auto max-w-5xl animate-rise text-[3rem] leading-[0.98] font-semibold tracking-[-0.055em] text-balance text-zinc-950 sm:text-[5.2rem]">
          Learn{' '}
          <RotatingWord
            className={aiText}
            words={['Spanish', 'calculus', 'Python', 'guitar', 'anything']}
          />
          ,<br />
          any time, at your pace.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl animate-rise text-lg leading-relaxed text-balance text-zinc-500 [animation-delay:120ms] sm:text-xl">
          Tell StudyThinker your goal and your deadline. It assesses where you are, builds a plan
          that fits your life, and prepares you for every test.
        </p>
        <div className="mt-10 animate-rise [animation-delay:220ms]">
          <GoalLauncher className="mx-auto" />
          <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
            {['Any subject', 'Any deadline', 'Any level'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-indigo-500" strokeWidth={3} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative mx-auto mt-24 w-full max-w-5xl px-3 pb-12 sm:mt-32 sm:px-8 sm:pb-16">
        <LearnerScene className="animate-rise [animation-delay:300ms]" />

        <FloatCard className="top-[30%] -left-2 w-56 lg:-left-10" delay="-1s">
          <p className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <CalendarClock className="size-4" aria-hidden /> Exam in 6 weeks
          </p>
          <p className="mt-1.5 text-sm font-medium text-zinc-950">Plan adjusted to your deadline</p>
          <div className="mt-3 flex gap-1" aria-hidden>
            {[1, 1, 1, 0.6, 0.3, 0.15].map((o, i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full bg-indigo-500"
                style={{ opacity: o }}
              />
            ))}
          </div>
        </FloatCard>

        <FloatCard className="top-[56%] -right-2 w-56 lg:-right-10" delay="-3s">
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
            <ClipboardCheck className="size-4" aria-hidden /> Practice test ready
          </p>
          <p className="mt-1.5 text-sm font-medium text-zinc-950">
            20 questions on your weak topics
          </p>
          <p className="mt-1 text-xs text-zinc-500">Timed like the real exam · 45 min</p>
        </FloatCard>

        <FloatCard className="top-[2%] right-[6%] w-48" delay="-5s">
          <p className="flex items-center gap-2 text-xs font-semibold text-violet-600">
            <Gauge className="size-4" aria-hidden /> Your level
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Intermediate</p>
          <p className="text-xs text-zinc-500">from a 10-minute check</p>
        </FloatCard>
      </div>
    </section>
  );
}
