import { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Zapomniałeś hasła? - KsięgowaCRM',
  description: 'Zresetuj hasło do swojego konta KsięgowaCRM',
};

export default function ForgotPasswordPage() {
  return (
    <div className="bg-card rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Zresetuj hasło</h1>
        <p className="text-muted-foreground mt-2">
          Wyślemy Ci link do zresetowania hasła
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Pamiętasz hasło?{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Zaloguj się
        </Link>
      </p>
    </div>
  );
}
