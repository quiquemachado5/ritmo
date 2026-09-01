'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { registrarDiagnostico } from '@/lib/observability';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error:', error);
    registrarDiagnostico('ui', 'error', 'fallo global de interfaz');
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Encontramos un error inesperado. Intenta recargar la página o vuelve al inicio.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground/60">
            Código: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset} variant="secondary" className="gap-2">
          <RefreshCw className="size-4" /> Reintentar
        </Button>
        <Link href="/">
          <Button className="gap-2">
            <Home className="size-4" /> Ir al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
