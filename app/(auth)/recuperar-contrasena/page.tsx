"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, CheckCircle2, Lock, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { validatePassword, getPasswordStrength } from "@/lib/validation";
import { transitionCSS, springBezier, stagger } from "@/lib/transitions";

export default function ResetearPage() {
  return (
    <React.Suspense fallback={<div role="status" className="flex min-h-80 items-center justify-center gap-2 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Preparando tu acceso…</div>}>
      <ResetearForm />
    </React.Suspense>
  );
}

function ResetearForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = React.useState(() => createClient());
  const [nuevaContrasena, setNuevaContrasena] = React.useState("");
  const [confirmar, setConfirmar] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exito, setExito] = React.useState(false);
  const [passwordErrors, setPasswordErrors] = React.useState<string[]>([]);
  const [shaking, setShaking] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [verificandoSesion, setVerificandoSesion] = React.useState(true);
  const [sesionLista, setSesionLista] = React.useState(false);
  const [errorSesion, setErrorSesion] = React.useState<string | null>(null);

  React.useEffect(() => {
    let activa = true;
    const code = searchParams.get("code");
    const flowId = searchParams.get("sb_flow_id");
    const agotado = window.setTimeout(() => {
      if (!activa) return;
      setSesionLista(false);
      setErrorSesion("El enlace ya se usó, ha caducado o se abrió en otro navegador. Solicita uno nuevo y ábrelo en este mismo dispositivo.");
      setVerificandoSesion(false);
    }, 4_000);
    const confirmarSesion = () => {
      if (!activa) return;
      window.clearTimeout(agotado);
      setSesionLista(true);
      setErrorSesion(null);
      setVerificandoSesion(false);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) confirmarSesion();
    });
    void (async () => {
      try {
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
          if (exchangeError) throw exchangeError;
          if (data.session) {
            window.history.replaceState(null, "", "/recuperar-contrasena");
            confirmarSesion();
            return;
          }
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (data.session) confirmarSesion();
        else throw new Error("missing_recovery_session");
      } catch {
        if (!activa) return;
        window.clearTimeout(agotado);
        setSesionLista(false);
        setErrorSesion("El enlace ya se usó, ha caducado o se abrió en otro navegador. Solicita uno nuevo y ábrelo en este mismo dispositivo.");
        setVerificandoSesion(false);
      }
    })();
    return () => { activa = false; window.clearTimeout(agotado); listener.subscription.unsubscribe(); };
  }, [searchParams, supabase]);

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
    if (cargando) return;
    setError(null);

    if (!sesionLista) { triggerShake("Abre un enlace de recuperación válido antes de continuar."); return; }
    if (!nuevaContrasena) { triggerShake("Ingresa una contraseña."); return; }
    if (!validatePassword(nuevaContrasena).valid) { triggerShake(validatePassword(nuevaContrasena).errors[0]); return; }
    if (nuevaContrasena !== confirmar) { triggerShake("No coinciden."); return; }

    setCargando(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: nuevaContrasena });
      if (updateError) throw updateError;
      await supabase.auth.signOut({ scope: "local" });
      setExito(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerShake(msg.includes("Failed to fetch")
        ? "No hemos podido conectar. Revisa tu conexión y vuelve a intentarlo."
        : msg.toLowerCase().includes("same password")
          ? "Elige una contraseña diferente a la que usabas antes."
          : "No hemos podido actualizar tu contraseña. Inténtalo de nuevo o solicita otro enlace.");
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
            <p className="text-sm text-muted-foreground">Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <Button asChild className="min-h-11"><Link href="/login" prefetch={false}>Iniciar sesión</Link></Button>
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
              <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ animation: `revealText 0.7s ${springBezier} forwards` }}>
                Nueva contraseña
              </h1>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}>
                <Shield className="size-3.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            {verificandoSesion && <div role="status" className="flex min-h-24 items-center justify-center gap-2 rounded-xl bg-secondary/55 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Validando tu enlace seguro…</div>}

            {errorSesion && !verificandoSesion && <div role="alert" className="rounded-xl border border-warning-border bg-warning-wash p-4 text-sm text-warning-ink"><p className="font-semibold">Necesitas un enlace nuevo</p><p className="mt-1 text-xs leading-relaxed">{errorSesion}</p><Button asChild variant="outline" className="mt-3 w-full"><Link href="/recuperar" prefetch={false}>Solicitar otro enlace</Link></Button></div>}

            {sesionLista && !verificandoSesion && <form onSubmit={resetear} className="space-y-2.5" aria-busy={cargando}>
              <div style={stagger(1)}>
                <Label htmlFor="password" className="text-sm font-semibold mb-1.5 block">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-3" />
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                    aria-invalid={passwordErrors.length > 0} aria-describedby="password-help"
                    value={nuevaContrasena} onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="Mínimo 8 caracteres" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-11 sm:pl-9 sm:pr-10 md:text-sm ${passwordErrors.length > 0 ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={cargando}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="absolute right-0 top-0 grid size-12 place-items-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-11"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p id="password-help" className={`mt-1 text-xs leading-relaxed ${passwordErrors.length ? "text-destructive" : "text-muted-foreground"}`}>
                  {passwordErrors.length ? passwordErrors.join(" ") : "Usa al menos 8 caracteres, una mayúscula y un número."}
                </p>
                {nuevaContrasena && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                      <div className={`h-full rounded-full transition-[width] duration-500 ${passwordStrength.color}`}
                        style={{ width: `${Math.max(passwordStrength.percent, 10)}%` }} />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground capitalize">{passwordStrength.level}</span>
                    {passwordErrors.length === 0 && (
                      <Check className="size-3 text-weight" style={{ animation: `successPop 0.3s ${springBezier}` }} />
                    )}
                  </div>
                )}
              </div>

              <div style={stagger(2)}>
                <Label htmlFor="confirm" className="text-sm font-semibold mb-1.5 block">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-3" />
                  <Input id="confirm" name="confirmPassword" type={showConfirm ? "text" : "password"} autoComplete="new-password" required
                    aria-invalid={!!confirmar && nuevaContrasena !== confirmar} aria-describedby={confirmar && nuevaContrasena !== confirmar ? "confirm-error" : undefined}
                    value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Repite tu contraseña" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-11 sm:pl-9 sm:pr-10 md:text-sm ${confirmar && nuevaContrasena !== confirmar ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    disabled={cargando}
                    aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                    aria-pressed={showConfirm}
                    className="absolute right-0 top-0 grid size-12 place-items-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-11"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {confirmar && nuevaContrasena !== confirmar && (
                  <p id="confirm-error" className="text-xs text-destructive mt-1">Las contraseñas no coinciden.</p>
                )}
              </div>

              <Button type="submit"
                disabled={cargando}
                className="h-12 w-full rounded-lg text-base font-semibold transition-transform active:scale-[0.98] sm:h-11 md:text-sm sm:active:scale-95"
                style={stagger(3)}>
                {cargando ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Actualizando...</> : "Actualizar contraseña"}
              </Button>
            </form>}
          </div>
        </div>
      </div>
    </>
  );
}
