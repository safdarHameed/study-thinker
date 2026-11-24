'use client';

import { ArrowBigUp, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Password field with a show/hide toggle and a Caps Lock warning. */
export function PasswordInput({
  className,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: React.ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCaps = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          className={cn('pr-12', className)}
          onKeyDown={(e) => {
            readCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            readCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {capsLock && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-amber-600">
          <ArrowBigUp className="size-4" aria-hidden /> Caps Lock is on
        </p>
      )}
    </div>
  );
}
