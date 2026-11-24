import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Topic', 'Options', 'Journey', 'Learn'];

/** Where the learner is in setting up a learning: topic → choices → journey → learn. */
export function FlowSteps({ current, className }: { current: 0 | 1 | 2 | 3; className?: string }) {
  return (
    <ol
      className={cn(
        'flex items-center justify-center gap-1.5 text-xs sm:gap-2 sm:text-sm',
        className,
      )}
    >
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-1.5 sm:gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-1 font-medium sm:px-2.5',
              i < current && 'text-success',
              i === current && 'bg-primary text-primary-foreground',
              i > current && 'text-muted-foreground',
            )}
            aria-current={i === current ? 'step' : undefined}
          >
            {i < current ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <span className="tabular-nums">{i + 1}</span>
            )}
            <span className={cn(i !== current && 'hidden sm:inline')}>{label}</span>
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-3 bg-border sm:w-6" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
