'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@studythinker/shared';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Field, FormError } from '@/components/forms/field';
import { Spinner } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { describeError, isApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-provider';
import { PasswordInput } from './password-input';
import { PasswordStrength } from './password-strength';

export function registerErrorMessage(error: unknown): string {
  if (isApiError(error) && (error.code === 'CONFLICT' || error.status === 409)) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  const { title, description } = describeError(error);
  return `${title}. ${description}`;
}

export function RegisterForm() {
  const { register: registerAccount } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerAccount(values);
      reset(); // don't keep the password in a hidden, cached page
      router.replace('/learnings');
    } catch (error) {
      setFormError(registerErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={formError} />
      <Field label="What should we call you?" error={errors.displayName?.message}>
        <Input autoComplete="name" placeholder="Your first name" {...register('displayName')} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          {...register('email')}
        />
      </Field>
      <div className="space-y-3">
        <Field label="Password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </Field>
        <PasswordStrength value={password ?? ''} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Spinner className="size-4 border-primary-foreground/30 border-t-primary-foreground" />
            Creating your account…
          </>
        ) : (
          <>
            Create account
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
