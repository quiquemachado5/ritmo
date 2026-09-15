import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-8">
      <div className="max-w-md text-center">
        <div className="mb-4">
          <span className="font-display text-7xl font-bold text-muted-foreground/40">404</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida. Vuelve al inicio para continuar.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="size-4" /> Ir al inicio
          </Link>
        </Button>
        <Button asChild variant="secondary" className="gap-2">
          <Link href="/login">
            <Search className="size-4" /> Iniciar sesión
          </Link>
        </Button>
      </div>
    </main>
  );
}
