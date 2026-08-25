"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, Shield, CheckCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
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
    const validation = validateEmail(value);
    setEmailError(validation.error || null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    const validation = validatePassword(value);
    setPasswordErrors(validation.errors);
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
      <Card className="p-6 text-center">
        <CheckCircle className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 font-display text-xl font-bold">¡Bienvenido!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta se creó exitosamente. Entrando a RITMO...
        </p>
      </Card>
    );
  }

  if (estado === "confirmacion") {
    return (
      <Card className="p-6 text-center">
        <MailCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 font-display text-xl font-bold">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enviamos un enlace de confirmación a <span className="font-medium text-foreground">{email}</span>. Ábrelo para activar tu cuenta.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Si no ves el email, revisa spam.</p>
        <Button variant="outline" onClick={() => setEstado("form")} className="mt-4">
          Volver
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold">Crea tu cuenta</h1>
      <p className="mt-1 text-sm text-muted-foreground">Empieza a construir tu ritmo hoy.</p>
      <form onSubmit={registrar} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="tu@correo.com"
            disabled={cargando}
            className={emailError ? "border-destructive" : ""}
          />
          {emailError && (
            <p className="text-xs text-destructive">{emailError}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            disabled={cargando}
            className={passwordErrors.length > 0 ? "border-destructive" : ""}
          />
          {password && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className={`h-1 w-8 rounded ${passwordStrength.color}`} />
                <span className="text-xs text-muted-foreground">
                  Seguridad: <span className="font-medium capitalize">{passwordStrength.level}</span>
                </span>
              </div>
              <div className="space-y-1">
                {passwordErrors.map((err) => (
                  <div key={err} className="flex items-center gap-2 text-xs text-destructive">
                    <X className="size-3" />
                    {err}
                  </div>
                ))}
                {passwordErrors.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <Check className="size-3" />
                    Contraseña válida
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirmar contraseña</Label>
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

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={cargando || emailError !== null || passwordErrors.length > 0 || !confirmPassword}
          className="gap-2"
        >
          {cargando && <Loader2 className="size-4 animate-spin" />}
          {cargando ? "Creando..." : "Crear cuenta"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
