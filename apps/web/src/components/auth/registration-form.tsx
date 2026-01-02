'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trpc } from '@/lib/trpc';
import { registrationInputSchema, type RegistrationInput } from '@ksiegowacrm/shared';
import { cn } from '@/lib/utils';

export function RegistrationForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationInputSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const registerMutation = trpc.aim.registration.register.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
    },
  });

  const email = watch('email');
  const checkEmailQuery = trpc.aim.registration.checkEmailAvailability.useQuery(
    { email },
    {
      enabled: email.length > 5 && email.includes('@'),
      staleTime: 30000,
    }
  );

  const onSubmit = async (data: RegistrationInput) => {
    await registerMutation.mutateAsync(data);
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <div className="text-green-500 text-5xl mb-4">✉️</div>
        <h2 className="text-xl font-semibold mb-2">Sprawdź swoją skrzynkę</h2>
        <p className="text-muted-foreground">
          Wysłaliśmy link weryfikacyjny na podany adres email.
          Kliknij w link, aby aktywować konto.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        {checkEmailQuery.data && !checkEmailQuery.data.available && (
          <p className="text-sm text-destructive mt-1">
            Ten adres email jest już zajęty
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Hasło
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
          Potwierdź hasło
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

      {/* Terms */}
      <div className="space-y-2">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('acceptTerms')}
            className="mt-1"
          />
          <span className="text-sm">
            Akceptuję{' '}
            <a href="/regulamin" className="text-primary hover:underline">
              regulamin
            </a>
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
        )}

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('acceptPrivacyPolicy')}
            className="mt-1"
          />
          <span className="text-sm">
            Akceptuję{' '}
            <a href="/polityka-prywatnosci" className="text-primary hover:underline">
              politykę prywatności
            </a>
          </span>
        </label>
        {errors.acceptPrivacyPolicy && (
          <p className="text-sm text-destructive">{errors.acceptPrivacyPolicy.message}</p>
        )}
      </div>

      {/* Error message */}
      {registerMutation.error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{registerMutation.error.message}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting || registerMutation.isPending}
        className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {registerMutation.isPending ? 'Rejestrowanie...' : 'Zarejestruj się'}
      </button>
    </form>
  );
}
