import type { StreamEvent } from '@studythinker/shared';
import { ApiError } from './errors';

export interface StreamHandlers {
  /** More of the answer, as it is written. */
  onDelta?: (text: string) => void;
  /** What the server is doing now, e.g. "Updating your journey…". */
  onStatus?: (text: string) => void;
}

interface StreamDeps {
  baseUrl: string;
  getToken: () => string | null;
  refresh: () => Promise<unknown>;
}

const STATUS_FOR: Record<string, number> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 400,
  AI_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
};

/**
 * POSTs and reads a server-sent-events answer, calling the handlers as it
 * arrives. Resolves with the final result; rejects with an ApiError.
 */
export async function streamPost<T>(
  deps: StreamDeps,
  path: string,
  body: unknown,
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
): Promise<T> {
  const send = () => {
    const token = deps.getToken();
    return fetch(`${deps.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
      credentials: 'include',
      signal,
    });
  };
  let res: Response;
  try {
    res = await send();
    if (res.status === 401) {
      await deps.refresh();
      res = await send();
    }
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the StudyThinker API',
    });
  }
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const json = (await res.json().catch(() => null)) as {
      data?: T;
      error?: { code: string; message: string; details?: unknown };
    } | null;
    if (res.ok && json && 'data' in json) return json.data as T;
    throw new ApiError({
      status: res.status,
      code: json?.error?.code ?? 'UNKNOWN',
      message: json?.error?.message ?? 'Request failed',
      details: json?.error?.details,
    });
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result: { value: T } | null = null;
  let failure: ApiError | null = null;
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return;
    let event: StreamEvent<T>;
    try {
      event = JSON.parse(line.slice(5).trim()) as StreamEvent<T>;
    } catch {
      return;
    }
    if (event.type === 'delta') handlers.onDelta?.(event.text);
    else if (event.type === 'status') handlers.onStatus?.(event.text);
    else if (event.type === 'done') result = { value: event.result };
    else if (event.type === 'error')
      failure = new ApiError({
        status: STATUS_FOR[event.error.code] ?? 500,
        code: event.error.code,
        message: event.error.message,
        details: event.error.details,
      });
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = pending.indexOf('\n')) !== -1) {
        handle(pending.slice(0, nl).replace(/\r$/, ''));
        pending = pending.slice(nl + 1);
      }
    }
    if (pending) handle(pending);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'The connection was lost' });
  }
  if (failure) throw failure;
  if (!result)
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'The answer was cut off. Please try again.',
    });
  return (result as { value: T }).value;
}
