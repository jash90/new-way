import { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Resetowanie hasła - KsięgowaCRM',
  description: 'Ustaw nowe hasło do swojego konta KsięgowaCRM',
};

function ResetPasswordContent() {
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <div className="bg-card rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Ustaw nowe hasło</h1>
        <p className="text-muted-foreground mt-2">
          Wprowadź nowe hasło dla swojego konta
        </p>
      </div>

      <Suspense
        fallback={
          <div className="text-center py-8">
            <div className="text-4xl mb-4 animate-spin">⏳</div>
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
