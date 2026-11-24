import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  size?: 'default' | 'compact';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'default',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 text-center',
        size === 'default' ? 'gap-4 px-6 py-14' : 'gap-3 px-5 py-8',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'grid place-items-center rounded-full bg-secondary text-primary ring-8 ring-secondary/40',
            size === 'default' ? 'size-14' : 'size-11',
          )}
        >
          <Icon className={size === 'default' ? 'size-6' : 'size-5'} aria-hidden />
        </div>
      )}
      <div className="max-w-md space-y-1.5">
        <h3
          className={cn(
            'font-display font-semibold text-foreground',
            size === 'default' ? 'text-xl' : 'text-lg',
          )}
        >
          {title}
        </h3>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
