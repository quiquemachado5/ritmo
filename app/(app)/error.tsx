"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { registrarDiagnostico } from "@/lib/observability";
import Link from "next/link";
import { errorCopy } from "@/lib/error-copy";

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
  const copy = errorCopy(error);
  React.useEffect(() => {
    console.error("Error en sección:", error);
    registrarDiagnostico("ui", "error", "fallo contenido en una sección");
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Card className="flex max-w-sm flex-col items-center gap-4 p-8">
        <div className="grid size-14 place-items-center rounded-full bg-warning-wash">
          <AlertTriangle className="size-7 text-warning" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">{copy.title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{copy.detail}</p>
          {error.digest && (
            <p className="mt-2 font-mono text-[0.7rem] text-muted-foreground/60">ref: {error.digest}</p>
          )}
        </div>
        {copy.kind === "session" ? <Button asChild><Link href="/login">{copy.action}</Link></Button> : copy.kind === "sync" ? <Button asChild><Link href="/ajustes?panel=datos#sincronizacion">{copy.action}</Link></Button> : <Button onClick={reset} className="gap-2"><RefreshCw className="size-4" /> {copy.action}</Button>}
      </Card>
    </div>
  );
}
