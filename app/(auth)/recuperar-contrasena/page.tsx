"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, CheckCircle2, Lock, Check, X, Eye, EyeOff } from "lucide-react";
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
            <CheckCircle2 className="mx-auto size-10 text-green-600" style={{ animation: `successPop 0.6s ${springBezier}` }} />
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
          style={{ animation: shaking ? `shake 0.5s cubic-bezier(0.36, 0, 0.66, -0.56)` : "none" }}
        >
          <div className="h-0.5 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          <div className="px-7 py-6 space-y-5">
            <div className="overflow-hidden">
              <h1 className="font-display text-3xl font-bold" style={{ animation: `revealText 0.7s ${springBezier} forwards` }}>
                Nueva contraseña
              </h1>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}>
                <Shield className="size-3.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={resetear} className="space-y-2.5">
              <div style={stagger(1)}>
                <Label htmlFor="password" className="text-sm font-semibold mb-1.5 block">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                    value={nuevaContrasena} onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="Mínimo 8 caracteres" disabled={cargando}
                    className={`pl-9 pr-10 h-10 text-sm rounded-lg border-2 transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 ${passwordErrors.length > 0 ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={cargando}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {nuevaContrasena && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-1 rounded-full transition-all duration-500 ${passwordStrength.color}`}
                      style={{ width: `${Math.max(passwordStrength.score * 25, 10)}%` }} />
                    <span className="text-[0.65rem] text-muted-foreground capitalize">{passwordStrength.level}</span>
                    {passwordErrors.length === 0 && (
                      <Check className="size-3 text-green-500" style={{ animation: `successPop 0.3s ${springBezier}` }} />
                    )}
                  </div>
                )}
              </div>

              <div style={stagger(2)}>
                <Label htmlFor="confirm" className="text-sm font-semibold mb-1.5 block">Confirmar</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input id="confirm" type={showConfirm ? "text" : "password"} autoComplete="new-password" required
                    value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Repite contraseña" disabled={cargando}
                    className={`pl-9 pr-10 h-10 text-sm rounded-lg border-2 transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 ${confirmar && nuevaContrasena !== confirmar ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    disabled={cargando}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
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
                className="w-full h-10 text-sm font-semibold rounded-lg transition-all active:scale-95"
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
