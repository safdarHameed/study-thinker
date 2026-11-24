import { LogoMark } from '@/components/brand/logo';
import { GoalLauncher } from '@/components/marketing/goal-launcher';
import { Reveal } from '@/components/marketing/motion';
import { aiTextDark } from './tokens';

const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 61) % 100,
  d: (i % 7) * 0.5,
  s: i % 6 === 0 ? 2 : 1,
}));

export function FinalCta() {
  return (
    <section className="px-3 pb-3 sm:px-6 sm:pb-6">
      <div>
        <Reveal className="relative isolate overflow-hidden rounded-[2rem] bg-[#07071a] px-6 py-24 text-center sm:rounded-[2.5rem] sm:py-32">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/2 h-[32rem] w-[60rem] -translate-x-1/2 animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.45),transparent)] blur-3xl" />
            <div className="absolute -bottom-40 left-1/4 size-[28rem] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.3),transparent)] blur-3xl [animation-delay:-9s]" />
            {STARS.map((s, i) => (
              <span
                key={i}
                className="absolute animate-twinkle rounded-full bg-white"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: s.s,
                  height: s.s,
                  animationDelay: `${s.d}s`,
                }}
              />
            ))}
          </div>
          <LogoMark className="mx-auto size-14 drop-shadow-[0_0_24px_rgba(129,140,248,0.7)]" />
          <h2 className="mx-auto mt-8 max-w-3xl text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance text-white sm:text-[4.2rem]">
            What will you <span className={aiTextDark}>learn next?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-zinc-400">
            One sentence is all it takes to start.
          </p>
          <div className="mt-10 flex justify-center">
            <GoalLauncher inputId="cta-goal" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
