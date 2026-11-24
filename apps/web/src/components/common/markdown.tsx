import Link from 'next/link';
import { isValidElement, type ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { MermaidDiagram } from './mermaid';

/** Renders untrusted markdown safely (no raw HTML) with StudyThinker reading styles. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('lw-prose', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ```mermaid blocks become diagrams.
          pre: ({ children }) => {
            const code = isValidElement(children)
              ? (children as ReactElement<{ className?: string; children?: unknown }>)
              : null;
            if (code?.props.className?.includes('language-mermaid'))
              return <MermaidDiagram code={String(code.props.children ?? '')} />;
            return <pre>{children}</pre>;
          },
          a: ({ href, children }) =>
            // Links inside the app stay in the app; everything else opens safely in a new tab.
            href?.startsWith('/') && !href.startsWith('//') ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
