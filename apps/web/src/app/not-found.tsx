import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main id="main" className="lw-paper grid min-h-dvh place-items-center px-4 py-16">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <Logo />
        <div className="grid size-16 place-items-center rounded-full bg-secondary text-primary ring-8 ring-secondary/40">
          <Compass className="size-7" aria-hidden />
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">404</p>
          <h1 className="font-display text-4xl font-semibold">Page not found</h1>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/learnings">My learnings</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
