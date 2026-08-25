"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Mail, Lock, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { SocialLogin } from "@/components/social-login";
import { loginRateLimiter, validateEmail } from "@/lib/validation";

const shakeKeyframes = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
  }
  
  @keyframes revealText {
    0% { opacity: 0; clip-path: inset(0 100% 0 0); }
    100% { opacity: 1; clip-path: inset(0 0 0 0); }
  }
  
  @keyframes slideUp {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes formFadeIn {
    0% { opacity: 0; transform: scale(0.98); }
    100% { opacity: 1; transform: scale(1); }
  }
  
  @keyframes successPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;

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
  const [shaking, setShaking] = React.useState(false);
  const [validatedEmail, setValidatedEmail] = React.useState(false);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value) {
      const validation = validateEmail(value);
      setValidatedEmail(!validation.error);
    } else {
      setValidatedEmail(false);
    }
  };

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShaking(false);

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError("Ingresa un correo válido.");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña.");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    const rateLimitCheck = loginRateLimiter.check(email);
    if (!rateLimitCheck.allowed) {
      const minutes = Math.ceil(rateLimitCheck.resetIn / 1000 / 60);
      setError(`Demasiados intentos. Intenta en ${minutes} minutos.`);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
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
        setError("Tu correo aún no está confirmado.");
      else if (msg.includes("400") || msg.includes("unauthorized"))
        setError("Error de conexión.");
      else if (msg.includes("User not found"))
        setError("No existe una cuenta con ese correo.");
      else if (msg.includes("Failed to fetch"))
        setError("Error de conexión. Verifica tu internet.");
      else
        setError(msg || "No se pudo iniciar sesión.");
      
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setCargando(false);
    }
  }

  return (
    <>
      <style>{shakeKeyframes}</style>
      <div className="w-full max-w-md" style={{
        animation: "formFadeIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
      }}>
        {/* Card Principal */}
        <div className="bg-background border border-border/50 rounded-2xl shadow-lg overflow-hidden"
          style={{
            transform: shaking ? "translateX(-4px)" : "translateX(0)",
            animation: shaking ? "shake 0.5s cubic-bezier(0.36, 0, 0.66, -0.56)" : "none"
          }}
        >
          {/* Header Gradient */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          <div className="p-8 space-y-6">
            {/* Header con reveal text */}
            <div className="space-y-2 overflow-hidden">
              <h1 className="font-display text-3xl font-bold text-foreground" style={{
                animation: "revealText 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
              }}>
                Bienvenido
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed" style={{
                animation: "revealText 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards",
                opacity: 0
              }}>
                Inicia sesión para continuar.
              </p>
            </div>

            {/* Error Alert con Toast Animation */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive overflow-hidden"
                style={{
                  animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
                }}
              >
                <Shield className="mt-0.5 size-4 shrink-0 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={entrar} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2" style={{
                animation: "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both"
              }}>
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Correo electrónico
                </Label>
                <div className="relative group">
                  <Mail className={`absolute left-3 top-3 size-5 transition-all duration-300 ${
                    focusedField === "email" ? "text-primary scale-110" : "text-muted-foreground"
                  } ${validatedEmail && !focusedField ? "text-green-500" : ""}`} />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="tu@correo.com"
                    disabled={cargando}
                    className="pl-10 h-11 rounded-xl border-2 border-input transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-lg"
                  />
                  {validatedEmail && !focusedField && (
                    <Check className="absolute right-3 top-3 size-5 text-green-500" style={{
                      animation: "successPulse 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    }} />
                  )}
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2" style={{
                animation: "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both"
              }}>
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                  Contraseña
                </Label>
                <div className="relative group">
                  <Lock className={`absolute left-3 top-3 size-5 transition-all duration-300 ${
                    focusedField === "password" ? "text-primary scale-110" : "text-muted-foreground"
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
                    className="pl-10 h-11 rounded-xl border-2 border-input transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-lg"
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1" style={{
                animation: "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s both"
              }}>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="recordarme"
                    checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    disabled={cargando}
                    className="rounded border-input cursor-pointer accent-primary size-4 transition-all hover:scale-110"
                  />
                  <Label htmlFor="recordarme" className="text-xs font-normal text-muted-foreground cursor-pointer">
                    Recuérdame
                  </Label>
                </div>
                <Link 
                  href="/recuperar" 
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-all hover:scale-105"
                >
                  ¿Olvidaste contraseña?
                </Link>
              </div>

              {/* Submit Button con Morph Animation */}
              <Button
                type="submit"
                disabled={cargando}
                className="w-full h-11 mt-2 font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 active:scale-95 disabled:opacity-60"
                style={{
                  animation: "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both"
                }}
              >
                {cargando ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            {/* Social Login */}
            <div style={{
              animation: "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s both"
            }}>
              <SocialLogin />
            </div>

            {/* Sign Up Link */}
            <div className="pt-2 text-center border-t border-border/50" style={{
              animation: "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both"
            }}>
              <p className="text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link href="/registro" className="font-semibold text-primary hover:text-primary/80 transition-colors hover:scale-105 inline-block origin-center">
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
        <div className="mt-6 text-center text-xs text-muted-foreground/40" style={{
          animation: "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s both"
        }}>
          <p>Constancia sobre perfección.</p>
        </div>
      </div>
    </>
  );
}
