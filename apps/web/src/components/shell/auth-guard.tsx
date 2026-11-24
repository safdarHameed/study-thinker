'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogoMark } from '@/components/brand/logo';
import { ErrorState } from '@/components/common/error-state';
import { Spinner } from '@/components/common/loading-state';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-provider';

export function FullPageStatus({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-dvh w-full place-items-center p-6">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <LogoMark className="size-11" />
        <div className="flex items-center gap-2.5 text-sm">
          <Spinner className="size-4" />
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Client-side gate for signed-in areas. The API is the real authority; this only
 * decides what to render and where to send the visitor. Pages render while the
 * session is restored (their queries wait), so navigation stays instant.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status, retry } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, router]);

  if (status === 'offline') {
    return (
      <div className="grid min-h-dvh w-full place-items-center p-6">
        <ErrorState
          className="w-full max-w-lg"
          error={new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' })}
          onRetry={retry}
        />
      </div>
    );
  }
  if (status === 'unauthenticated') return <FullPageStatus label="Redirecting…" />;
  return <>{children}</>;
}
