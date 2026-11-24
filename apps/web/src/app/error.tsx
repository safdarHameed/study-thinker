'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Logo } from '@/components/brand/logo';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="lw-paper grid min-h-dvh place-items-center px-4 py-16">
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        <Logo />
        <ErrorState className="w-full bg-card" title="Something went wrong" onRetry={retry} />
        <Button variant="link" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
