"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function ResetearPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetearForm />
    </React.Suspense>
  );
}

function ResetearForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [nuevaContrasena, setNuevaContrasena] = React.useState("");
  const [confirmar, setConfirmar] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exito, setExito] = React.useState(false);

  async function resetear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nuevaContrasena) {
      setError("Ingresa una nueva contraseña.");
      return;
    }
    if (nuevaContrasena.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaContrasena !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password: nuevaContrasena,
      });

      if (updateError) throw updateError;

      setExito(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "No se pudo resetear la contraseña. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-green-600" />
          <h1 className="font-display text-xl font-bold">¡Contraseña actualizada!</h1>
          <p className="text-sm text-muted-foreground">
            Tu contraseña ha sido cambiada exitosamente. Redirigiendo al login...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold">Resetear contraseña</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ingresa tu nueva contraseña.
      </p>
      <form onSubmit={resetear} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Nueva contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={nuevaContrasena}
            onChange={(e) => setNuevaContrasena(e.target.value)}
            placeholder="••••••••"
            disabled={cargando}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirmar contraseña</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="••••••••"
            disabled={cargando}
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button type="submit" disabled={cargando} className="gap-2">
          {cargando && <Loader2 className="size-4 animate-spin" />}
          {cargando ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </form>
    </Card>
  );
}
