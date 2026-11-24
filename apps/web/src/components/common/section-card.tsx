import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  as?: 'section' | 'div';
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  as: Comp = 'section',
}: SectionCardProps) {
  return (
    <Comp
      className={cn(
        'flex flex-col gap-5 rounded-2xl border border-border/80 bg-card p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          {description && <p className="text-[0.95rem] text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
    </Comp>
  );
}
