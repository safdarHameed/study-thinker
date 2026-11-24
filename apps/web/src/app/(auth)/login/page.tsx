import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { RedirectIfAuthenticated } from '@/components/auth/auth-redirect';
import { LoginForm } from '@/components/auth/login-form';
import { LoadingState } from '@/components/common/loading-state';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Log in to keep learning."
      footer={
        <>
          New to StudyThinker?{' '}
          <Link
            href="/register"
            className="font-medium text-zinc-950 underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <RedirectIfAuthenticated />
      {/* The form reads `?next=` (runtime URL data), so it streams in behind Suspense. */}
      <Suspense fallback={<LoadingState label="Preparing sign in…" className="py-10" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
