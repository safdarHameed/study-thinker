import { Check } from 'lucide-react';
import { PASSWORD_MIN_LENGTH } from '@studythinker/shared';
import { cn } from '@/lib/utils';

/** 0–4 estimate from length and character variety (guidance only; the API enforces rules). */
export function passwordScore(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= 14) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  else if (/\d|[^A-Za-z0-9]/.test(value)) score += 0.5;
  if (value.length < PASSWORD_MIN_LENGTH) score = Math.min(score, 1);
  return Math.min(4, Math.round(score));
}

const LEVELS = [
  { label: 'Too short', bar: 'bg-rose-500', text: 'text-rose-600' },
  { label: 'Weak', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Fair', bar: 'bg-yellow-400', text: 'text-yellow-700' },
  { label: 'Good', bar: 'bg-indigo-500', text: 'text-indigo-600' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600' },
];

/** Live strength meter and the one hard requirement, announced politely. */
export function PasswordStrength({ value, id }: { value: string; id?: string }) {
  const long = value.length >= PASSWORD_MIN_LENGTH;
  const score = value ? (long ? Math.max(1, passwordScore(value)) : 0) : -1;
  const level = score >= 0 ? LEVELS[score]! : null;

  return (
    <div id={id} className="space-y-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              level && (score >= i || (score === 0 && i === 1)) ? level.bar : 'bg-zinc-200',
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span
          className={cn(
            'flex items-center gap-1.5 transition-colors',
            long ? 'text-emerald-600' : 'text-zinc-500',
          )}
        >
          <span
            className={cn(
              'grid size-4 place-items-center rounded-full transition-colors',
              long ? 'bg-emerald-500 text-white' : 'ring-1 ring-zinc-300',
            )}
          >
            {long && <Check className="size-3" strokeWidth={3} aria-hidden />}
          </span>
          At least {PASSWORD_MIN_LENGTH} characters
        </span>
        {level && <span className={cn('font-medium', level.text)}>{level.label}</span>}
      </div>
    </div>
  );
}
