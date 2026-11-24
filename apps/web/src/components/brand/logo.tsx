'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * StudyThinker mark — "Wings".
 *
 * An open book drawn as two rising wings (learning lifts you), with an AI spark
 * above it (the moment of insight). Cyan → indigo → violet is the brand's AI
 * gradient. Colours are fixed so the mark looks the same in every theme.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#A855F7" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path d="M23 42C17 32 10 26 3 24c2-6 5-9 9-10 7 2 10 12 11 28Z" fill={`url(#${id}l)`} />
      <path d="M25 42c6-10 13-16 20-18-2-6-5-9-9-10-7 2-10 12-11 28Z" fill={`url(#${id}r)`} />
      <path
        d="M24 3.5c.9 5.2 3.8 8.1 9 9-5.2.9-8.1 3.8-9 9-.9-5.2-3.8-8.1-9-9 5.2-.9 8.1-3.8 9-9Z"
        fill={`url(#${id}s)`}
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
  tone = 'default',
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  /** Kept for API compatibility; the mark itself now signals AI. */
  showAiBadge?: boolean;
  /** `inverse` for dark backgrounds. */
  tone?: 'default' | 'inverse';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} title={showWordmark ? undefined : 'StudyThinker'} />
      {showWordmark && (
        <span
          className={cn(
            'font-sans text-[1.3rem] leading-none font-semibold tracking-[-0.035em]',
            tone === 'inverse' ? 'text-white' : 'text-foreground',
          )}
        >
          StudyThinker
        </span>
      )}
    </span>
  );
}

/** Small "AI" pill in the brand gradient. */
export function AiBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full bg-[linear-gradient(110deg,#22D3EE,#6366F1_45%,#A855F7)] px-2 text-[0.68rem] leading-none font-semibold tracking-wide text-white',
        className,
      )}
    >
      AI
    </span>
  );
}
