'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'lw-theme';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme(theme: ThemePreference): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Storage can be unavailable (private mode); fall back to system.
  }
  return 'system';
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    // Sync from storage + media query after hydration (the inline script already painted it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readStoredTheme());
    setSystemDark(systemPrefersDark());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Runs before first paint (inlined in <head>) so theme and accessibility
 * preferences never flash. Mirrors `applyTheme` and `applyAccessibility`.
 */
export const PREFERENCES_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('${STORAGE_KEY}')||'system';var k=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('dark',k);d.style.colorScheme=k?'dark':'light';var a=JSON.parse(localStorage.getItem('lw-a11y')||'null');if(a){if(a.highContrast)d.dataset.contrast='high';if(a.dyslexiaFriendlyFont)d.dataset.font='readable';if(a.reducedMotion)d.dataset.motion='reduced';if(a.fontScale)d.style.setProperty('--font-scale',String(a.fontScale));}}catch(e){}})();`;
