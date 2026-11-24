import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { claudeCodeEnabled } from './claude-code.js';
import { KeyVault, keyHint } from './crypto.js';
import { extractJson, parseWith } from './json.js';
import {
  AiError,
  chat,
  listModels,
  mainFailure,
  probeModels,
  rankModels,
  stripThinking,
} from './providers.js';

describe('KeyVault', () => {
  it('round-trips and never stores the key in clear text', () => {
    const vault = new KeyVault('x'.repeat(40));
    const stored = vault.encrypt('sk-secret-123');
    expect(stored).not.toContain('sk-secret');
    expect(vault.decrypt(stored)).toBe('sk-secret-123');
    expect(keyHint('sk-secret-123')).toBe('…-123');
  });

  it('refuses tampered or foreign ciphertext', () => {
    const stored = new KeyVault('a'.repeat(40)).encrypt('key');
    expect(() => new KeyVault('b'.repeat(40)).decrypt(stored)).toThrow();
    const parts = stored.split('.');
    const data = Buffer.from(parts[3]!, 'base64url');
    data[0]! ^= 1;
    parts[3] = data.toString('base64url');
    expect(() => new KeyVault('a'.repeat(40)).decrypt(parts.join('.'))).toThrow();
  });
});

describe('JSON from model answers', () => {
  it('finds the object inside fences or prose', () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here: {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
    expect(() => extractJson('no json')).toThrow();
  });

  it('reports validation problems for a repair prompt', () => {
    const r = parseWith(z.object({ n: z.number() }), '{"n":"x"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('n');
  });

  it('removes reasoning blocks', () => {
    expect(stripThinking('<think>hmm</think>\nAnswer')).toBe('Answer');
  });
});

describe('providers', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it('speaks the OpenAI protocol to compatible providers', async () => {
    const fetchMock = respond(200, { choices: [{ message: { content: 'hi' } }] });
    vi.stubGlobal('fetch', fetchMock);
    const out = await chat(
      {
        provider: 'huggingface',
        baseUrl: 'https://router.huggingface.co/v1',
        apiKey: 'hf_x',
        model: 'm',
      },
      [{ role: 'user', content: 'hello' }],
      { timeoutMs: 1000, maxTokens: 10 },
    );
    expect(out).toBe('hi');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://router.huggingface.co/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer hf_x');
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'm', max_tokens: 10 });
  });

  it('uses the Messages API for Anthropic', async () => {
    const fetchMock = respond(200, { content: [{ type: 'text', text: 'ok' }] });
    vi.stubGlobal('fetch', fetchMock);
    await chat(
      {
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-ant',
        model: 'claude',
      },
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      { timeoutMs: 1000 },
    );
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe('sys');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('never sends temperature to current Claude models, and lets them think', async () => {
    const fetchMock = respond(200, {
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: 'ok' },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    const target = {
      provider: 'anthropic' as const,
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-ant',
      model: 'claude-sonnet-5-5',
    };
    const text = await chat(target, [{ role: 'user', content: 'hi' }], {
      timeoutMs: 1000,
      maxTokens: 500,
      temperature: 0.7,
    });
    expect(text).toBe('ok'); // the thinking block is not part of the answer
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.temperature).toBeUndefined();
    expect(body.output_config).toEqual({ effort: 'low' });
    expect(body.max_tokens).toBe(4500);
    // Older Claude models still take a temperature.
    await chat({ ...target, model: 'claude-haiku-4-5' }, [{ role: 'user', content: 'hi' }], {
      timeoutMs: 1000,
      maxTokens: 500,
      temperature: 0.7,
    });
    const old = JSON.parse(
      (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(old.temperature).toBe(0.7);
    expect(old.output_config).toBeUndefined();
  });

  it('ranks the current Claude models first', () => {
    const ids = [
      'claude-3-haiku',
      'claude-opus-5-5',
      'claude-haiku-5-5',
      'claude-sonnet-4-6',
      'claude-sonnet-5-5',
    ];
    expect(
      rankModels(
        'anthropic',
        ids.map((id) => ({ id, label: id })),
      ).map((m) => m.id),
    ).toEqual([
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
      'claude-opus-5-5',
      'claude-sonnet-4-6',
      'claude-3-haiku',
    ]);
  });

  it('turns HTTP failures into learner-friendly errors', async () => {
    vi.stubGlobal('fetch', respond(401, { error: 'bad' }));
    await expect(
      chat({ provider: 'openai', baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' }, [], {
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ code: 'auth' });
    vi.stubGlobal('fetch', respond(402, { error: 'Insufficient credits' }));
    await expect(
      chat({ provider: 'openai', baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' }, [], {
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(AiError);
  });

  it('tells a used-up quota apart from missing credit, and retries an overloaded model once', async () => {
    const target = {
      provider: 'google' as const,
      baseUrl: 'https://x/v1',
      apiKey: 'k',
      model: 'm',
    };
    vi.stubGlobal('fetch', respond(429, { error: { message: 'You exceeded your current quota' } }));
    await expect(chat(target, [], { timeoutMs: 1000 })).rejects.toMatchObject({ code: 'quota' });
    vi.stubGlobal('fetch', respond(402, { error: 'Insufficient credits' }));
    await expect(chat(target, [], { timeoutMs: 1000 })).rejects.toMatchObject({
      code: 'no_credit',
    });
    const flaky = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"overloaded"}', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', flaky);
    await expect(chat(target, [], { timeoutMs: 5000 })).resolves.toBe('ok');
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it('lists chat models only', async () => {
    vi.stubGlobal(
      'fetch',
      respond(200, { data: [{ id: 'gpt-x' }, { id: 'text-embedding-3' }, { id: 'whisper-1' }] }),
    );
    expect(await listModels('openai', 'https://x/v1', 'k')).toEqual([
      { id: 'gpt-x', label: 'gpt-x' },
    ]);
  });
});

describe('ThinkFilter', () => {
  it('hides reasoning blocks even when tags are split across pieces', async () => {
    const { ThinkFilter } = await import('./providers.js');
    const f = new ThinkFilter();
    const out = ['Hi <th', 'ink>secret', ' stuff</thi', 'nk> there', ' <', 'b>'].map((p) =>
      f.push(p),
    );
    expect(out.join('') + f.flush()).toBe('Hi  there <b>');
  });
});

describe('choosing models that really work', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ranks good all-rounders first and drops dated copies and non-chat models', async () => {
    const ids = [
      'gpt-4o-2024-08-06',
      'gpt-4o',
      'o1-pro',
      'gpt-4.1-mini',
      'gpt-image-1',
      'gpt-4o-mini-tts',
      'gpt-4.1',
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }))),
    );
    const listed = await listModels('openai', 'https://x/v1', 'k');
    expect(rankModels('openai', listed).map((m) => m.id)).toEqual([
      'gpt-4.1-mini',
      'gpt-4.1',
      'gpt-4o',
    ]);
    expect(
      rankModels('google', [
        { id: 'models/gemini-2.5-pro', label: '' },
        { id: 'models/gemini-2.5-flash', label: '' },
      ])[0]!.id,
    ).toBe('models/gemini-2.5-flash');
  });

  it('keeps only models that answer a test message, in ranked order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const { model } = JSON.parse(init.body as string) as { model: string };
        if (model === 'gone') return new Response('{"error":"model not found"}', { status: 404 });
        if (model === 'slow') await new Promise((r) => setTimeout(r, 30));
        return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
      }),
    );
    const target = { provider: 'openai' as const, baseUrl: 'https://x/v1', apiKey: 'k' };
    const r = await probeModels(
      target,
      ['slow', 'gone', 'fast'].map((id) => ({ id, label: id })),
    );
    expect(r.working.map((m) => m.id)).toEqual(['slow', 'fast']);
    expect(r.failed.map((f) => [f.id, f.error.code])).toEqual([['gone', 'bad_model']]);
  });

  it('explains the most useful reason when nothing works', () => {
    expect(
      mainFailure([
        { id: 'a', error: new AiError('bad_model') },
        { id: 'b', error: new AiError('quota') },
      ]).code,
    ).toBe('quota');
  });
});

describe('Claude Code (local)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off unless CLAUDE_CODE_LOCAL=1, and never in production', async () => {
    vi.stubEnv('CLAUDE_CODE_LOCAL', '');
    await expect(listModels('claude-code', 'local', 'local')).rejects.toMatchObject({
      code: 'not_configured',
    });
    await expect(
      chat({ provider: 'claude-code', baseUrl: 'local', apiKey: 'local', model: 'haiku' }, [], {
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ code: 'not_configured' });
    vi.stubEnv('CLAUDE_CODE_LOCAL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    expect(claudeCodeEnabled()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    expect(claudeCodeEnabled()).toBe(true);
    expect((await listModels('claude-code', 'local', 'local')).map((m) => m.id)).toEqual([
      'sonnet',
      'haiku',
      'opus',
    ]);
  });
});
