"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, Shield, CheckCircle, Check, X, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SocialLogin } from "@/components/social-login";
import { validateEmail, validatePassword, getPasswordStrength } from "@/lib/validation";

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [estado, setEstado] = React.useState<"form" | "confirmacion" | "exito">("form");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = React.useState<string[]>([]);

  const passwordStrength = getPasswordStrength(password);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (value) {
      const validation = validateEmail(value);
      setEmailError(validation.error || null);
    } else {
      setEmailError(null);
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (value) {
      const validation = validatePassword(value);
      setPasswordErrors(validation.errors);
    } else {
      setPasswordErrors([]);
    }
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error || "Correo inválido.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();

      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (signupError) throw signupError;

      if (data.session) {
        setEstado("exito");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      } else {
        setEstado("confirmacion");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("already registered") || msg.includes("User already exists"))
        setError("Este correo ya está registrado. Intenta con otro o ve a Inicia sesión.");
      else if (msg.includes("Invalid email"))
        setError("El formato del correo no es válido.");
      else if (msg.includes("400") || msg.includes("unauthorized"))
        setError("Error de conexión. Verifica las credenciales de Supabase.");
      else
        setError(msg || "No se pudo crear la cuenta. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  if (estado === "exito") {
    return (
      <Card className="p-8 border-0 shadow-lg text-center">
        <CheckCircle className="mx-auto size-12 text-primary mb-4" />
        <h1 className="font-display text-2xl font-bold">¡Bienvenido!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta se creó exitosamente. Entrando a RITMO...
        </p>
      </Card>
    );
  }

  if (estado === "confirmacion") {
    return (
      <Card className="p-8 border-0 shadow-lg text-center">
        <MailCheck className="mx-auto size-12 text-primary mb-4" />
        <h1 className="font-display text-2xl font-bold">Revisa tu correo</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Enviamos un enlace de confirmación a <span className="font-medium text-foreground">{email}</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Si no ves el email, revisa la carpeta de spam.</p>
        <Button variant="outline" onClick={() => setEstado("form")} className="mt-6">
          Volver
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Crea tu cuenta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Empieza a construir tu ritmo hoy.
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
        <form onSubmit={registrar} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Correo</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="tu@correo.com"
                disabled={cargando}
                className={`pl-9 ${emailError ? "border-destructive" : ""}`}
              />
            </div>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                disabled={cargando}
                className={`pl-9 ${passwordErrors.length > 0 ? "border-destructive" : ""}`}
              />
            </div>
            {password && (
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
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              disabled={cargando}
              className={confirmPassword && password !== confirmPassword ? "border-destructive" : ""}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={cargando || emailError !== null || passwordErrors.length > 0 || !confirmPassword}
            className="w-full gap-2 h-10 font-medium"
          >
            {cargando && <Loader2 className="size-4 animate-spin" />}
            {cargando ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>

        {/* Social Login */}
        <SocialLogin />

        {/* Link */}
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </Card>
  );
}
