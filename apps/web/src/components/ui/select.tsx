'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from 'radix-ui';
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from 'lucide-react';

/** Shared look for select-like triggers (Select and the searchable Picker). */
export const selectTriggerClass =
  "group/trigger flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-input bg-card pr-2.5 pl-3 text-left text-sm whitespace-nowrap shadow-[0_1px_2px_rgb(9_9_11/0.04)] transition-[border-color,box-shadow,background-color] outline-none select-none hover:border-foreground/25 hover:bg-surface-sunken/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-expanded:border-ring aria-expanded:ring-3 aria-expanded:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/20 data-placeholder:text-muted-foreground dark:bg-surface-sunken dark:hover:bg-surface-sunken/70 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/** Shared look for floating option lists. */
export const selectContentClass =
  'z-50 overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-lift duration-150 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97]';

/** Shared look for one option row. */
export const selectItemClass =
  "relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg py-2 pr-8 pl-2.5 text-sm outline-hidden select-none transition-colors hover:bg-primary/[0.06] focus:bg-primary/[0.08] data-[highlighted]:bg-primary/[0.08] data-[active=true]:bg-primary/[0.08] data-disabled:pointer-events-none data-disabled:opacity-50 aria-selected:font-medium data-[state=checked]:font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  );
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        selectTriggerClass,
        'data-[size=default]:h-11 data-[size=sm]:h-9 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = 'popper',
  align = 'start',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          selectContentClass,
          'relative max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-36 origin-(--radix-select-content-transform-origin)',
          position === 'popper' && 'w-(--radix-select-trigger-width)',
          className,
        )}
        position={position}
        align={align}
        sideOffset={position === 'popper' ? sideOffset : undefined}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('px-2.5 py-1.5 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  extra,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  /** Rendered beside the label in the list only (not in the trigger). */
  extra?: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(selectItemClass, className)}
      {...props}
    >
      <span className="pointer-events-none absolute right-2.5 flex size-4 items-center justify-center text-primary">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {extra}
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
