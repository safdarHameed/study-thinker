'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

/** Confirms a completed account deletion after the full-page redirect from Settings. */
export function AccountDeletedNotice() {
  const deleted = useSearchParams().get('account') === 'deleted';
  useEffect(() => {
    if (!deleted) return;
    toast.success('Your account and learning data have been deleted.');
    window.history.replaceState(null, '', '/');
  }, [deleted]);
  return null;
}
