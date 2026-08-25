"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { validatePassword, getPasswordStrength } from "@/lib/validation";
import { Check, X } from "lucide-react";

export default function ResetearPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetearForm />
    </React.Suspense>
  );
}

function ResetearForm() {
  const router = useRouter();
  const [nuevaContrasena, setNuevaContrasena] = React.useState("");
  const [confirmar, setConfirmar] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exito, setExito] = React.useState(false);
  const [passwordErrors, setPasswordErrors] = React.useState<string[]>([]);

  const passwordStrength = getPasswordStrength(nuevaContrasena);

  function handlePasswordChange(value: string) {
    setNuevaContrasena(value);
    if (value) {
      const validation = validatePassword(value);
      setPasswordErrors(validation.errors);
    } else {
      setPasswordErrors([]);
    }
  }

  async function resetear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nuevaContrasena) {
      setError("Ingresa una nueva contraseña.");
      return;
    }

    const passwordValidation = validatePassword(nuevaContrasena);
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0]);
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
      <Card className="p-8 border-0 shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <CheckCircle2 className="size-12 text-green-600" />
          <h1 className="font-display text-2xl font-bold">¡Contraseña actualizada!</h1>
          <p className="text-sm text-muted-foreground">
            Tu contraseña ha sido cambiada exitosamente. Redirigiendo al login...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Resetear contraseña</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tu nueva contraseña.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={resetear} className="space-y-4">
          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Nueva contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={nuevaContrasena}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                disabled={cargando}
                className={`pl-9 ${passwordErrors.length > 0 ? "border-destructive" : ""}`}
              />
            </div>
            {nuevaContrasena && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className={`h-1 w-8 rounded ${passwordStrength.color}`} />
                  <span className="text-xs text-muted-foreground">
                    Seguridad: <span className="font-medium capitalize">{passwordStrength.level}</span>
                  </span>
                </div>
                <div className="space-y-1">
                  {passwordErrors.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <Check className="size-3" />
                      Contraseña válida
                    </div>
                  ) : (
                    passwordErrors.map((err) => (
                      <div key={err} className="flex items-center gap-2 text-xs text-destructive">
                        <X className="size-3" />
                        {err}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-sm font-medium">Confirmar contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repite tu contraseña"
                disabled={cargando}
                className={`pl-9 ${confirmar && nuevaContrasena !== confirmar ? "border-destructive" : ""}`}
              />
            </div>
            {confirmar && nuevaContrasena !== confirmar && (
              <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={cargando || passwordErrors.length > 0 || !confirmar}
            className="w-full gap-2 h-10 font-medium"
          >
            {cargando && <Loader2 className="size-4 animate-spin" />}
            {cargando ? "Actualizando..." : "Actualizar contraseña"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
