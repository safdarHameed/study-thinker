import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { RedirectIfAuthenticated } from '@/components/auth/auth-redirect';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Create your account' };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Start learning with AI in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-zinc-950 underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <RedirectIfAuthenticated />
      <RegisterForm />
    </AuthCard>
  );
}
