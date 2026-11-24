'use client';

import { CircleAlert } from 'lucide-react';
import { cloneElement, isValidElement, useId } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: React.ReactNode;
  /** Single form control; receives id, aria-invalid and aria-describedby. */
  children: React.ReactElement<Record<string, unknown>>;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  id?: string;
}

/** Label + control + hint/error, wired up for assistive technology. */
export function Field({ label, children, hint, error, optional, className, id }: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={controlId} className="text-[0.95rem] font-medium">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Banner for form-level errors (e.g. wrong password, API unreachable). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      key={message}
      role="alert"
      className="flex animate-shake items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-[0.95rem] text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
