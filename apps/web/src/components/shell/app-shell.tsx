'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Assistant } from '@/components/assistant/assistant';
import { AssistantProvider } from '@/components/assistant/assistant-context';
import { Logo } from '@/components/brand/logo';
import { RewardWatcher } from '@/components/engage/reward-watcher';
import { useAiStatus, useProgress } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';

const NAV = [
  { href: '/learnings', label: 'Learnings' },
  { href: '/settings', label: 'Settings' },
];

function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              active
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}

/** Which model is answering — and a nudge to Settings when none is. */
function AiPill() {
  const { data } = useAiStatus();
  if (!data) return null;
  const label = data.available ? (data.source === 'own-key' ? 'Own key' : 'Free') : 'Set up AI';
  return (
    <Link
      href="/settings#ai"
      title={data.model ?? 'No model configured'}
      className={cn(
        'hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:inline-flex',
        data.available
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-warning-soft text-warning ring-1 ring-warning/30',
      )}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

/** Streak and level, always in view. */
function ProgressPill() {
  const { data } = useProgress();
  if (!data) return null;
  return (
    <Link
      href="/learnings"
      title={`Level ${data.level} · ${data.xp} XP · ${data.streak}-day streak`}
      className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
    >
      <span className={cn(data.streak > 0 ? 'text-highlight' : 'text-muted-foreground')}>
        🔥 {data.streak}
      </span>
      <span className="text-primary">Lv {data.level}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AssistantProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
            <Link
              href="/learnings"
              className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Logo markClassName="size-7" className="hidden sm:inline-flex" />
              <Logo markClassName="size-7" showWordmark={false} className="sm:hidden" />
            </Link>
            <nav aria-label="Main" className="flex items-center gap-1">
              <Suspense fallback={null}>
                <NavLinks />
              </Suspense>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ProgressPill />
              <AiPill />
              <UserMenu />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
          {children}
        </main>
        <RewardWatcher />
        <Suspense fallback={null}>
          <Assistant />
        </Suspense>
      </div>
    </AssistantProvider>
  );
}
