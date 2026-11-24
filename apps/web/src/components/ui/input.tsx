import * as React from 'react';
import { cn } from '@/lib/utils';

export const fieldControlClass =
  'w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-base text-foreground shadow-[0_1px_2px_rgb(9_9_11/0.04)] transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 dark:bg-surface-sunken';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClass,
        'h-11 py-2 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
