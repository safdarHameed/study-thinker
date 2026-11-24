import type { AuthSession } from '@studythinker/shared';
import { ApiError } from './errors';

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Attach the bearer token (default true). */
  auth?: boolean;
  /** Retry once after refreshing the session on a 401 (default true when `auth`). */
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Called after a successful refresh so the app can store the new session. */
  onSession?: (session: AuthSession) => void;
  /** Called when a refresh fails with 401, i.e. the user must sign in again. */
  onAuthFailure?: () => void;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  /** Refresh the session using the httpOnly refresh cookie. Concurrent calls share one request. */
  refresh(): Promise<AuthSession>;
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
}

function buildUrl(baseUrl: string, path: string, query?: Query) {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: Record<string, unknown> }).error;
    if (err && typeof err === 'object') {
      return new ApiError({
        status,
        code: typeof err.code === 'string' ? err.code : 'UNKNOWN',
        message: typeof err.message === 'string' ? err.message : 'Request failed',
        details: err.details,
        requestId: typeof err.requestId === 'string' ? err.requestId : undefined,
      });
    }
  }
  return new ApiError({
    status,
    code: status === 401 ? 'UNAUTHENTICATED' : status >= 500 ? 'INTERNAL' : 'UNKNOWN',
    message: `Request failed with status ${status}`,
  });
}

/**
 * Typed fetch client for the StudyThinker API.
 * - Unwraps `{ data }` envelopes and converts `{ error }` envelopes into `ApiError`.
 * - Keeps the access token in memory only.
 * - On 401, refreshes once (single-flight across concurrent requests) and retries.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let accessToken: string | null = null;
  let refreshInFlight: Promise<AuthSession> | null = null;

  async function send(path: string, opts: RequestOptions, token: string | null) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetchImpl(buildUrl(options.baseUrl, path, opts.query), {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        credentials: 'include',
        signal: opts.signal,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      throw new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the StudyThinker API',
        details: cause instanceof Error ? cause.message : undefined,
      });
    }
  }

  async function unwrap<T>(response: Response): Promise<T> {
    const body = await parseBody(response);
    if (!response.ok) throw toApiError(response.status, body);
    if (body && typeof body === 'object' && 'data' in body) {
      return (body as { data: T }).data;
    }
    return body as T;
  }

  function refresh(): Promise<AuthSession> {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const response = await send('/v1/auth/refresh', { method: 'POST' }, null);
        const session = await unwrap<AuthSession>(response);
        accessToken = session.tokens.accessToken;
        options.onSession?.(session);
        return session;
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const useAuth = opts.auth ?? true;
    const response = await send(path, opts, useAuth ? accessToken : null);

    if (response.status === 401 && useAuth && (opts.retryOnUnauthorized ?? true)) {
      try {
        await refresh();
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthenticated) {
          accessToken = null;
          options.onAuthFailure?.();
        }
        throw error;
      }
      const retried = await send(path, opts, accessToken);
      if (retried.status === 401) {
        accessToken = null;
        options.onAuthFailure?.();
      }
      return unwrap<T>(retried);
    }

    return unwrap<T>(response);
  }

  return {
    request,
    refresh,
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
  };
}
