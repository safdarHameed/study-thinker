import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_1px_2px_rgb(30_27_75/0.25)] hover:bg-primary/90',
        highlight:
          'bg-highlight text-highlight-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_1px_2px_rgb(46_16_101/0.25)] hover:bg-highlight/90',
        outline:
          'border-input bg-card text-foreground hover:bg-muted aria-expanded:bg-muted dark:bg-transparent dark:hover:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/75',
        ghost: 'text-foreground hover:bg-muted aria-expanded:bg-muted',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30 dark:text-background',
        'destructive-soft': 'bg-destructive/10 text-destructive hover:bg-destructive/15',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 text-[0.95rem]',
        sm: 'h-8 gap-1.5 rounded-md px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-md',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
