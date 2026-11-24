'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  mql.addEventListener('change', onChange);
  return () => {
    mql.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches || document.documentElement.dataset.motion === 'reduced';
}

/** True when the OS or the learner's profile asks for reduced motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
