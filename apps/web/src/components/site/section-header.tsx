import { Reveal } from '@/components/marketing/motion';
import { cn } from '@/lib/utils';
import { h2Base } from './tokens';

/**
 * One header pattern for every section: index + name, the heading on the
 * left and the supporting line aligned to its baseline on the right.
 */
export function SectionHeader({
  index,
  name,
  title,
  children,
  dark,
}: {
  index: string;
  name: string;
  title: React.ReactNode;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <Reveal className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
      <div>
        <p className="flex items-center gap-3 text-sm font-medium">
          <span
            className={cn('font-mono tabular-nums', dark ? 'text-indigo-300' : 'text-indigo-600')}
          >
            {index}
          </span>
          <span aria-hidden className={cn('h-px w-8', dark ? 'bg-white/25' : 'bg-zinc-300')} />
          <span className={dark ? 'text-zinc-400' : 'text-zinc-500'}>{name}</span>
        </p>
        <h2 className={cn(h2Base, 'mt-5', dark ? 'text-white' : 'text-zinc-950')}>{title}</h2>
      </div>
      <p
        className={cn(
          'max-w-xl text-lg leading-relaxed lg:pb-1.5',
          dark ? 'text-zinc-400' : 'text-zinc-500',
        )}
      >
        {children}
      </p>
    </Reveal>
  );
}
