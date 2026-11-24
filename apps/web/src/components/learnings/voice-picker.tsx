'use client';

import type { TeacherVoice } from '@studythinker/shared';
import { Mic2, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Picker } from '@/components/ui/picker';
import { speak, speechSupported, stopSpeaking, useVoices } from '@/lib/speech';

/** Choose the teacher's voice from the voices on this device, with a preview. */
export function VoicePicker({
  value,
  onChange,
  language,
  sample,
}: {
  value: TeacherVoice;
  onChange: (v: TeacherVoice) => void;
  language: string;
  sample: string;
}) {
  const { voices, best } = useVoices(language);
  const [playing, setPlaying] = useState(false);

  if (!speechSupported()) {
    return <p className="text-sm text-muted-foreground">No speech in this browser — text only.</p>;
  }

  async function preview() {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await speak(sample, value, language);
    setPlaying(false);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Picker
            aria-label="Teacher’s voice"
            value={value.voiceURI ?? ''}
            onValueChange={(v) => onChange({ ...value, voiceURI: v || null })}
            icon={<Mic2 />}
            searchPlaceholder="Search voices"
            options={[
              { value: '', label: best ? `Most natural · ${best.name}` : 'Most natural' },
              ...voices.map((v) => ({
                value: v.voiceURI,
                label: v.name,
                text: `${v.name} ${v.lang}`,
                description: v.lang,
              })),
            ]}
          />
        </div>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Speed {value.rate.toFixed(1)}×</span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            value={value.rate}
            onChange={(e) => onChange({ ...value, rate: Number(e.target.value) })}
            className="w-full accent-[var(--color-primary)]"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Pitch {value.pitch.toFixed(1)}</span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={value.pitch}
            onChange={(e) => onChange({ ...value, pitch: Number(e.target.value) })}
            className="w-full accent-[var(--color-primary)]"
          />
        </label>
      </div>
      <Button type="button" variant="outline" onClick={() => void preview()}>
        {playing ? <Square aria-hidden /> : <Play aria-hidden />}
        {playing ? 'Stop' : 'Preview'}
      </Button>
    </div>
  );
}
