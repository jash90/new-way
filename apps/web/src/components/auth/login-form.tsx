'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  loginInputSchema,
  mfaVerificationSchema,
  backupCodeVerificationSchema,
  type LoginInput,
  type MfaVerificationInput,
  type BackupCodeVerificationInput,
} from '@ksiegowacrm/shared';
import { cn } from '@/lib/utils';

type LoginStep = 'credentials' | 'mfa' | 'backup-code';

interface MfaState {
  challengeId: string;
  userId: string;
}

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);

  // Login form
  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // MFA form
  const mfaForm = useForm<MfaVerificationInput>({
    resolver: zodResolver(mfaVerificationSchema),
    defaultValues: {
      code: '',
      challengeId: '',
    },
  });

  // Backup code form
  const backupCodeForm = useForm<BackupCodeVerificationInput>({
    resolver: zodResolver(backupCodeVerificationSchema),
    defaultValues: {
      code: '',
      challengeId: '',
    },
  });

  // Login mutation
  const loginMutation = trpc.aim.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.mfaRequired) {
        // MFA required - challengeId will be present
        const challengeId = 'mfaChallengeId' in data ? data.mfaChallengeId : '';
        if (challengeId) {
          setMfaState({
            challengeId,
            userId: data.userId,
          });
          mfaForm.setValue('challengeId', challengeId);
          backupCodeForm.setValue('challengeId', challengeId);
          setStep('mfa');
        }
      } else {
        // Login successful without MFA
        handleLoginSuccess(data);
      }
    },
  });

  // MFA verification mutation
  const mfaMutation = trpc.aim.auth.verifyMfa.useMutation({
    onSuccess: (data) => {
      handleLoginSuccess(data);
    },
  });

  // Backup code mutation
  const backupCodeMutation = trpc.aim.auth.verifyBackupCode.useMutation({
    onSuccess: (data) => {
      handleLoginSuccess(data);
    },
  });

  const handleLoginSuccess = (data: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }) => {
    // Store tokens (in production, use httpOnly cookies or secure storage)
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('sessionId', data.sessionId);
    }
    // Redirect to dashboard
    router.push('/dashboard');
  };

  const onLoginSubmit = async (data: LoginInput) => {
    await loginMutation.mutateAsync(data);
  };

  const onMfaSubmit = async (data: MfaVerificationInput) => {
    await mfaMutation.mutateAsync(data);
  };

  const onBackupCodeSubmit = async (data: BackupCodeVerificationInput) => {
    await backupCodeMutation.mutateAsync(data);
  };

  const switchToBackupCode = () => {
    setUseBackupCode(true);
    setStep('backup-code');
    backupCodeForm.setValue('challengeId', mfaState?.challengeId || '');
  };

  const switchToMfa = () => {
    setUseBackupCode(false);
    setStep('mfa');
  };

  const resetLogin = () => {
    setStep('credentials');
    setMfaState(null);
    setUseBackupCode(false);
    loginForm.reset();
    mfaForm.reset();
    backupCodeForm.reset();
  };

  // Credentials step
  if (step === 'credentials') {
    return (
      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Adres email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...loginForm.register('email')}
            className={cn(
              'w-full px-3 py-2 border rounded-md bg-background',
              loginForm.formState.errors.email && 'border-destructive'
            )}
          />
          {loginForm.formState.errors.email && (
            <p className="text-sm text-destructive mt-1">
              {loginForm.formState.errors.email.message}
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
            autoComplete="current-password"
            {...loginForm.register('password')}
            className={cn(
              'w-full px-3 py-2 border rounded-md bg-background',
              loginForm.formState.errors.password && 'border-destructive'
            )}
          />
          {loginForm.formState.errors.password && (
            <p className="text-sm text-destructive mt-1">
              {loginForm.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...loginForm.register('rememberMe')}
            />
            <span className="text-sm">Zapamiętaj mnie</span>
          </label>
          <a
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Zapomniałeś hasła?
          </a>
        </div>

        {/* Error message */}
        {loginMutation.error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{loginMutation.error.message}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loginForm.formState.isSubmitting || loginMutation.isPending}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loginMutation.isPending ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>
    );
  }

  // MFA step
  if (step === 'mfa') {
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="text-lg font-semibold">Weryfikacja dwuetapowa</h2>
          <p className="text-sm text-muted-foreground">
            Wprowadź kod z aplikacji uwierzytelniającej
          </p>
        </div>

        <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-4">
          <div>
            <label htmlFor="mfaCode" className="block text-sm font-medium mb-1">
              Kod weryfikacyjny
            </label>
            <input
              id="mfaCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              {...mfaForm.register('code')}
              className={cn(
                'w-full px-3 py-2 border rounded-md bg-background text-center text-2xl tracking-widest',
                mfaForm.formState.errors.code && 'border-destructive'
              )}
            />
            {mfaForm.formState.errors.code && (
              <p className="text-sm text-destructive mt-1">
                {mfaForm.formState.errors.code.message}
              </p>
            )}
          </div>

          {/* Error message */}
          {mfaMutation.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{mfaMutation.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={mfaForm.formState.isSubmitting || mfaMutation.isPending}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mfaMutation.isPending ? 'Weryfikacja...' : 'Zweryfikuj'}
          </button>
        </form>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={switchToBackupCode}
            className="text-sm text-primary hover:underline"
          >
            Użyj kodu zapasowego
          </button>
          <br />
          <button
            type="button"
            onClick={resetLogin}
            className="text-sm text-muted-foreground hover:underline"
          >
            Wróć do logowania
          </button>
        </div>
      </div>
    );
  }

  // Backup code step
  if (step === 'backup-code') {
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🔑</div>
          <h2 className="text-lg font-semibold">Kod zapasowy</h2>
          <p className="text-sm text-muted-foreground">
            Wprowadź jeden z kodów zapasowych
          </p>
        </div>

        <form onSubmit={backupCodeForm.handleSubmit(onBackupCodeSubmit)} className="space-y-4">
          <div>
            <label htmlFor="backupCode" className="block text-sm font-medium mb-1">
              Kod zapasowy
            </label>
            <input
              id="backupCode"
              type="text"
              maxLength={8}
              placeholder="XXXXXXXX"
              {...backupCodeForm.register('code')}
              className={cn(
                'w-full px-3 py-2 border rounded-md bg-background text-center text-xl tracking-widest uppercase',
                backupCodeForm.formState.errors.code && 'border-destructive'
              )}
            />
            {backupCodeForm.formState.errors.code && (
              <p className="text-sm text-destructive mt-1">
                {backupCodeForm.formState.errors.code.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Uwaga: każdy kod zapasowy można użyć tylko raz
            </p>
          </div>

          {/* Error message */}
          {backupCodeMutation.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{backupCodeMutation.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={backupCodeForm.formState.isSubmitting || backupCodeMutation.isPending}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {backupCodeMutation.isPending ? 'Weryfikacja...' : 'Użyj kodu'}
          </button>
        </form>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={switchToMfa}
            className="text-sm text-primary hover:underline"
          >
            Wróć do kodu TOTP
          </button>
          <br />
          <button
            type="button"
            onClick={resetLogin}
            className="text-sm text-muted-foreground hover:underline"
          >
            Wróć do logowania
          </button>
        </div>
      </div>
    );
  }

  return null;
}
