'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@studythinker/shared';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Field, FormError } from '@/components/forms/field';
import { Spinner } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { describeError, isApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-provider';
import { safeNextPath } from './auth-redirect';
import { PasswordInput } from './password-input';

export function loginErrorMessage(error: unknown): string {
  if (isApiError(error) && (error.isUnauthenticated || error.code === 'UNAUTHENTICATED')) {
    return 'That email and password don’t match. Please check them and try again.';
  }
  const { title, description } = describeError(error);
  return `${title}. ${description}`;
}

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      reset(); // don't keep the password in a hidden, cached page
      const next = safeNextPath(searchParams.get('next'));
      router.replace(next ?? '/learnings');
    } catch (error) {
      setFormError(loginErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={formError} />
      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          {...register('email')}
        />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" {...register('password')} />
      </Field>
      <div className="-mt-2 text-right">
        <Link
          href="/forgot-password"
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline"
        >
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Spinner className="size-4 border-primary-foreground/30 border-t-primary-foreground" />
            Logging you in…
          </>
        ) : (
          <>
            Log in
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
