'use client';

import {
  TEACHER_HAIR,
  TEACHER_HAIR_COLORS,
  TEACHER_OUTFITS,
  TEACHER_SKINS,
  type TeacherLook,
} from '@studythinker/shared';
import { Shuffle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { TeacherFace } from './teacher-face';

const HAIR_LABEL: Record<(typeof TEACHER_HAIR)[number], string> = {
  short: 'Short',
  long: 'Long',
  curly: 'Curly',
  bun: 'Bun',
  bald: 'None',
  hijab: 'Hijab',
};

function Swatches<T extends string>({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-sm text-muted-foreground">{label}</span>
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`${label} ${i + 1}`}
          onClick={() => onChange(c)}
          className={cn(
            'size-7 rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110',
            value === c && 'ring-2 ring-primary',
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

/** Design how the teacher looks. */
export function LookPicker({
  value,
  onChange,
}: {
  value: TeacherLook;
  onChange: (v: TeacherLook) => void;
}) {
  const set = <K extends keyof TeacherLook>(k: K, v: TeacherLook[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="flex flex-col items-center gap-2">
        <TeacherFace look={value} state="speaking" size={128} />
        <button
          type="button"
          onClick={() =>
            onChange({
              skin: pick(TEACHER_SKINS),
              hair: pick(TEACHER_HAIR),
              hairColor: pick(TEACHER_HAIR_COLORS),
              glasses: Math.random() < 0.4,
              outfit: pick(TEACHER_OUTFITS),
            })
          }
          aria-label="Random look"
          title="Random look"
          className="grid size-8 place-items-center rounded-full text-primary transition-colors hover:bg-secondary"
        >
          <Shuffle className="size-4" aria-hidden />
        </button>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <Swatches
          label="Skin"
          colors={TEACHER_SKINS}
          value={value.skin}
          onChange={(v) => set('skin', v)}
        />
        <div role="radiogroup" aria-label="Hair" className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 text-sm text-muted-foreground">Hair</span>
          {TEACHER_HAIR.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={value.hair === h}
              onClick={() => set('hair', h)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium',
                value.hair === h
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/40',
              )}
            >
              {HAIR_LABEL[h]}
            </button>
          ))}
        </div>
        <Swatches
          label="Colour"
          colors={TEACHER_HAIR_COLORS}
          value={value.hairColor}
          onChange={(v) => set('hairColor', v)}
        />
        <Swatches
          label="Outfit"
          colors={TEACHER_OUTFITS}
          value={value.outfit}
          onChange={(v) => set('outfit', v)}
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={value.glasses} onCheckedChange={(c) => set('glasses', c)} /> Glasses
        </label>
      </div>
    </div>
  );
}
