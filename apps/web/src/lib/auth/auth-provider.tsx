'use client';

import type { AuthSession, AuthUser, LoginInput, RegisterInput } from '@studythinker/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiClient, isApiError, onSessionChange } from '@/lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'offline';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login(input: LoginInput): Promise<AuthUser>;
  register(input: RegisterInput): Promise<AuthUser>;
  logout(): Promise<void>;
  /** Retry restoring the session (e.g. after the API was unreachable). */
  retry(): void;
  /** Merge server-confirmed changes into the current user (e.g. a new display name). */
  updateUser(patch: Partial<AuthUser>): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attempt, setAttempt] = useState(0);

  const applySession = useCallback((session: AuthSession | null) => {
    if (session) {
      apiClient.setAccessToken(session.tokens.accessToken);
      setUser(session.user);
      setStatus('authenticated');
    } else {
      apiClient.setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => onSessionChange(applySession), [applySession]);

  // Restore the session from the httpOnly refresh cookie on load.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .refresh()
      .then((session) => {
        if (!cancelled) applySession(session);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isApiError(error) && (error.isNetworkError || error.status >= 500)) {
          setStatus('offline');
        } else {
          applySession(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applySession, attempt]);

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await api.auth.login(input);
      queryClient.clear();
      applySession(session);
      return session.user;
    },
    [applySession, queryClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await api.auth.register(input);
      queryClient.clear();
      applySession(session);
      return session.user;
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Signing out locally is still the right outcome if the API call fails.
    }
    applySession(null);
    queryClient.clear();
  }, [applySession, queryClient]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, retry, updateUser }),
    [status, user, login, register, logout, retry, updateUser],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
