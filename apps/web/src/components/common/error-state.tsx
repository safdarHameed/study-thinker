'use client';

import { CloudOff, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeError, isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  size?: 'default' | 'compact';
}

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  retrying,
  className,
  size = 'default',
}: ErrorStateProps) {
  const described = describeError(error);
  const offline = isApiError(error) && error.isNetworkError;
  const Icon = offline ? CloudOff : TriangleAlert;
  const requestId = isApiError(error) ? error.requestId : undefined;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-clay/25 bg-clay-soft/40 text-center',
        size === 'default' ? 'gap-4 px-6 py-12' : 'gap-3 px-5 py-7',
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-clay-soft text-clay">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="font-display text-lg font-semibold">{title ?? described.title}</h3>
        <p className="text-muted-foreground">{description ?? described.description}</p>
        {requestId && (
          <p className="pt-1 font-mono text-xs text-muted-foreground/80">Reference: {requestId}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          <RotateCcw className={cn(retrying && 'animate-spin')} aria-hidden />
          {retrying ? 'Trying again…' : 'Try again'}
        </Button>
      )}
    </div>
  );
}
