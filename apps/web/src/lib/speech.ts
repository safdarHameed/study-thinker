'use client';

import type { TeacherVoice } from '@studythinker/shared';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api, describeError } from '@/lib/api';

// ───────────────────────── Text to speech (browser voices, free) ─────────────────────────

const LANGUAGE_CODES: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  español: 'es',
  french: 'fr',
  français: 'fr',
  german: 'de',
  deutsch: 'de',
  italian: 'it',
  portuguese: 'pt',
  dutch: 'nl',
  russian: 'ru',
  arabic: 'ar',
  urdu: 'ur',
  hindi: 'hi',
  bengali: 'bn',
  chinese: 'zh',
  mandarin: 'zh',
  japanese: 'ja',
  korean: 'ko',
  turkish: 'tr',
  polish: 'pl',
  swedish: 'sv',
  greek: 'el',
  hebrew: 'he',
  indonesian: 'id',
  vietnamese: 'vi',
  thai: 'th',
  persian: 'fa',
  ukrainian: 'uk',
};

/** "Spanish" → "es" (falls back to the browser's language). */
export function languageCode(language: string | undefined) {
  const key = (language ?? '').trim().toLowerCase();
  if (/^[a-z]{2}(-[a-z]{2})?$/i.test(key)) return key;
  return (
    LANGUAGE_CODES[key] ??
    (typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en')
  );
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let voicesCache: SpeechSynthesisVoice[] = [];
function subscribeVoices(cb: () => void) {
  if (!speechSupported()) return () => {};
  const update = () => {
    voicesCache = window.speechSynthesis.getVoices();
    cb();
  };
  update();
  window.speechSynthesis.addEventListener('voiceschanged', update);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
}

/** Voices that sound like people (cloud / neural / premium voices). */
const NATURAL = /natural|neural|premium|enhanced|online|siri|google|wavenet|studio|multilingual/i;
/** Novelty and very old voices that sound robotic. */
const ROBOTIC =
  /compact|espeak|zarvox|trinoids|whisper|bells|bad news|good news|boing|bubbles|cellos|jester|organ|superstar|wobble|albert|bahh|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;

function quality(v: SpeechSynthesisVoice) {
  return (NATURAL.test(v.name) ? 3 : 0) + (ROBOTIC.test(v.name) ? -10 : 0) + (v.default ? 1 : 0);
}

/** The most human-sounding voice for a language on this device. */
export function bestVoice(language?: string, all = voicesCache) {
  const code = languageCode(language);
  const matching = all.filter((v) => v.lang.toLowerCase().startsWith(code));
  return [...(matching.length ? matching : all)].sort((a, b) => quality(b) - quality(a))[0];
}

/** The device's voices for the language, most natural first (novelty voices left out). */
export function useVoices(language?: string) {
  const all = useSyncExternalStore(
    subscribeVoices,
    () => voicesCache,
    () => voicesCache,
  );
  const code = languageCode(language);
  const matching = all.filter((v) => v.lang.toLowerCase().startsWith(code));
  const voices = [...(matching.length ? matching : all)]
    .filter((v) => !ROBOTIC.test(v.name))
    .sort((a, b) => quality(b) - quality(a));
  return { voices, all, best: bestVoice(language, all) };
}

/** Makes Markdown readable aloud. */
export function speakable(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' (code example on screen) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bumped by every stop, so speech that was queued before it is dropped. */
let generation = 0;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Breaks text into breath-sized phrases: sentences, and long sentences at their
 * commas, each with the pause a person would make after it.
 */
function phrases(text: string) {
  const out: { text: string; pause: number }[] = [];
  const sentences = text.match(/[^.!?。！？…]+[.!?。！？…]*["')\]]*\s*/g) ?? [text];
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    const end = sentence.trim().slice(-1);
    const parts = words > 22 ? (sentence.match(/[^,;:—]+[,;:—]?\s*/g) ?? [sentence]) : [sentence];
    parts.forEach((part, i) => {
      if (!part.trim()) return;
      const last = i === parts.length - 1;
      out.push({
        text: part.trim(),
        pause: !last ? 110 : end === '?' ? 380 : end === '!' ? 300 : 260,
      });
    });
  }
  return out;
}

/**
 * Speaks text phrase by phrase, like a person: small changes of pitch and pace
 * from one sentence to the next, questions rising, and short pauses between.
 */
async function utter(text: string, voice: TeacherVoice, language?: string): Promise<void> {
  if (!speechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  const mine = generation;
  const chosen =
    synth.getVoices().find((v) => v.voiceURI === voice.voiceURI) ?? bestVoice(language);
  const list = phrases(text);
  // A gentle, repeating variation, so the same text always sounds the same.
  const pitchDrift = [0, 0.04, -0.03, 0.02, -0.02, 0.03];
  const rateDrift = [0, -0.03, 0.02, -0.01, 0.03, -0.02];
  for (const [i, p] of list.entries()) {
    if (mine !== generation) return;
    const words = p.text.split(/\s+/).length;
    const end = p.text.slice(-1);
    const u = new SpeechSynthesisUtterance(p.text);
    if (chosen) u.voice = chosen;
    u.lang = chosen?.lang ?? languageCode(language);
    u.pitch = Math.min(
      2,
      Math.max(0, voice.pitch + pitchDrift[i % 6]! + (end === '?' ? 0.07 : end === '!' ? 0.04 : 0)),
    );
    // Short phrases ("Nice!", "Good question.") are said a little slower.
    u.rate = Math.min(
      2,
      Math.max(0.5, voice.rate * (1 + rateDrift[i % 6]!) * (words <= 4 ? 0.94 : 1)),
    );
    await new Promise<void>((resolve) => {
      u.onend = u.onerror = () => resolve();
      synth.speak(u);
    });
    if (mine !== generation) return;
    if (i < list.length - 1) await wait(p.pause);
  }
}

/** Speaks text with the learner's chosen voice. Resolves when finished (or cancelled). */
export function speak(text: string, voice: TeacherVoice, language?: string): Promise<void> {
  stopSpeaking();
  return utter(text, voice, language);
}

/**
 * Speaks a reply while it is still being written: each finished sentence is
 * spoken as soon as it arrives, so the teacher starts talking right away.
 */
export function createSpeechStream(voice: TeacherVoice, language?: string) {
  let buffer = '';
  let chain: Promise<void> = Promise.resolve();
  let cancelled = false;
  stopSpeaking();
  const say = (text: string) => {
    const clean = speakable(text);
    if (!clean) return;
    chain = chain.then(() => (cancelled ? undefined : utter(clean, voice, language)));
  };
  return {
    push(piece: string) {
      buffer += piece;
      // Speak whole sentences (at least a few words, so speech isn't choppy).
      for (;;) {
        const m = /^[\s\S]{12,}?[.!?。！？…](?=\s|$)/.exec(buffer);
        if (!m || m[0].length === buffer.length) break;
        say(m[0]);
        buffer = buffer.slice(m[0].length);
      }
    },
    /** Speaks what is left; resolves when everything has been said. */
    finish() {
      if (buffer.trim()) say(buffer);
      buffer = '';
      return chain;
    },
    cancel() {
      cancelled = true;
      buffer = '';
      stopSpeaking();
    },
  };
}

export function stopSpeaking() {
  generation += 1;
  if (speechSupported()) window.speechSynthesis.cancel();
}

// ───────────────────────── Speech to text ─────────────────────────

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function browserRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const recorderSupported = () =>
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

export type DictationMethod = 'server' | 'browser' | null;

/** Picks how to turn speech into text: the server (Hugging Face Whisper) if it can, else the browser. */
export function dictationMethod(serverTranscription: boolean): DictationMethod {
  if (serverTranscription && recorderSupported()) return 'server';
  if (browserRecognition()) return 'browser';
  return null;
}

/**
 * Push-to-talk: `start()` listens, `stop()` finishes and calls `onText` with
 * what was said. Works with the server (recording) or the browser's own recogniser.
 */
export function useDictation({
  method,
  language,
  onText,
}: {
  method: DictationMethod;
  language?: string;
  onText: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<InstanceType<RecognitionCtor> | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const start = useCallback(async () => {
    setError(null);
    setInterim('');
    stopSpeaking();
    if (method === 'server') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'].find((m) =>
          MediaRecorder.isTypeSupported(m),
        );
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setListening(false);
          const blob = new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
          if (blob.size < 1200) return setError('That was too short — hold on a little longer.');
          setTranscribing(true);
          try {
            const { text } = await api.ai.transcribe(blob);
            if (text.trim()) onTextRef.current(text.trim());
            else setError('I couldn’t hear anything. Try again a bit closer to the microphone.');
          } catch (err) {
            setError(describeError(err).description);
          } finally {
            setTranscribing(false);
          }
        };
        recorder.current = rec;
        rec.start();
        setListening(true);
      } catch {
        setError('Microphone access was blocked. Allow it in your browser to talk.');
      }
      return;
    }
    const Ctor = browserRecognition();
    if (!Ctor) return setError('Speech recognition isn’t available in this browser.');
    const rec = new Ctor();
    rec.lang = languageCode(language);
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = '';
    rec.onresult = (e) => {
      let live = '';
      finalText = '';
      for (const r of Array.from(e.results)) {
        if (r.isFinal) finalText += r[0]!.transcript;
        else live += r[0]!.transcript;
      }
      setInterim(`${finalText}${live}`);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech')
        setError(
          e.error === 'not-allowed' ? 'Microphone access was blocked.' : 'Listening failed.',
        );
    };
    rec.onend = () => {
      setListening(false);
      const text = finalText.trim();
      setInterim('');
      if (text) onTextRef.current(text);
    };
    recognition.current = rec;
    rec.start();
    setListening(true);
  }, [method, language]);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recognition.current?.stop();
  }, []);

  useEffect(() => stop, [stop]);

  return { listening, transcribing, error, interim, start, stop, supported: method !== null };
}
