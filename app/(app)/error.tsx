"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Error boundary del área privada. Un fallo al renderizar una página (p. ej.
 * datos corruptos en /progreso) se contiene aquí en vez de tumbar toda la app:
 * la barra de navegación sigue viva y el usuario puede reintentar o cambiar de
 * sección.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Error en sección:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Card className="flex max-w-sm flex-col items-center gap-4 p-8">
        <div className="grid size-14 place-items-center rounded-full bg-warning-wash">
          <AlertTriangle className="size-7 text-warning" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Esta sección falló</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            No pudimos mostrar esta pantalla. Tus datos están a salvo. Reintenta o
            cambia de sección desde el menú.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-[0.7rem] text-muted-foreground/60">ref: {error.digest}</p>
          )}
        </div>
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="size-4" /> Reintentar
        </Button>
      </Card>
    </div>
  );
}
