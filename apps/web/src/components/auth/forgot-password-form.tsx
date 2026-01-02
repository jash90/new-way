'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trpc } from '@/lib/trpc';
import { passwordResetRequestSchema, type PasswordResetRequestInput } from '@ksiegowacrm/shared';
import { cn } from '@/lib/utils';

export function ForgotPasswordForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: {
      email: '',
    },
  });

  const requestResetMutation = trpc.aim.passwordReset.requestReset.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
    },
  });

  const onSubmit = async (data: PasswordResetRequestInput) => {
    await requestResetMutation.mutateAsync(data);
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <div className="text-green-500 text-5xl mb-4">✉️</div>
        <h2 className="text-xl font-semibold mb-2">Sprawdź swoją skrzynkę</h2>
        <p className="text-muted-foreground">
          Jeśli konto z tym adresem istnieje, wysłaliśmy link do resetowania hasła.
          Link jest ważny przez 1 godzinę.
        </p>
        <a
          href="/login"
          className="inline-block mt-6 text-primary hover:underline"
        >
          Wróć do logowania
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          Podaj adres email powiązany z Twoim kontem, a wyślemy Ci link do zresetowania hasła.
        </p>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Adres email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className={cn(
            'w-full px-3 py-2 border rounded-md bg-background',
            errors.email && 'border-destructive'
          )}
        />
        {errors.email && (
          <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
        )}
      </div>

      {/* Error message */}
      {requestResetMutation.error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{requestResetMutation.error.message}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting || requestResetMutation.isPending}
        className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {requestResetMutation.isPending ? 'Wysyłanie...' : 'Wyślij link resetowania'}
      </button>

      {/* Back to login */}
      <div className="text-center">
        <a
          href="/login"
          className="text-sm text-muted-foreground hover:underline"
        >
          Wróć do logowania
        </a>
      </div>
    </form>
  );
}
