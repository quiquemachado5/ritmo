"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, CheckCircle2, Lock, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { validatePassword, getPasswordStrength } from "@/lib/validation";
import { transitionCSS, springBezier, stagger } from "@/lib/transitions";

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
  const [shaking, setShaking] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const passwordStrength = getPasswordStrength(nuevaContrasena);

  function handlePasswordChange(value: string) {
    setNuevaContrasena(value);
    setPasswordErrors(value ? validatePassword(value).errors : []);
  }

  function triggerShake(msg: string) {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  async function resetear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nuevaContrasena) { triggerShake("Ingresa una contraseña."); return; }
    if (!validatePassword(nuevaContrasena).valid) { triggerShake(validatePassword(nuevaContrasena).errors[0]); return; }
    if (nuevaContrasena !== confirmar) { triggerShake("No coinciden."); return; }

    setCargando(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: nuevaContrasena });
      if (updateError) throw updateError;
      setExito(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerShake(msg.includes("Failed to fetch") ? "Sin conexión." : (msg || "Error al actualizar."));
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <>
        <style>{transitionCSS}</style>
        <div style={{ animation: `fadeScale 0.5s ${springBezier} forwards` }}>
          <div className="bg-background border border-border/50 rounded-2xl shadow-lg px-6 py-6 text-center space-y-3">
            <CheckCircle2 className="mx-auto size-10 text-weight" style={{ animation: `successPop 0.6s ${springBezier}` }} />
            <h1 className="font-display text-xl font-bold">¡Contraseña actualizada!</h1>
            <p className="text-sm text-muted-foreground">Redirigiendo al login...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{transitionCSS}</style>
      <div style={{ animation: `fadeScale 0.5s ${springBezier} forwards` }}>
        <div
          className="bg-background border border-border/50 rounded-2xl shadow-lg overflow-hidden"
          style={{ animation: shaking ? `shake 0.42s cubic-bezier(0.22, 1, 0.36, 1)` : "none" }}
        >
          <div className="h-0.5 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          <div className="space-y-5 px-5 py-6 sm:px-7">
            <div className="overflow-hidden">
              <h1 className="font-display text-3xl font-bold" style={{ animation: `revealText 0.7s ${springBezier} forwards` }}>
                Nueva contraseña
              </h1>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}>
                <Shield className="size-3.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={resetear} className="space-y-2.5">
              <div style={stagger(1)}>
                <Label htmlFor="password" className="text-sm font-semibold mb-1.5 block">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-2.5" />
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                    value={nuevaContrasena} onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="Mínimo 8 caracteres" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-10 sm:pl-9 sm:pr-10 sm:text-sm ${passwordErrors.length > 0 ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={cargando}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-0 top-0 grid size-12 place-items-center text-muted-foreground transition-colors hover:text-primary sm:size-10"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {nuevaContrasena && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-1 rounded-full transition-all duration-500 ${passwordStrength.color}`}
                      style={{ width: `${Math.max(passwordStrength.percent, 10)}%` }} />
                    <span className="text-[0.65rem] text-muted-foreground capitalize">{passwordStrength.level}</span>
                    {passwordErrors.length === 0 && (
                      <Check className="size-3 text-weight" style={{ animation: `successPop 0.3s ${springBezier}` }} />
                    )}
                  </div>
                )}
              </div>

              <div style={stagger(2)}>
                <Label htmlFor="confirm" className="text-sm font-semibold mb-1.5 block">Confirmar</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-2.5" />
                  <Input id="confirm" type={showConfirm ? "text" : "password"} autoComplete="new-password" required
                    value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Repite contraseña" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-10 sm:pl-9 sm:pr-10 sm:text-sm ${confirmar && nuevaContrasena !== confirmar ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    disabled={cargando}
                    aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                    className="absolute right-0 top-0 grid size-12 place-items-center text-muted-foreground transition-colors hover:text-primary sm:size-10"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {confirmar && nuevaContrasena !== confirmar && (
                  <p className="text-[0.65rem] text-destructive mt-0.5">No coinciden.</p>
                )}
              </div>

              <Button type="submit"
                disabled={cargando || passwordErrors.length > 0 || !confirmar}
                className="h-12 w-full rounded-lg text-base font-semibold transition-transform active:scale-[0.98] sm:h-10 sm:text-sm sm:active:scale-95"
                style={stagger(3)}>
                {cargando ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Actualizando...</> : "Actualizar contraseña"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
