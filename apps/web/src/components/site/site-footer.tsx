import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { container } from './tokens';

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-100">
      <div
        className={`${container} flex flex-col items-center gap-6 py-12 sm:flex-row sm:justify-between`}
      >
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo />
          <p className="text-sm text-zinc-500">The AI that teaches you anything.</p>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-7 text-sm">
          <a href="#plans" className="text-zinc-500 transition-colors hover:text-zinc-950">
            Plans
          </a>
          <a href="#tests" className="text-zinc-500 transition-colors hover:text-zinc-950">
            Test prep
          </a>
          <Link href="/login" className="text-zinc-500 transition-colors hover:text-zinc-950">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-zinc-950 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Get started
          </Link>
        </nav>
      </div>
      <p className={`${container} pb-10 text-center text-xs text-zinc-400 sm:text-left`}>
        © StudyThinker · Product visuals are illustrations with example content.
      </p>
    </footer>
  );
}
