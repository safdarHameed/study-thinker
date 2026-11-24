import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/password-forms';

export const metadata: Metadata = { title: 'Forgot your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we’ll create a reset link."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
