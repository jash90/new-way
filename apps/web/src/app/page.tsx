import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full text-center">
        <h1 className="text-4xl font-bold mb-4">KsięgowaCRM</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Nowoczesny system CRM dla biur rachunkowych
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Zaloguj się
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Zarejestruj się
          </Link>
        </div>
      </div>
    </main>
  );
}
