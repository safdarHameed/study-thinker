'use client';

import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectItemClass,
  selectTriggerClass,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface PickerOption {
  value: string;
  label: React.ReactNode;
  /** Plain text used for search and the accessible name when `label` isn't a string. */
  text?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface PickerProps {
  value: string;
  onValueChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  /** Icon shown at the start of the trigger when the chosen option has none. */
  icon?: React.ReactNode;
  /** Adds a filter box. Defaults to on when there are more than 8 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: 'sm' | 'default';
  id?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

// Radix Select doesn't allow "" as an item value; map it to a sentinel.
const EMPTY = '__picker_empty__';
const enc = (v: string) => (v === '' ? EMPTY : v);
const dec = (v: string) => (v === EMPTY ? '' : v);

const textOf = (o: PickerOption) =>
  o.text ??
  (typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label) : o.value);

function OptionBody({ option }: { option: PickerOption }) {
  return (
    <>
      {option.icon && (
        <span className="grid size-5 shrink-0 place-items-center text-muted-foreground" aria-hidden>
          {option.icon}
        </span>
      )}
      <span className="truncate">{option.label}</span>
    </>
  );
}

/**
 * A polished single-choice dropdown. Small lists use an accessible Radix
 * Select; long lists (or `searchable`) become a filterable combobox.
 */
export function Picker(props: PickerProps) {
  // Keep picker-only options off the DOM.
  const { searchable, searchPlaceholder, ...rest } = props;
  return (searchable ?? props.options.length > 8) ? (
    <ComboPicker {...rest} searchPlaceholder={searchPlaceholder} />
  ) : (
    <SimplePicker {...rest} />
  );
}

function SimplePicker({
  value,
  onValueChange,
  options,
  placeholder = 'Choose…',
  icon,
  size = 'default',
  id,
  disabled,
  className,
  contentClassName,
  ...aria
}: PickerProps) {
  const selected = options.find((o) => o.value === value);
  return (
    <Select
      value={selected ? enc(value) : ''}
      onValueChange={(v) => onValueChange(dec(v))}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} className={className} {...aria}>
        {!selected?.icon && icon && (
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
        )}
        <SelectValue placeholder={placeholder}>
          {selected ? <OptionBody option={selected} /> : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={enc(o.value)}
            disabled={o.disabled}
            textValue={textOf(o)}
            extra={
              o.description ? (
                <span
                  className={cn(
                    'truncate text-xs font-normal text-muted-foreground',
                    o.icon && 'pl-7.5',
                  )}
                >
                  {o.description}
                </span>
              ) : undefined
            }
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <OptionBody option={o} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const MAX_SHOWN = 200;

function ComboPicker({
  value,
  onValueChange,
  options,
  placeholder = 'Choose…',
  icon,
  searchPlaceholder,
  size = 'default',
  id,
  disabled,
  className,
  contentClassName,
  ...aria
}: PickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const listRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      (q
        ? options.filter(
            (o) =>
              textOf(o).toLowerCase().includes(q) ||
              o.value.toLowerCase().includes(q) ||
              (typeof o.description === 'string' && o.description.toLowerCase().includes(q)),
          )
        : options
      ).slice(0, MAX_SHOWN),
    [options, q],
  );

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery('');
      setActive(
        Math.max(
          0,
          options.findIndex((o) => o.value === value),
        ),
      );
    }
  }

  function pick(o: PickerOption | undefined) {
    if (!o || o.disabled) return;
    onValueChange(o.value);
    setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const last = filtered.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i >= last ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? last : i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(last);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(filtered[active]);
    }
  }

  const activeId = filtered[active] ? `${listId}-${active}` : undefined;

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          disabled={disabled}
          data-placeholder={selected ? undefined : ''}
          className={cn(selectTriggerClass, size === 'sm' ? 'h-9' : 'h-11', className)}
          {...aria}
        >
          {!selected?.icon && icon && (
            <span className="text-muted-foreground" aria-hidden>
              {icon}
            </span>
          )}
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selected ? (
              <OptionBody option={selected} />
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </span>
          <ChevronDownIcon
            className="size-4 text-muted-foreground transition-transform duration-200 group-aria-expanded/trigger:rotate-180"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          'w-(--radix-popover-trigger-width) min-w-[min(18rem,calc(100vw-2rem))] gap-0 p-0',
          'rounded-xl border border-border/70 shadow-lift ring-0',
          contentClassName,
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/70 px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label={searchPlaceholder ?? 'Search'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder ?? `Search ${options.length}…`}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/80"
          />
        </div>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={aria['aria-label']}
          className="max-h-72 overflow-y-auto overscroll-contain p-1.5"
        >
          {filtered.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">No matches</p>
          ) : (
            filtered.map((o, i) => (
              <div
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                data-active={i === active}
                data-disabled={o.disabled ? '' : undefined}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={selectItemClass}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <OptionBody option={o} />
                  </span>
                  {o.description && (
                    <span
                      className={cn(
                        'truncate text-xs font-normal text-muted-foreground',
                        o.icon && 'pl-7.5',
                      )}
                    >
                      {o.description}
                    </span>
                  )}
                </span>
                {o.value === value && (
                  <CheckIcon className="absolute right-2.5 size-4 text-primary" aria-hidden />
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Accessible name when `label` is visually hidden or not a string. */
  'aria-label'?: string;
}

/** Pill-style segmented control for a handful (≤4) of choices. */
export function Segmented({
  value,
  onValueChange,
  options,
  size = 'default',
  disabled,
  className,
  ...aria
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
  size?: 'sm' | 'default';
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.findIndex((o) => o.value === value);

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    onValueChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      {...aria}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 rounded-xl border border-input bg-surface-sunken/70 p-1',
        size === 'sm' ? 'h-9' : 'h-11',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o['aria-label']}
            tabIndex={on || (index === -1 && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onValueChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:size-4 [&_svg]:shrink-0',
              on
                ? 'bg-card text-foreground shadow-soft ring-1 ring-foreground/5 dark:bg-secondary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.icon && <span aria-hidden>{o.icon}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
