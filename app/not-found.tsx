import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
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
        <Link href="/">
          <Button className="gap-2">
            <Home className="size-4" /> Ir al inicio
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary" className="gap-2">
            <Search className="size-4" /> Iniciar sesión
          </Button>
        </Link>
      </div>
    </div>
  );
}
