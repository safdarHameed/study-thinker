import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/password-forms';
import { LoadingState } from '@/components/common/loading-state';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="Make it at least 10 characters.">
      <Suspense fallback={<LoadingState />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
