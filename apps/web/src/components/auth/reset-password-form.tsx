'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { passwordResetSchema, type PasswordResetInput } from '@ksiegowacrm/shared';
import { cn } from '@/lib/utils';

type FormStep = 'validating' | 'form' | 'success' | 'error';

interface TokenError {
  type: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_USED' | 'UNKNOWN';
  message: string;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<FormStep>('validating');
  const [tokenError, setTokenError] = useState<TokenError | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<PasswordResetInput>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      token: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Validate token on mount
  const validateTokenQuery = trpc.aim.passwordReset.validateToken.useQuery(
    { token: token || '' },
    {
      enabled: !!token && token.length === 64,
      retry: false,
    }
  );

  // Reset password mutation
  const resetPasswordMutation = trpc.aim.passwordReset.reset.useMutation({
    onSuccess: () => {
      setStep('success');
    },
    onError: (error) => {
      // Handle specific errors
      const message = error.message;
      if (message.includes('używane wcześniej')) {
        // Password was used before - show specific error
        // Form will display the error message
      }
    },
  });

  // Handle token validation result
  useEffect(() => {
    if (!token) {
      setTokenError({
        type: 'TOKEN_INVALID',
        message: 'Brak tokenu resetowania hasła w adresie URL.',
      });
      setStep('error');
      return;
    }

    if (token.length !== 64) {
      setTokenError({
        type: 'TOKEN_INVALID',
        message: 'Nieprawidłowy format tokenu resetowania hasła.',
      });
      setStep('error');
      return;
    }

    if (validateTokenQuery.isSuccess) {
      if (validateTokenQuery.data.valid) {
        setValue('token', token);
        setStep('form');
      } else {
        const reason = validateTokenQuery.data.reason;
        switch (reason) {
          case 'TOKEN_EXPIRED':
            setTokenError({
              type: 'TOKEN_EXPIRED',
              message: 'Token resetowania hasła wygasł. Poproś o nowy link.',
            });
            break;
          case 'TOKEN_USED':
            setTokenError({
              type: 'TOKEN_USED',
              message: 'Ten token został już użyty. Poproś o nowy link.',
            });
            break;
          default:
            setTokenError({
              type: 'TOKEN_INVALID',
              message: 'Nieprawidłowy token resetowania hasła.',
            });
        }
        setStep('error');
      }
    }

    if (validateTokenQuery.isError) {
      setTokenError({
        type: 'UNKNOWN',
        message: 'Wystąpił błąd podczas weryfikacji tokenu.',
      });
      setStep('error');
    }
  }, [token, validateTokenQuery.isSuccess, validateTokenQuery.isError, validateTokenQuery.data, setValue]);

  const onSubmit = async (data: PasswordResetInput) => {
    await resetPasswordMutation.mutateAsync(data);
  };

  // Validating state
  if (step === 'validating') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <h2 className="text-lg font-semibold mb-2">Weryfikacja tokenu</h2>
        <p className="text-sm text-muted-foreground">
          Sprawdzamy ważność linku resetowania hasła...
        </p>
      </div>
    );
  }

  // Error state
  if (step === 'error' && tokenError) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 text-5xl mb-4">❌</div>
        <h2 className="text-xl font-semibold mb-2">Błąd weryfikacji</h2>
        <p className="text-muted-foreground mb-6">{tokenError.message}</p>
        <a
          href="/forgot-password"
          className="inline-block py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          Poproś o nowy link
        </a>
        <div className="mt-4">
          <a
            href="/login"
            className="text-sm text-muted-foreground hover:underline"
          >
            Wróć do logowania
          </a>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="text-center py-8">
        <div className="text-green-500 text-5xl mb-4">✓</div>
        <h2 className="text-xl font-semibold mb-2">Hasło zostało zmienione</h2>
        <p className="text-muted-foreground mb-6">
          Twoje hasło zostało pomyślnie zresetowane.
          Możesz teraz zalogować się przy użyciu nowego hasła.
        </p>
        <a
          href="/login"
          className="inline-block py-3 px-6 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          Przejdź do logowania
        </a>
      </div>
    );
  }

  // Form state
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register('token')} />

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Nowe hasło
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className={cn(
            'w-full px-3 py-2 border rounded-md bg-background',
            errors.password && 'border-destructive'
          )}
        />
        {errors.password && (
          <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Min. 12 znaków, wielka i mała litera, cyfra, znak specjalny
        </p>
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
          Potwierdź nowe hasło
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className={cn(
            'w-full px-3 py-2 border rounded-md bg-background',
            errors.confirmPassword && 'border-destructive'
          )}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Error message */}
      {resetPasswordMutation.error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{resetPasswordMutation.error.message}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting || resetPasswordMutation.isPending}
        className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {resetPasswordMutation.isPending ? 'Resetowanie...' : 'Ustaw nowe hasło'}
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
