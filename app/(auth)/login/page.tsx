"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SocialLogin } from "@/components/social-login";
import { loginRateLimiter, validateEmail } from "@/lib/validation";

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [recordarme, setRecordarme] = React.useState(false);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError("Ingresa un correo válido.");
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }

    const rateLimitCheck = loginRateLimiter.check(email);
    if (!rateLimitCheck.allowed) {
      const minutes = Math.ceil(rateLimitCheck.resetIn / 1000 / 60);
      setError(`Demasiados intentos. Intenta en ${minutes} minutos.`);
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      if (recordarme) {
        localStorage.setItem("ritmo_recordarme", "true");
      } else {
        localStorage.removeItem("ritmo_recordarme");
      }

      router.push(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("Invalid login") || msg.includes("Invalid credentials"))
        setError("Correo o contraseña incorrectos.");
      else if (msg.includes("Email not confirmed"))
        setError("Tu correo aún no está confirmado. Revisa tu bandeja de entrada.");
      else if (msg.includes("400") || msg.includes("unauthorized"))
        setError("Error de conexión. Verifica las credenciales de Supabase.");
      else if (msg.includes("User not found"))
        setError("No existe una cuenta con ese correo.");
      else if (msg.includes("Failed to fetch"))
        setError("Error de conexión. Verifica tu internet.");
      else
        setError(msg || "No se pudo iniciar sesión. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Inicia sesión</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bienvenido de vuelta a tu ritmo.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={entrar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Correo
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                disabled={cargando}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={cargando}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="recordarme"
              checked={recordarme}
              onChange={(e) => setRecordarme(e.target.checked)}
              disabled={cargando}
              className="rounded border-input cursor-pointer"
            />
            <Label htmlFor="recordarme" className="text-xs font-normal cursor-pointer">
              Recuérdame en este dispositivo
            </Label>
          </div>

          <Button
            type="submit"
            disabled={cargando}
            className="w-full gap-2 h-10 font-medium"
          >
            {cargando && <Loader2 className="size-4 animate-spin" />}
            {cargando ? "Iniciando..." : "Iniciar sesión"}
          </Button>
        </form>

        {/* Social Login */}
        <SocialLogin />

        {/* Links */}
        <div className="space-y-3 text-center text-sm">
          <p className="text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-primary hover:underline">
              Crear una
            </Link>
          </p>
          <p className="text-muted-foreground">
            ¿Olvidaste tu contraseña?{" "}
            <Link href="/recuperar" className="font-semibold text-primary hover:underline">
              Recuperarla
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[0.65rem] text-muted-foreground/50">
          Tus datos se guardan cifrados en Supabase. RITMO no comparte información con terceros.
        </p>
      </div>
    </Card>
  );
}
