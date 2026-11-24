import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { LearnerScene } from '@/components/site/learner-scene';
import { geist } from '@/lib/site-font';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${geist.variable} lw-site relative isolate grid min-h-dvh w-full antialiased lg:grid-cols-[1.1fr_1fr]`}
    >
      {/* Soft aurora behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 right-0 size-[40rem] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.2),transparent)] blur-3xl" />
        <div className="absolute -bottom-56 left-1/3 size-[36rem] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.14),transparent)] blur-3xl [animation-delay:-11s]" />
      </div>

      {/* Illustration panel */}
      <aside className="relative m-3 hidden flex-col overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#EEF2FF,#F5F3FF_55%,#ECFEFF)] p-10 ring-1 ring-indigo-100 lg:flex xl:p-12">
        <Link
          href="/"
          className="w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Logo />
        </Link>
        <div className="flex flex-1 items-center">
          <LearnerScene className="w-full" />
        </div>
        <div>
          <p className="text-4xl leading-[1.05] font-semibold tracking-[-0.045em] text-zinc-950 xl:text-5xl">
            Learn anything,
            <br />
            <span className="bg-[linear-gradient(110deg,#0891B2,#4F46E5_45%,#9333EA)] bg-clip-text text-transparent">
              any time.
            </span>
          </p>
          <p className="mt-3 max-w-sm text-zinc-500">
            A plan for your deadline, a check of what you know, and practice tests built for you.
          </p>
        </div>
      </aside>

      {/* Form side */}
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="rounded-md lg:invisible" aria-label="StudyThinker home">
            <Logo markClassName="size-7" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-2 text-sm text-zinc-600 ring-1 ring-zinc-950/[0.06] backdrop-blur transition-colors hover:text-zinc-950"
          >
            <ArrowLeft className="size-4" aria-hidden /> Home
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-8">
          <div className="relative w-full max-w-[26rem] animate-rise">
            <div
              aria-hidden
              className="absolute inset-x-8 -bottom-6 -z-10 h-24 rounded-full bg-indigo-500/20 blur-3xl"
            />
            <div className="relative overflow-hidden rounded-[2rem] bg-white/80 px-6 py-9 shadow-[0_40px_100px_-40px_rgba(30,27,75,0.4)] ring-1 ring-zinc-950/[0.06] backdrop-blur-2xl sm:px-9 sm:py-10">
              <div
                aria-hidden
                className="absolute inset-x-12 top-0 h-[2px] rounded-full bg-[linear-gradient(90deg,transparent,#22D3EE,#6366F1,#A855F7,transparent)] shadow-[0_0_18px_2px_rgba(99,102,241,0.45)]"
              />
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
