'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  /** Shown as a "Suggested" badge, with the AI's reason as a hint. */
  recommended?: boolean;
  reason?: string;
  disabled?: boolean;
  disabledLabel?: string;
}

/** Selectable cards (single or multiple) used across the options screen. */
export function ChoiceGrid({
  options,
  value,
  onChange,
  multiple = false,
  columns = 'sm:grid-cols-2 lg:grid-cols-3',
  label,
  icon,
}: {
  options: ChoiceOption[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  columns?: string;
  label: string;
  icon?: (id: string) => React.ReactNode;
}) {
  function toggle(id: string) {
    if (!multiple) return onChange([id]);
    if (value.includes(id)) {
      if (value.length > 1) onChange(value.filter((v) => v !== id));
    } else onChange([...value, id]);
  }
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      className={cn('grid gap-2.5', columns)}
    >
      {options.map((o) => {
        const selected = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => toggle(o.id)}
            className={cn(
              'relative flex items-start gap-3 rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
              selected
                ? 'border-primary bg-primary/[0.06] shadow-[0_0_0_1px_var(--color-primary)]'
                : 'border-border bg-card hover:border-primary/40',
              o.disabled && 'cursor-not-allowed opacity-55 hover:border-border',
            )}
          >
            {icon && (
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary',
                )}
              >
                {icon(o.id)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{o.label}</span>
                {o.recommended && !o.disabled && (
                  <span
                    title={o.reason}
                    className="rounded-full bg-highlight-soft px-2 py-0.5 text-[0.7rem] font-semibold text-highlight"
                  >
                    Suggested
                  </span>
                )}
                {o.disabled && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">
                    {o.disabledLabel ?? 'Coming soon'}
                  </span>
                )}
              </span>
              {(o.description || o.reason) && (
                <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                  {o.description || o.reason}
                </span>
              )}
            </span>
            {selected && (
              <Check
                className="absolute top-3 right-3 size-4 text-primary"
                strokeWidth={3}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Small pill choices (for short option lists). */
export function ChipChoices({
  options,
  value,
  onChange,
  multiple = false,
  label,
}: {
  options: { id: string; label: string; recommended?: boolean }[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  label: string;
}) {
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const selected = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={selected}
            onClick={() =>
              multiple
                ? onChange(selected ? value.filter((v) => v !== o.id) : [...value, o.id])
                : onChange([o.id])
            }
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/40',
            )}
          >
            {o.label}
            {o.recommended && !selected && <span className="ml-1 text-highlight">★</span>}
          </button>
        );
      })}
    </div>
  );
}

export function OptionSection({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="space-y-3.5 border-t border-border/70 pt-7 first:border-0 first:pt-0"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
