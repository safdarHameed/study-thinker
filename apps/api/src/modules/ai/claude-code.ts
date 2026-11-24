/**
 * Local development only: answers through the `claude` CLI (Claude Code) on this
 * computer, signed in with the developer's own Claude Code account.
 *
 * Off unless CLAUDE_CODE_LOCAL=1, and never in production — it runs a process on
 * the server and spends one person's Claude Code allowance.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AiModelInfo } from '@studythinker/shared';
import { AiError, type ChatMessage, type ChatOptions } from './providers.js';

export function claudeCodeEnabled() {
  return process.env.CLAUDE_CODE_LOCAL === '1' && process.env.NODE_ENV !== 'production';
}

/** Claude Code's model aliases always point at the newest model of each tier. */
export const CLAUDE_CODE_MODELS: AiModelInfo[] = [
  { id: 'sonnet', label: 'Claude Sonnet (latest)' },
  { id: 'haiku', label: 'Claude Haiku (latest)' },
  { id: 'opus', label: 'Claude Opus (latest)' },
];

/** An empty folder to run in, so no project files or CLAUDE.md are read. */
function workDir() {
  const dir = join(tmpdir(), 'studythinker-claude-code');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The conversation as one prompt (the CLI takes a single message). */
function promptOf(messages: ChatMessage[]) {
  const turns = messages.filter((m) => m.role !== 'system');
  if (turns.length === 1) return turns[0]!.content;
  const last = turns.at(-1)!;
  const history = turns
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  return `The conversation so far:\n\n${history}\n\nThe user now says:\n\n${last.content}\n\nReply to that as the assistant (only your reply, no "Assistant:" prefix).`;
}

function errorOf(text: string): AiError {
  const t = text.slice(0, 300);
  if (/log ?in|logged in|auth|credential|token/i.test(text)) return new AiError('auth', t);
  if (/usage limit|limit reached|quota/i.test(text)) return new AiError('quota', t);
  if (/rate.?limit|overloaded|429/i.test(text)) return new AiError('rate_limited', t);
  if (/model/i.test(text) && /not (found|available|supported)|invalid/i.test(text))
    return new AiError('bad_model', t);
  return new AiError('unavailable', t);
}

export function claudeCodeChat(
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<string> {
  if (!claudeCodeEnabled())
    return Promise.reject(new AiError('not_configured', 'Claude Code (local) is turned off'));
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--model',
    model,
    '--tools',
    '',
    '--no-session-persistence',
    '--strict-mcp-config',
    ...(system ? ['--system-prompt', system] : []),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_CODE_BIN || 'claude', args, {
      cwd: workDir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let text = '';
    let result: { is_error?: boolean; result?: string; subtype?: string } | null = null;
    let stderr = '';
    let pending = '';
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(() => reject(new AiError('timeout')));
    }, opts.timeoutMs);

    const handle = (line: string) => {
      if (!line.trim()) return;
      let event: {
        type?: string;
        event?: { type?: string; delta?: { type?: string; text?: string } };
        is_error?: boolean;
        result?: string;
        subtype?: string;
      };
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (
        event.type === 'stream_event' &&
        event.event?.type === 'content_block_delta' &&
        event.event.delta?.type === 'text_delta' &&
        event.event.delta.text
      ) {
        text += event.event.delta.text;
        opts.onDelta?.(event.event.delta.text);
      } else if (event.type === 'result') result = event;
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      pending += chunk;
      let nl: number;
      while ((nl = pending.indexOf('\n')) !== -1) {
        handle(pending.slice(0, nl));
        pending = pending.slice(nl + 1);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => (stderr += chunk.slice(0, 2000)));
    child.on('error', (err: NodeJS.ErrnoException) =>
      finish(() =>
        reject(
          err.code === 'ENOENT'
            ? new AiError('unavailable', 'The `claude` command was not found on this computer')
            : new AiError('unavailable', err.message),
        ),
      ),
    );
    child.on('close', () => {
      if (pending) handle(pending);
      finish(() => {
        if (result?.is_error) return reject(errorOf(result.result ?? result.subtype ?? stderr));
        const answer = (text || result?.result || '').trim();
        if (!answer) return reject(stderr ? errorOf(stderr) : new AiError('invalid_output'));
        resolve(answer);
      });
    });
    child.stdin.end(promptOf(messages));
  });
}
