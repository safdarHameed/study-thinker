'use client';

import { useEffect, useState } from 'react';

/** Seconds since `since` (an ISO date or ms timestamp), ticking every second. */
export function useElapsed(since: string | number | null | undefined) {
  const start = since == null ? null : typeof since === 'number' ? since : Date.parse(since);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (start == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [start]);
  return start == null ? 0 : Math.max(0, Math.floor((now - start) / 1000));
}

export function formatSeconds(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
