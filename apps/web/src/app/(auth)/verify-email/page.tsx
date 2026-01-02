'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const verifyMutation = trpc.aim.registration.verifyEmail.useMutation({
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message);
    },
    onError: (error) => {
      setStatus('error');
      setMessage(error.message);
    },
  });

  useEffect(() => {
    if (token) {
      verifyMutation.mutate({ token });
    } else {
      setStatus('error');
      setMessage('Brak tokenu weryfikacyjnego');
    }
  }, [token]);

  return (
    <div className="bg-card rounded-lg shadow-lg p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Weryfikacja email</h1>

      {status === 'loading' && (
        <div className="py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Weryfikowanie...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="py-8">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <p className="text-green-600 font-medium">{message}</p>
          <Link
            href="/login"
            className="inline-block mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
          >
            Przejdź do logowania
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="py-8">
          <div className="text-red-500 text-5xl mb-4">✗</div>
          <p className="text-red-600 font-medium">{message}</p>
          <Link
            href="/register"
            className="inline-block mt-6 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium"
          >
            Wróć do rejestracji
          </Link>
        </div>
      )}
    </div>
  );
}
