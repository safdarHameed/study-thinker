'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, forgotPasswordSchema, passwordSchema } from '@studythinker/shared';
import { ArrowLeft, ArrowRight, MailCheck, ServerCog } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Spinner } from '@/components/common/loading-state';
import { Field, FormError } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { describeError } from '@/lib/api/errors';
import { PasswordInput } from './password-input';
import { PasswordStrength } from './password-strength';

const message = (e: unknown) => {
  const { title, description } = describeError(e);
  return `${title}. ${description}`;
};

export function ForgotPasswordForm() {
  const [sent, setSent] = useState<{ email: string; delivered: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), mode: 'onTouched' });

  const submit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      const res = await api.auth.forgotPassword(email);
      setSent({ email, delivered: res.emailDeliveryConfigured });
    } catch (e) {
      setError(message(e));
    }
  });

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4 rounded-2xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            {sent.delivered ? (
              <MailCheck className="size-5" aria-hidden />
            ) : (
              <ServerCog className="size-5" aria-hidden />
            )}
          </span>
          <div className="space-y-2 text-[0.95rem] leading-relaxed text-zinc-600">
            <p>
              If an account exists for{' '}
              <span className="font-medium text-zinc-950">{sent.email}</span>, a reset link{' '}
              {sent.delivered ? 'is on its way' : 'has been created'}. It works once and expires
              soon.
            </p>
            {!sent.delivered && (
              <p>
                This server can’t send email yet, so the link was written to the server’s log
                instead. Ask whoever runs your StudyThinker server to pass it on.
              </p>
            )}
          </div>
        </div>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/login">
            <ArrowLeft aria-hidden /> Back to log in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5">
      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register('email')}
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <Spinner className="size-4 border-primary-foreground/30 border-t-primary-foreground" />
        ) : null}
        Send reset link <ArrowRight aria-hidden />
      </Button>
      <p className="text-center text-sm text-zinc-500">
        Remembered it?{' '}
        <Link
          href="/login"
          className="font-medium text-zinc-950 underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}

const resetFormSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'The passwords don’t match',
  });

export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetFormSchema), mode: 'onTouched' });
  const password = useWatch({ control, name: 'password' }) ?? '';

  if (token.length < 20) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-zinc-600">
          This reset link is incomplete. Request a new one and try again.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  const submit = handleSubmit(async ({ password: pw }) => {
    setError(null);
    try {
      await api.auth.resetPassword({ token, password: pw });
      toast.success('Password updated. Log in with your new password.');
      router.replace('/login');
    } catch (e) {
      setError(message(e));
    }
  });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5">
      <Field label="New password" error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" {...register('password')} />
      </Field>
      <PasswordStrength value={password} />
      <Field label="Confirm new password" error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" {...register('confirm')} />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Set new password'}
      </Button>
      <p className="text-center text-sm text-zinc-500">
        For your security, this signs you out everywhere.
      </p>
    </form>
  );
}

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema), mode: 'onTouched' });
  const next = useWatch({ control, name: 'newPassword' }) ?? '';

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await api.auth.changePassword(values);
      reset({ currentPassword: '', newPassword: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (e) {
      setError(message(e));
    }
  });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="max-w-md space-y-4">
      <Field label="Current password" error={errors.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
      </Field>
      <Field label="New password" error={errors.newPassword?.message}>
        <PasswordInput autoComplete="new-password" {...register('newPassword')} />
      </Field>
      <PasswordStrength value={next} />
      <FormError message={error} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
