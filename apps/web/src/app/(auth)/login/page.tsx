import { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Logowanie - KsięgowaCRM',
  description: 'Zaloguj się do systemu KsięgowaCRM',
};

export default function LoginPage() {
  return (
    <div className="bg-card rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Zaloguj się</h1>
        <p className="text-muted-foreground mt-2">
          Wprowadź swoje dane, aby uzyskać dostęp
        </p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Nie masz konta?{' '}
        <Link href="/register" className="text-primary hover:underline font-medium">
          Zarejestruj się
        </Link>
      </p>
    </div>
  );
}
