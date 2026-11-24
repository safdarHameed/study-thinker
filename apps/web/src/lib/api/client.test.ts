import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError, describeError } from './errors';

const session = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ada@example.com',
    displayName: 'Ada',
    role: 'LEARNER',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  tokens: {
    accessToken: 'fresh-token',
    accessTokenExpiresAt: '2026-01-01T00:15:00.000Z',
    refreshToken: 'refresh-token-value-123456',
    refreshTokenExpiresAt: '2026-02-01T00:00:00.000Z',
  },
};

function json(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('unwraps the { data } envelope and sends credentials + bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { data: { ok: true } }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });
    client.setAccessToken('abc');

    await expect(client.request('/v1/thing', { query: { a: 1, b: undefined } })).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/v1/thing?a=1');
    expect(init.credentials).toBe('include');
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('turns the { error } envelope into a typed ApiError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json(409, { error: { code: 'CONFLICT', message: 'Email taken', requestId: 'req-1' } }),
      );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    const error = await client
      .request('/v1/auth/register', { method: 'POST', auth: false })
      .catch((e: unknown) => e as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'CONFLICT', status: 409, requestId: 'req-1' });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    const error = await client.request<null>('/v1/dashboard').catch((e: unknown) => e as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetworkError).toBe(true);
    expect(describeError(error).title).toMatch(/can’t reach/i);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/refresh')) return json(200, { data: session });
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === 'Bearer fresh-token'
        ? json(200, { data: 'secret' })
        : json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } });
    });
    const onSession = vi.fn();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock, onSession });
    client.setAccessToken('stale-token');

    // Concurrent 401s must share a single refresh request.
    const results = await Promise.all([client.request('/v1/a'), client.request('/v1/b')]);
    expect(results).toEqual(['secret', 'secret']);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/v1/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(onSession).toHaveBeenCalledWith(session);
    expect(client.getAccessToken()).toBe('fresh-token');
  });

  it('signals auth failure when the refresh is rejected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(401, { error: { code: 'UNAUTHENTICATED', message: 'nope' } }));
    const onAuthFailure = vi.fn();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock, onAuthFailure });
    client.setAccessToken('stale');

    const error = await client.request<null>('/v1/goals').catch((e: unknown) => e as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isUnauthenticated).toBe(true);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(client.getAccessToken()).toBeNull();
  });

  it('returns undefined for 204 No Content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });
    await expect(client.request('/v1/goals/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
