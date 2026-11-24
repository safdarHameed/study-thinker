'use client';

import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

let renders = 0;
let loader: Promise<typeof import('mermaid').default> | null = null;
function loadMermaid() {
  loader ??= import('mermaid').then((m) => {
    m.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      // Never draw Mermaid's own error graphic into the page.
      suppressErrorRendering: true,
      theme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'neutral',
      fontFamily: 'inherit',
    });
    return m.default;
  });
  return loader;
}

/** Draws a Mermaid diagram written by the AI. Falls back to showing its text if invalid. */
export function MermaidDiagram({ code, className }: { code: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A fresh element id per render: two renders of one id at once confuse Mermaid.
    const elementId = `mmd-${id}-${++renders}`;
    loadMermaid()
      .then(async (m) => {
        const valid = await m.parse(code.trim(), { suppressErrors: true });
        if (!valid) throw new Error('invalid diagram');
        return m.render(elementId, code.trim());
      })
      .then((r) => !cancelled && setSvg(r.svg))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => document.getElementById(`d${elementId}`)?.remove());
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (failed)
    return (
      <pre className={cn('overflow-x-auto rounded-xl bg-muted p-3 text-xs', className)}>{code}</pre>
    );
  if (!svg)
    return (
      <div
        className={cn('h-40 animate-pulse rounded-xl bg-muted', className)}
        aria-label="Drawing the diagram…"
      />
    );
  return (
    <figure
      className={cn(
        'not-prose my-4 flex justify-center overflow-x-auto rounded-xl border border-border bg-card p-4 [&_svg]:h-auto [&_svg]:max-w-full',
        className,
      )}
      role="img"
      aria-label="Diagram"
      // Mermaid output is sanitised (securityLevel "strict").
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
