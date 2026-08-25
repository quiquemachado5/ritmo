"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [focusedField, setFocusedField] = React.useState<string | null>(null);

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
    <div className="w-full max-w-md animate-in fade-in duration-500">
      {/* Card Principal */}
      <div className="bg-background border border-border/50 rounded-2xl shadow-lg overflow-hidden">
        {/* Header Gradient */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground">
              Bienvenido
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Inicia sesión en tu cuenta para continuar construyendo tu ritmo.
            </p>
          </div>

          {/* Error Alert - Animado */}
          {error && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <Shield className="mt-0.5 size-4 shrink-0 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={entrar} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                Correo electrónico
              </Label>
              <div className="relative group">
                <Mail className={`absolute left-3 top-3 size-5 transition-colors duration-200 ${
                  focusedField === "email" ? "text-primary" : "text-muted-foreground"
                }`} />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="tu@correo.com"
                  disabled={cargando}
                  className="pl-10 h-11 rounded-xl border-2 border-input transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                Contraseña
              </Label>
              <div className="relative group">
                <Lock className={`absolute left-3 top-3 size-5 transition-colors duration-200 ${
                  focusedField === "password" ? "text-primary" : "text-muted-foreground"
                }`} />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  disabled={cargando}
                  className="pl-10 h-11 rounded-xl border-2 border-input transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="recordarme"
                  checked={recordarme}
                  onChange={(e) => setRecordarme(e.target.checked)}
                  disabled={cargando}
                  className="rounded border-input cursor-pointer accent-primary size-4"
                />
                <Label htmlFor="recordarme" className="text-xs font-normal text-muted-foreground cursor-pointer">
                  Recuérdame
                </Label>
              </div>
              <Link 
                href="/recuperar" 
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                ¿Olvidaste contraseña?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={cargando}
              className="w-full h-11 mt-2 font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 active:scale-95 disabled:opacity-60"
            >
              {cargando ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Iniciando...
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight className="size-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Social Login */}
          <SocialLogin />

          {/* Sign Up Link */}
          <div className="pt-2 text-center border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link href="/registro" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Crea una
              </Link>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-[0.65rem] text-muted-foreground/60">
            Tus datos se guardan cifrados en Supabase.
          </p>
        </div>
      </div>

      {/* Decorative Element */}
      <div className="mt-6 text-center text-xs text-muted-foreground/40">
        <p>Constancia sobre perfección.</p>
      </div>
    </div>
  );
}
