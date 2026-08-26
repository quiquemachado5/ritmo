"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, Shield, CheckCircle, Check, X, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { SocialLogin } from "@/components/social-login";
import { validateEmail, validatePassword, getPasswordStrength } from "@/lib/validation";
import { transitionCSS, springBezier, stagger } from "@/lib/transitions";

export default function RegistroPage() {
  return (
    <React.Suspense fallback={null}>
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
    setEmailError(value ? (validateEmail(value).error || null) : null);
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
    setError(null);

    if (!validateEmail(email).valid) { triggerShake("Correo inválido."); return; }
    if (password !== confirmPassword) { triggerShake("Las contraseñas no coinciden."); return; }
    if (!validatePassword(password).valid) { triggerShake(validatePassword(password).errors[0]); return; }

    setCargando(true);
    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
      if (signupError) throw signupError;

      if (data.session) {
        setEstado("exito");
        setTimeout(() => { router.replace("/"); router.refresh(); }, 1500);
      } else {
        setEstado("confirmacion");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already registered") || msg.includes("User already exists"))
        triggerShake("Correo ya registrado.");
      else if (msg.includes("Failed to fetch"))
        triggerShake("Sin conexión.");
      else
        triggerShake(msg || "Error al crear cuenta.");
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
              Enlace enviado a <span className="font-medium text-foreground">{email}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Revisa spam si no lo ves.</p>
            <Button variant="outline" size="sm" onClick={() => setEstado("form")} className="mt-4 rounded-lg">
              Volver
            </Button>
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

          <div className="space-y-4 px-5 py-6 sm:px-7 sm:py-6">
            <div className="overflow-hidden">
              <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ animation: `revealText 0.7s ${springBezier} forwards` }}>
                Crear cuenta
              </h1>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}>
                <Shield className="size-3.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={registrar} className="space-y-2.5">
              <div style={stagger(1)}>
                <Label htmlFor="email" className="text-sm font-semibold mb-1 block">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-2.5" />
                  <Input id="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="tu@correo.com" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 text-base transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-10 sm:pl-9 sm:text-sm ${emailError ? "border-destructive" : ""}`}
                  />
                </div>
                {emailError && <p className="text-[0.65rem] text-destructive mt-0.5">{emailError}</p>}
              </div>

              <div style={stagger(2)}>
                <Label htmlFor="password" className="text-sm font-semibold mb-1 block">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-2.5" />
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                    value={password} onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="Mínimo 8 caracteres" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-10 sm:pl-9 sm:pr-10 sm:text-sm ${passwordErrors.length > 0 ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={cargando}
                    className="absolute right-3 top-3.5 text-muted-foreground transition-colors hover:text-primary sm:top-2.5"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {password && (
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

              <div style={stagger(3)}>
                <Label htmlFor="confirm" className="text-sm font-semibold mb-1 block">Confirmar</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-2.5" />
                  <Input id="confirm" type={showConfirm ? "text" : "password"} autoComplete="new-password" required
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite contraseña" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-10 sm:pl-9 sm:pr-10 sm:text-sm ${confirmPassword && password !== confirmPassword ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    disabled={cargando}
                    className="absolute right-3 top-3.5 text-muted-foreground transition-colors hover:text-primary sm:top-2.5"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[0.65rem] text-destructive mt-0.5">No coinciden.</p>
                )}
              </div>

              <Button type="submit"
                disabled={cargando || emailError !== null || passwordErrors.length > 0 || !confirmPassword}
                className="h-12 w-full rounded-lg text-base font-semibold transition-all active:scale-[0.98] sm:h-10 sm:text-sm sm:active:scale-95"
                style={stagger(4)}>
                {cargando ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Creando...</> : "Crear cuenta"}
              </Button>
            </form>

            <div style={stagger(5)}>
              <SocialLogin />
            </div>

            <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30" style={stagger(6)}>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
