'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { ScrollProgress } from '@/components/marketing/motion';
import { useAuth } from '@/lib/auth/auth-provider';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '#anything', label: 'Subjects' },
  { href: '#plans', label: 'Plans' },
  { href: '#assess', label: 'Assessment' },
  { href: '#tests', label: 'Test prep' },
];

/** Floating glass navigation bar that tightens once the page scrolls. */
export function SiteHeader() {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:pt-4">
      <div
        className={cn(
          'pointer-events-auto relative flex h-14 w-full max-w-5xl items-center justify-between gap-4 overflow-hidden rounded-full pr-2 pl-5 transition-all duration-500',
          scrolled
            ? 'bg-white/75 shadow-[0_10px_40px_-12px_rgba(30,27,75,0.25)] ring-1 ring-zinc-950/[0.07] backdrop-blur-xl'
            : 'bg-white/40 ring-1 ring-zinc-950/[0.04] backdrop-blur-md',
        )}
      >
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Logo markClassName="size-7" />
        </Link>
        <nav aria-label="Page sections" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-full px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-950/[0.04] hover:text-zinc-950"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {signedIn ? (
            <Link
              href="/learnings"
              className="inline-flex h-10 items-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Open StudyThinker
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 sm:inline-flex"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 items-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Get started
              </Link>
            </>
          )}
        </div>
        {scrolled && <ScrollProgress />}
      </div>
    </header>
  );
}
