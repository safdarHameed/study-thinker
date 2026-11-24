import { AI_PROVIDERS, type AiModelInfo, type AiProviderId } from '@studythinker/shared';
import { CLAUDE_CODE_MODELS, claudeCodeChat, claudeCodeEnabled } from './claude-code.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatTarget {
  provider: AiProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs: number;
  /** Ask for a JSON object where the provider supports it. */
  json?: boolean;
  /**
   * Stream the answer: called with each new piece of visible text (reasoning
   * blocks removed). Providers that can't stream fall back to one final call.
   */
  onDelta?: (text: string) => void;
}

export type AiErrorCode =
  | 'auth'
  | 'rate_limited'
  | 'quota'
  | 'no_credit'
  | 'bad_model'
  | 'timeout'
  | 'unavailable'
  | 'invalid_output'
  | 'not_configured';

const MESSAGES: Record<AiErrorCode, string> = {
  auth: 'The AI provider rejected the API key. Check it in Settings → AI.',
  rate_limited: 'The AI provider is rate limiting requests. Wait a moment and try again.',
  quota:
    'Your AI provider says the usage limit (quota) for this key is used up. Wait for it to reset, check your plan, or use another key in Settings → AI.',
  no_credit:
    'The AI account has run out of credit. Add credit with the provider or use another key.',
  bad_model:
    'The selected model is not available with this key. Pick another model in Settings → AI.',
  timeout: 'The AI took too long to answer. Please try again.',
  unavailable: 'The AI provider could not be reached. Please try again.',
  invalid_output: 'The AI gave an answer we could not use. Please try again.',
  not_configured: 'No AI model is set up. Add your own API key in Settings → AI.',
};

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly detail?: string,
  ) {
    super(MESSAGES[code]);
  }
}

export function providerInfo(id: AiProviderId) {
  return AI_PROVIDERS.find((p) => p.id === id)!;
}

export function resolveBaseUrl(provider: AiProviderId, custom?: string | null) {
  const url = provider === 'custom' ? (custom ?? '') : (custom ?? providerInfo(provider).baseUrl);
  return url.replace(/\/+$/, '');
}

function classify(status: number, body: string): AiError {
  const text = body.slice(0, 300);
  if (status === 401 || status === 403) return new AiError('auth', text);
  if (status === 402 || /insufficient.(funds|balance|credit)|credit balance|billing/i.test(body))
    return new AiError('no_credit', text);
  if (/quota/i.test(body)) return new AiError('quota', text);
  if (status === 429) return new AiError('rate_limited', text);
  if (status === 404 || (status === 400 && /model/i.test(body)))
    return new AiError('bad_model', text);
  return new AiError('unavailable', `HTTP ${status}: ${text}`);
}

async function open(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  let res: Response;
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    res = await fetch(url, { ...init, signal });
  } catch (err) {
    // A dropped connection (e.g. a reused keep-alive socket) gets one retry; timeouts don't.
    if (toFetchError(err).code === 'timeout') throw toFetchError(err);
    try {
      res = await fetch(url, { ...init, signal });
    } catch (again) {
      throw toFetchError(again);
    }
  }
  if (res.status === 502 || res.status === 503) {
    // Overloaded models often recover within a moment: try once more.
    await res.body?.cancel().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 1500));
    try {
      res = await fetch(url, { ...init, signal });
    } catch (err) {
      throw toFetchError(err);
    }
  }
  if (!res.ok) throw classify(res.status, await res.text().catch(() => ''));
  return res;
}

function toFetchError(err: unknown) {
  const name = (err as Error).name;
  return new AiError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unavailable');
}

async function send(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const res = await open(url, init, timeoutMs);
  let body: string;
  try {
    body = await res.text();
  } catch (err) {
    throw toFetchError(err);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new AiError('unavailable', 'Response was not JSON');
  }
}

/** Removes reasoning blocks some open models put in their answer. */
export function stripThinking(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Hides `<think>…</think>` blocks from a stream of text pieces. A tag can be
 * split across pieces, so a possible partial tag is held back until it's known.
 */
export class ThinkFilter {
  private buffer = '';
  private thinking = false;

  push(piece: string): string {
    this.buffer += piece;
    let out = '';
    for (;;) {
      const tag = this.thinking ? '</think>' : '<think>';
      const at = this.buffer.toLowerCase().indexOf(tag);
      if (at !== -1) {
        if (!this.thinking) out += this.buffer.slice(0, at);
        this.buffer = this.buffer.slice(at + tag.length);
        this.thinking = !this.thinking;
        continue;
      }
      // Keep back anything that could be the start of the tag.
      let keep = 0;
      for (let n = Math.min(tag.length - 1, this.buffer.length); n > 0; n--) {
        if (tag.startsWith(this.buffer.slice(-n).toLowerCase())) {
          keep = n;
          break;
        }
      }
      const ready = this.buffer.slice(0, this.buffer.length - keep);
      if (!this.thinking) out += ready;
      this.buffer = this.buffer.slice(this.buffer.length - keep);
      return out;
    }
  }

  flush(): string {
    const rest = this.thinking ? '' : this.buffer;
    this.buffer = '';
    return rest;
  }
}

/** Reads a server-sent-events body, calling `onData` with each `data:` payload. */
async function readSse(res: Response, onData: (data: string) => void) {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, nl).replace(/\r$/, '');
        pending = pending.slice(nl + 1);
        if (line.startsWith('data:')) onData(line.slice(5).trim());
      }
    }
  } catch (err) {
    throw toFetchError(err);
  }
  if (pending.startsWith('data:')) onData(pending.slice(5).trim());
}

/**
 * Claude models from 4.6 on think adaptively and take an `effort`; the current ones
 * reject custom sampling (`temperature`), so it is never sent to them.
 */
const CLAUDE_ADAPTIVE = /claude-(opus|sonnet|haiku|fable|mythos)-(4-[6-9]|[5-9])/;

function request(
  target: ChatTarget,
  messages: ChatMessage[],
  opts: ChatOptions,
  stream: boolean,
): { url: string; init: RequestInit } {
  const maxTokens = opts.maxTokens ?? 4096;
  if (target.provider === 'anthropic') {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const adaptive = CLAUDE_ADAPTIVE.test(target.model);
    return {
      url: `${target.baseUrl}/messages`,
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': target.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: target.model,
          // Thinking shares max_tokens with the answer: leave it room.
          max_tokens: adaptive ? maxTokens + 4000 : maxTokens,
          ...(system ? { system } : {}),
          messages: messages.filter((m) => m.role !== 'system'),
          ...(adaptive
            ? { output_config: { effort: maxTokens <= 1500 ? 'low' : 'medium' } }
            : opts.temperature !== undefined
              ? { temperature: opts.temperature }
              : {}),
          ...(stream ? { stream: true } : {}),
        }),
      },
    };
  }
  // OpenAI's newer models reject `max_tokens` and custom temperatures.
  const isOpenAi = target.provider === 'openai';
  return {
    url: `${target.baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${target.apiKey}`,
      },
      body: JSON.stringify({
        model: target.model,
        messages,
        ...(isOpenAi ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
        ...(!isOpenAi && opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.json && target.provider !== 'huggingface'
          ? { response_format: { type: 'json_object' } }
          : {}),
        ...(stream ? { stream: true } : {}),
      }),
    } satisfies RequestInit,
  };
}

function textOf(target: ChatTarget, data: unknown): string {
  if (target.provider === 'anthropic') {
    const d = data as { content?: { type: string; text?: string }[] };
    return (d.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
  }
  const d = data as { choices?: { message?: { content?: string | null } }[] };
  return d.choices?.[0]?.message?.content ?? '';
}

export async function chat(
  target: ChatTarget,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<string> {
  if (target.provider === 'claude-code') return claudeCodeChat(target.model, messages, opts);
  const { onDelta } = opts;
  const { url, init } = request(target, messages, opts, !!onDelta);
  if (!onDelta) {
    const text = stripThinking(textOf(target, await send(url, init, opts.timeoutMs)));
    if (!text) throw new AiError('invalid_output', 'Empty response');
    return text;
  }

  const res = await open(url, init, opts.timeoutMs);
  const filter = new ThinkFilter();
  let full = '';
  const emit = (piece: string) => {
    const visible = filter.push(piece);
    if (visible) {
      full += visible;
      onDelta(visible);
    }
  };

  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    // The server ignored `stream`: use the whole answer at once.
    let data: unknown;
    try {
      data = JSON.parse(await res.text());
    } catch {
      throw new AiError('unavailable', 'Response was not JSON');
    }
    emit(textOf(target, data));
  } else {
    let failure: string | null = null;
    await readSse(res, (data) => {
      if (!data || data === '[DONE]') return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (event.error) {
        failure = JSON.stringify(event.error).slice(0, 300);
        return;
      }
      if (target.provider === 'anthropic') {
        const delta = event.delta as { type?: string; text?: string } | undefined;
        if (event.type === 'content_block_delta' && delta?.type === 'text_delta' && delta.text)
          emit(delta.text);
        return;
      }
      const choice = (event.choices as { delta?: { content?: string | null } }[] | undefined)?.[0];
      if (choice?.delta?.content) emit(choice.delta.content);
    });
    if (failure && !full) throw classify(500, failure);
  }
  const rest = filter.flush();
  if (rest) {
    full += rest;
    onDelta(rest);
  }
  const text = full.trim();
  if (!text) throw new AiError('invalid_output', 'Empty response');
  return text;
}

/** Lists the chat models a key can use. */
export async function listModels(
  provider: AiProviderId,
  baseUrl: string,
  apiKey: string,
  timeoutMs = 20_000,
): Promise<AiModelInfo[]> {
  if (provider === 'claude-code') {
    if (!claudeCodeEnabled()) throw new AiError('not_configured', 'Claude Code (local) is off');
    return CLAUDE_CODE_MODELS;
  }
  if (provider === 'anthropic') {
    const data = (await send(
      `${baseUrl}/models?limit=100`,
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } },
      timeoutMs,
    )) as { data?: { id: string; display_name?: string }[] };
    return (data.data ?? []).map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
  }
  const data = (await send(
    `${baseUrl}/models`,
    { headers: { authorization: `Bearer ${apiKey}` } },
    timeoutMs,
  )) as { data?: ListedModel[] } | ListedModel[];
  const list: ListedModel[] = Array.isArray(data) ? data : (data.data ?? []);
  return list
    .filter((m) => {
      const out = m?.architecture?.output_modalities;
      return m?.id && !NOT_CHAT.test(m.id) && (!out || out.includes('text'));
    })
    .map((m) => ({
      id: m.id,
      label: (typeof m.name === 'string' && m.name) || prettyModel(m.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

interface ListedModel {
  id: string;
  name?: string;
  architecture?: { output_modalities?: string[] };
}

/** Model ids that can't hold a text conversation through chat completions. */
const NOT_CHAT =
  /embed|whisper|tts|dall-e|image|imagen|veo|lyria|moderation|transcribe|audio|realtime|rerank|guard|search|computer-use|codex|deep-research|o1-pro|-pro-\d|babbage|davinci|\baqa\b|learnlm|live|native|vision-preview|clip|ocr|sora/i;

/** Good, fast all-rounders first; the first that answers becomes the recommendation. */
const PREFERRED: Partial<Record<AiProviderId, RegExp[]>> = {
  'claude-code': [/^sonnet$/, /^haiku$/, /^opus$/],
  openai: [
    /^gpt-4\.1-mini$/,
    /^gpt-4o-mini$/,
    /^gpt-5(\.\d)?-mini$/,
    /^gpt-4\.1$/,
    /^gpt-4o$/,
    /^gpt-5/,
    /^o4-mini$/,
    /^gpt/,
  ],
  anthropic: [
    /sonnet-5-5$/,
    /haiku-5-5$/,
    /opus-5-5$/,
    /sonnet-5/,
    /haiku-5/,
    /opus-5/,
    /sonnet-4/,
    /haiku-4/,
    /sonnet/,
    /haiku/,
    /opus/,
  ],
  google: [
    /gemini-2\.5-flash$/,
    /gemini-2\.0-flash$/,
    /gemini-\d(\.\d)?-flash$/,
    /flash-lite$/,
    /gemini-\d(\.\d)?-pro$/,
    /gemini.*flash/,
    /gemini/,
    /gemma/,
  ],
  groq: [/llama-3\.3-70b/, /gpt-oss-120b/, /qwen/i, /gpt-oss/, /kimi/i, /llama/],
  mistral: [
    /^mistral-small-latest$/,
    /^mistral-medium-latest$/,
    /^mistral-large-latest$/,
    /^open-mistral-nemo/,
    /latest$/,
  ],
  deepseek: [/deepseek-chat/, /deepseek-reasoner/],
  openrouter: [
    /(gpt-4o-mini|gpt-4\.1-mini|gemini-2\.5-flash|claude-.*haiku|deepseek-chat|llama-3\.3-70b)/,
    /:free$/,
  ],
  together: [/Llama-3\.3-70B-Instruct-Turbo/, /Qwen.*Instruct/, /DeepSeek-V3/, /Instruct/],
};

const SNAPSHOT = /-(\d{4}-\d{2}-\d{2}|\d{8}|\d{4}|\d{3})$|-preview(-\d+)*$|-exp(-\d+)*$/;

/**
 * Orders a key's models best-first and drops dated copies of a model that is
 * also listed under its plain name (gpt-4o-2024-08-06 when gpt-4o exists).
 */
export function rankModels(provider: AiProviderId, models: AiModelInfo[]): AiModelInfo[] {
  const ids = new Set(models.map((m) => m.id));
  const kept = models.filter((m) => {
    const base = m.id.replace(SNAPSHOT, '');
    return base === m.id || !ids.has(base);
  });
  const prefs = PREFERRED[provider] ?? [];
  const score = (id: string) => {
    const short = id.replace(/^models\//, '');
    const i = prefs.findIndex((r) => r.test(short));
    return (i < 0 ? prefs.length : i) * 2 + (SNAPSHOT.test(short) ? 1 : 0);
  };
  return [...kept].sort((a, b) => score(a.id) - score(b.id) || a.id.localeCompare(b.id));
}

export function prettyModel(id: string) {
  return (
    id
      .replace(/^models\//, '')
      .split('/')
      .pop() ?? id
  );
}

export interface ProbeResult {
  working: AiModelInfo[];
  failed: { id: string; error: AiError }[];
}

/**
 * Sends a tiny test message to each model (a few at a time) and keeps the
 * ones that answer. This is how we know a model really works with this key.
 */
export async function probeModels(
  target: Omit<ChatTarget, 'model'>,
  models: AiModelInfo[],
  { concurrency = 4, timeoutMs = 20_000, stopAfter = Infinity } = {},
): Promise<ProbeResult> {
  const working: AiModelInfo[] = [];
  const failed: ProbeResult['failed'] = [];
  const results = new Map<string, boolean>();
  let next = 0;
  const worker = async () => {
    while (next < models.length && working.length < stopAfter) {
      const m = models[next++]!;
      try {
        await chat({ ...target, model: m.id }, [{ role: 'user', content: 'Reply with: OK' }], {
          maxTokens: 300,
          timeoutMs,
        });
        results.set(m.id, true);
        working.push(m);
      } catch (err) {
        const e = err instanceof AiError ? err : new AiError('unavailable');
        // Reachable and allowed, it just said nothing useful to "OK": that still works.
        if (e.code === 'invalid_output') {
          results.set(m.id, true);
          working.push(m);
        } else failed.push({ id: m.id, error: e });
      }
      // A rejected key fails every model the same way: no need to keep trying.
      if (failed.some((f) => f.error.code === 'auth')) return;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, models.length) }, worker));
  // Keep the ranking order, whatever order the answers arrived in.
  const order = new Map(models.map((m, i) => [m.id, i]));
  working.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { working, failed };
}

/** The most useful single reason when nothing worked. */
export function mainFailure(failed: ProbeResult['failed']): AiError {
  const rank: AiErrorCode[] = [
    'auth',
    'no_credit',
    'quota',
    'rate_limited',
    'timeout',
    'bad_model',
    'unavailable',
  ];
  return (
    [...failed].sort((a, b) => rank.indexOf(a.error.code) - rank.indexOf(b.error.code))[0]?.error ??
    new AiError('bad_model')
  );
}

/** Speech to text. HF Inference takes raw audio; OpenAI takes multipart. */
export async function transcribe(
  target:
    | { kind: 'huggingface'; token: string; model: string }
    | { kind: 'openai'; baseUrl: string; apiKey: string },
  audio: Buffer,
  mimeType: string,
  timeoutMs: number,
): Promise<string> {
  if (target.kind === 'huggingface') {
    const data = (await send(
      `https://router.huggingface.co/hf-inference/models/${target.model}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${target.token}`, 'content-type': mimeType },
        body: new Uint8Array(audio),
      },
      timeoutMs,
    )) as { text?: string };
    return (data.text ?? '').trim();
  }
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'speech.webm');
  form.append('model', 'whisper-1');
  const data = (await send(
    `${target.baseUrl}/audio/transcriptions`,
    { method: 'POST', headers: { authorization: `Bearer ${target.apiKey}` }, body: form },
    timeoutMs,
  )) as { text?: string };
  return (data.text ?? '').trim();
}
