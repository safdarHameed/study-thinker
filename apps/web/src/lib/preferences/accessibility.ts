export interface AccessibilityPreferences {
  reducedMotion: boolean;
  dyslexiaFriendlyFont: boolean;
  highContrast: boolean;
  fontScale: number;
}

const STORAGE_KEY = 'lw-a11y';

export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  reducedMotion: false,
  dyslexiaFriendlyFont: false,
  highContrast: false,
  fontScale: 1,
};

/** Apply accessibility preferences app-wide via attributes/variables on <html>. */
export function applyAccessibility(prefs: Partial<AccessibilityPreferences> | null) {
  if (typeof document === 'undefined') return;
  const p = { ...DEFAULT_ACCESSIBILITY, ...(prefs ?? {}) };
  const root = document.documentElement;
  const toggle = (key: string, value: string | false) => {
    if (value) root.dataset[key] = value;
    else delete root.dataset[key];
  };
  toggle('contrast', p.highContrast && 'high');
  toggle('font', p.dyslexiaFriendlyFont && 'readable');
  toggle('motion', p.reducedMotion && 'reduced');
  root.style.setProperty('--font-scale', String(p.fontScale));
  try {
    if (prefs) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}
