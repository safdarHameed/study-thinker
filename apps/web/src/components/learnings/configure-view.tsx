'use client';

import { useAssistantPage } from '@/components/assistant/assistant-context';
import {
  ASSESSMENT_STYLES,
  AUDIENCES,
  defaultPreferences,
  JOURNEY_STRUCTURES,
  LEARNING_MODES,
  type LearningDetail,
  type LearningOptions,
  type LearningPreferences,
  STARTING_LEVELS,
  TEACHER_PERSONAS,
  shortTitle,
} from '@studythinker/shared';
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { FlowSteps } from '@/components/engage/flow-steps';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/picker';
import { Textarea } from '@/components/ui/textarea';
import { api, describeError } from '@/lib/api';
import { useSetLearning } from '@/lib/queries';
import { ChipChoices, ChoiceGrid, OptionSection } from './choice';
import { AssessmentIcon, ModeIcon } from './icons';
import { StructureIcon } from './structure-icon';
import { LookPicker } from './look-picker';
import { VoicePicker } from './voice-picker';

/** Ranked AI recommendations first, then the rest of the catalog. */
function ranked<T extends { id: string; label: string; description: string; available: boolean }>(
  catalog: readonly T[],
  recs: { id: string; reason: string }[],
) {
  const order = new Map(recs.map((r, i) => [r.id, i]));
  return catalog
    .filter((e) => e.available)
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
    .map((e) => ({
      id: e.id,
      label: e.label,
      description: e.description,
      recommended: order.has(e.id) && (order.get(e.id) ?? 99) < 3,
      reason: recs.find((r) => r.id === e.id)?.reason || undefined,
      disabled: !e.available,
    }));
}

export function ConfigureView({
  learning,
  options,
  onCancel,
}: {
  learning: LearningDetail;
  options: LearningOptions;
  /** Present when changing an existing journey. */
  onCancel?: () => void;
}) {
  const setLearning = useSetLearning();
  const [prefs, setPrefs] = useState<LearningPreferences>(
    () => learning.preferences ?? defaultPreferences(options),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof LearningPreferences>(key: K, v: LearningPreferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: v }));
  const rebuilding = !!learning.steps.length;
  useAssistantPage(
    `${rebuilding ? 'Changing the choices' : 'Choosing how to learn'} for “${shortTitle(learning.title)}” (who, time, journey shape, ways of learning, assessments, teacher, then build)`,
  );

  async function build() {
    setBusy(true);
    setError(null);
    try {
      setLearning(await api.learnings.build(learning.id, prefs));
      onCancel?.();
    } catch (err) {
      setError(describeError(err).description);
    } finally {
      setBusy(false);
    }
  }

  const durationReason = options.duration.reason;
  const weeks =
    prefs.duration.unit === 'days'
      ? prefs.duration.amount / 7
      : prefs.duration.unit === 'months'
        ? prefs.duration.amount * 4.3
        : prefs.duration.amount;
  const totalHours = Math.max(
    1,
    Math.round((weeks * prefs.sessionsPerWeek * prefs.minutesPerSession) / 60),
  );

  async function suggestAgain() {
    setBusy(true);
    try {
      setLearning(await api.learnings.regenerateOptions(learning.id));
    } catch (err) {
      setError(describeError(err).description);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {!rebuilding && <FlowSteps current={1} className="mb-8" />}
      <header className="mb-8 space-y-3">
        <div className="flex items-start gap-3">
          <h1 className="flex-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {shortTitle(learning.title)}
          </h1>
          {!rebuilding && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void suggestAgain()}
              disabled={busy}
              aria-label="Suggest again"
              title="Suggest again"
              className="mt-1.5 text-primary"
            >
              <RefreshCw />
            </Button>
          )}
        </div>
        {options.summary && (
          <p className="flex gap-1.5 text-muted-foreground">
            <Sparkles className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
            {options.summary}
          </p>
        )}
      </header>

      <div className="space-y-7">
        <OptionSection title="Learner" hint={options.audience.reason}>
          <ChipChoices
            label="Learner"
            options={AUDIENCES.map((a) => ({
              id: a.id,
              label: a.label,
              recommended: a.id === options.audience.id,
            }))}
            value={[prefs.audience]}
            onChange={([v]) => set('audience', v as LearningPreferences['audience'])}
          />
          <ChipChoices
            label="Starting level"
            options={STARTING_LEVELS.map((a) => ({
              id: a.id,
              label: a.label,
              recommended: a.id === options.level.id,
            }))}
            value={[prefs.level]}
            onChange={([v]) => set('level', v as LearningPreferences['level'])}
          />
        </OptionSection>

        <OptionSection title="Time" hint={durationReason}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={prefs.duration.amount}
                onChange={(e) =>
                  set('duration', { ...prefs.duration, amount: clampInt(e.target.value, 1, 365) })
                }
                aria-label="Length"
                className="w-18 shrink-0"
              />
              <Segmented
                aria-label="Unit"
                value={prefs.duration.unit}
                onValueChange={(v) =>
                  set('duration', {
                    ...prefs.duration,
                    unit: v as LearningPreferences['duration']['unit'],
                  })
                }
                options={[
                  { value: 'days', label: 'Days' },
                  { value: 'weeks', label: 'Weeks' },
                  { value: 'months', label: 'Months' },
                ]}
                className="flex-1"
              />
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{prefs.minutesPerSession} min / session</span>
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={prefs.minutesPerSession}
                onChange={(e) => set('minutesPerSession', Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{prefs.sessionsPerWeek}× / week</span>
              <input
                type="range"
                min={1}
                max={14}
                value={prefs.sessionsPerWeek}
                onChange={(e) => set('sessionsPerWeek', Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
            </label>
          </div>
        </OptionSection>

        <OptionSection title="Journey shape">
          <ChoiceGrid
            label="Journey shape"
            options={ranked(JOURNEY_STRUCTURES, options.structures).map((o) => ({
              ...o,
              recommended: o.id === options.structures[0]?.id || o.recommended,
            }))}
            value={[prefs.structure]}
            onChange={([v]) => set('structure', v as LearningPreferences['structure'])}
            icon={(id) => <StructureIcon structure={id} className="size-[1.1rem]" />}
          />
        </OptionSection>

        <OptionSection title="Ways to learn">
          <ChoiceGrid
            multiple
            label="Ways of learning"
            options={ranked(LEARNING_MODES, options.modes)}
            value={prefs.modes}
            onChange={(v) => set('modes', v as LearningPreferences['modes'])}
            icon={(id) => <ModeIcon id={id} className="size-[1.1rem]" />}
          />
          <label className="block space-y-2 pt-2">
            <span className="flex justify-between text-sm font-medium">
              <span>Theory</span>
              <span className="text-muted-foreground">{prefs.theoryPractice}%</span>
              <span>Practice</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={prefs.theoryPractice}
              onChange={(e) => set('theoryPractice', Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
              aria-label="Theory or practice"
            />
          </label>
        </OptionSection>

        <OptionSection title="Assessments">
          <ChoiceGrid
            multiple
            label="Assessment styles"
            options={ranked(ASSESSMENT_STYLES, options.assessments)}
            value={prefs.assessments}
            onChange={(v) => set('assessments', v as LearningPreferences['assessments'])}
            icon={(id) => <AssessmentIcon id={id} className="size-[1.1rem]" />}
          />
        </OptionSection>

        <OptionSection title="Teacher" hint={options.teacher.reason}>
          <ChoiceGrid
            label="Teacher personality"
            options={TEACHER_PERSONAS.map((t) => ({
              id: t.id,
              label: t.label,
              description: t.description,
              recommended: t.id === options.teacher.id,
            }))}
            value={[prefs.teacher]}
            onChange={([v]) => set('teacher', v as LearningPreferences['teacher'])}
          />
          <div className="rounded-xl border border-border bg-card p-4">
            <VoicePicker
              value={prefs.voice}
              onChange={(v) => set('voice', v)}
              language={prefs.language}
              sample={`Hello! I'm your teacher for ${shortTitle(learning.title)}. Shall we begin?`}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <LookPicker value={prefs.look} onChange={(v) => set('look', v)} />
          </div>
        </OptionSection>

        {options.extraQuestions.length > 0 && (
          <OptionSection title="Details">
            <div className="space-y-5">
              {options.extraQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium">{q.label}</p>
                  {q.help && <p className="text-sm text-muted-foreground">{q.help}</p>}
                  <ChipChoices
                    label={q.label}
                    multiple={q.multiple}
                    options={q.options.map((o) => ({ id: o, label: o }))}
                    value={prefs.extras[q.id] ?? []}
                    onChange={(v) => set('extras', { ...prefs.extras, [q.id]: v })}
                  />
                </div>
              ))}
            </div>
          </OptionSection>
        )}

        <OptionSection title="Extras">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Language</span>
            <Input
              value={prefs.language}
              onChange={(e) => set('language', e.target.value)}
              maxLength={40}
              className="max-w-xs"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="sr-only">Notes</span>
            <Textarea
              value={prefs.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Notes — e.g. use football examples"
            />
          </label>
        </OptionSection>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-10 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm font-medium">
            {prefs.duration.amount} {prefs.duration.unit} · {prefs.sessionsPerWeek}×/week · ~
            {totalHours} h
          </p>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button size="lg" onClick={() => void build()} disabled={busy || !prefs.language.trim()}>
            {busy ? 'Starting…' : rebuilding ? 'Redesign' : 'Create journey'}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function clampInt(v: string, min: number, max: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
