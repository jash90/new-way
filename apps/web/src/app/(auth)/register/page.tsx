import { Metadata } from 'next';
import { RegistrationForm } from '@/components/auth/registration-form';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Rejestracja - KsięgowaCRM',
  description: 'Utwórz konto w systemie KsięgowaCRM',
};

export default function RegisterPage() {
  return (
    <div className="bg-card rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Utwórz konto</h1>
        <p className="text-muted-foreground mt-2">
          Zarejestruj się, aby rozpocząć korzystanie z systemu
        </p>
      </div>

      <RegistrationForm />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Masz już konto?{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Zaloguj się
        </Link>
      </p>
    </div>
  );
}
