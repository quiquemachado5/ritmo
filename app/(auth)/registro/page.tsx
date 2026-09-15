"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, Shield, CheckCircle, Check, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { SocialLogin } from "@/components/social-login";
import { validateEmail, validatePassword, getPasswordStrength } from "@/lib/validation";
import { transitionCSS, springBezier, stagger } from "@/lib/transitions";

export default function RegistroPage() {
  return (
    <React.Suspense fallback={<div role="status" className="flex min-h-80 items-center justify-center gap-2 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Preparando tu acceso…</div>}>
      <RegistroForm />
    </React.Suspense>
  );
}

function RegistroForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [estado, setEstado] = React.useState<"form" | "confirmacion" | "exito">("form");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = React.useState<string[]>([]);
  const [shaking, setShaking] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const passwordStrength = getPasswordStrength(password);

  function handleEmailChange(value: string) {
    setEmail(value);
    setEmailError(value ? (validateEmail(value.trim()).error || null) : null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setPasswordErrors(value ? validatePassword(value).errors : []);
  }

  function triggerShake(msg: string) {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(null);

    const correo = email.trim();
    if (!validateEmail(correo).valid) { triggerShake("Introduce un correo válido."); return; }
    if (password !== confirmPassword) { triggerShake("Las contraseñas no coinciden."); return; }
    if (!validatePassword(password).valid) { triggerShake(validatePassword(password).errors[0]); return; }

    setCargando(true);
    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: correo, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
      if (signupError) throw signupError;

      if (data.session) {
        setEstado("exito");
        setTimeout(() => { router.replace("/"); router.refresh(); }, 1500);
      } else {
        setCargando(false);
        setEstado("confirmacion");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already registered") || msg.includes("User already exists"))
        triggerShake("Correo ya registrado.");
      else if (msg.includes("Failed to fetch"))
        triggerShake("No hemos podido conectar. Revisa tu conexión y vuelve a intentarlo.");
      else if (msg.toLowerCase().includes("rate limit"))
        triggerShake("Se han solicitado demasiados correos. Espera unos minutos antes de intentarlo de nuevo.");
      else
        triggerShake("No hemos podido crear la cuenta. Vuelve a intentarlo en unos momentos.");
      setCargando(false);
    }
  }

  if (estado === "exito") {
    return (
      <>
        <style>{transitionCSS}</style>
        <div style={{ animation: `fadeScale 0.5s ${springBezier} forwards` }}>
          <div className="bg-background border border-border/50 rounded-2xl shadow-lg px-6 py-8 text-center">
            <CheckCircle className="mx-auto size-10 text-primary mb-3" style={{ animation: `successPop 0.6s ${springBezier}` }} />
            <h1 className="font-display text-xl font-bold">¡Bienvenido!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Entrando a RITMO...</p>
          </div>
        </div>
      </>
    );
  }

  if (estado === "confirmacion") {
    return (
      <>
        <style>{transitionCSS}</style>
        <div style={{ animation: `fadeScale 0.5s ${springBezier} forwards` }}>
          <div className="bg-background border border-border/50 rounded-2xl shadow-lg px-6 py-8 text-center">
            <MailCheck className="mx-auto size-10 text-primary mb-3" style={{ animation: `successPop 0.6s ${springBezier}` }} />
            <h1 className="font-display text-xl font-bold">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enlace enviado a <span className="break-all font-medium text-foreground">{email.trim()}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Revisa spam si no lo ves.</p>
            <Button variant="outline" onClick={() => setEstado("form")} className="mt-4 min-h-11 rounded-lg">
              Cambiar correo
            </Button>
            <p className="mt-3 text-xs text-muted-foreground"><Link href="/login" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">Volver a iniciar sesión</Link></p>
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

          <div className="space-y-4 px-5 py-6 sm:px-7 sm:py-6">
            <div className="overflow-hidden">
              <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ animation: `revealText 0.7s ${springBezier} forwards` }}>
                Crear cuenta
              </h1>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}>
                <Shield className="size-3.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={registrar} className="space-y-2.5" aria-busy={cargando}>
              <div style={stagger(1)}>
                <Label htmlFor="email" className="text-sm font-semibold mb-1 block">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-3" />
                  <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required
                    aria-invalid={!!emailError} aria-describedby={emailError ? "email-error" : undefined}
                    value={email} onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="tu@correo.com" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-11 sm:pl-9 md:text-sm ${emailError ? "border-destructive" : ""}`}
                  />
                </div>
                {emailError && <p id="email-error" className="text-xs text-destructive mt-1">{emailError}</p>}
              </div>

              <div style={stagger(2)}>
                <Label htmlFor="password" className="text-sm font-semibold mb-1 block">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-3" />
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                    aria-invalid={passwordErrors.length > 0} aria-describedby="password-help"
                    value={password} onChange={(e) => handlePasswordChange(e.target.value)}
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
                {password && (
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

              <div style={stagger(3)}>
                <Label htmlFor="confirm" className="text-sm font-semibold mb-1 block">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-3" />
                  <Input id="confirm" name="confirmPassword" type={showConfirm ? "text" : "password"} autoComplete="new-password" required
                    aria-invalid={!!confirmPassword && password !== confirmPassword} aria-describedby={confirmPassword && password !== confirmPassword ? "confirm-error" : undefined}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-11 sm:pl-9 sm:pr-10 md:text-sm ${confirmPassword && password !== confirmPassword ? "border-destructive" : ""}`}
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
                {confirmPassword && password !== confirmPassword && (
                  <p id="confirm-error" className="text-xs text-destructive mt-1">Las contraseñas no coinciden.</p>
                )}
              </div>

              <Button type="submit"
                disabled={cargando}
                className="h-12 w-full rounded-lg text-base font-semibold transition-[background-color,color,box-shadow,transform] active:scale-[0.98] sm:h-11 md:text-sm sm:active:scale-95"
                style={stagger(4)}>
                {cargando ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Creando...</> : "Crear cuenta"}
              </Button>
            </form>

            <div style={stagger(5)}>
              <SocialLogin disabled={cargando} />
            </div>

            <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30" style={stagger(6)}>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" prefetch={false} className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
