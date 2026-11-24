'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';

/** Only allow same-origin relative paths as post-login destinations. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return null;
  }
  return next;
}

/** Sends already signed-in learners away from the sign-in / sign-up pages. */
export function RedirectIfAuthenticated() {
  const { status, user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated' && user) {
      router.replace('/learnings');
    }
  }, [status, user, router]);
  return null;
}
