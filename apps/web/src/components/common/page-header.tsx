import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-5 pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-8 lg:pb-10',
        className,
      )}
    >
      <div className="min-w-0 space-y-2.5">
        {eyebrow && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
        <h1 className="text-3xl leading-[1.1] font-semibold tracking-[-0.035em] text-foreground sm:text-[2.6rem]">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
