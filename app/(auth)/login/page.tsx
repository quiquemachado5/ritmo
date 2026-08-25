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

const animations = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
    20%, 40%, 60%, 80% { transform: translateX(3px); }
  }
  
  @keyframes slideInLeft {
    0% { opacity: 0; transform: translateX(-16px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  
  @keyframes slideInRight {
    0% { opacity: 0; transform: translateX(16px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
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
      setError("Correo inválido");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    if (!password) {
      setError("Ingresa contraseña");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    const rateLimitCheck = loginRateLimiter.check(email);
    if (!rateLimitCheck.allowed) {
      const minutes = Math.ceil(rateLimitCheck.resetIn / 1000 / 60);
      setError(`Intenta en ${minutes}m`);
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
        setError("Correo o contraseña incorrectos");
      else if (msg.includes("Email not confirmed"))
        setError("Confirma tu correo");
      else if (msg.includes("User not found"))
        setError("Cuenta no encontrada");
      else if (msg.includes("Failed to fetch"))
        setError("Sin conexión");
      else
        setError("Error al iniciar sesión");
      
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setCargando(false);
    }
  }

  return (
    <>
      <style>{animations}</style>
      
      {/* Layout Horizontal */}
      <div className="w-full max-w-5xl mx-auto">
        <div 
          className="grid grid-cols-2 gap-8 items-center bg-background rounded-2xl border border-border/50 shadow-xl overflow-hidden"
          style={{ animation: "fadeIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        >
          {/* Left: Branding */}
          <div 
            className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 flex flex-col justify-center"
            style={{ animation: "slideInLeft 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-3xl font-display font-bold text-foreground">RITMO</h2>
                <p className="text-sm text-muted-foreground font-medium">Constancia sobre perfección</p>
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed mt-6">
                Construye tu ritmo de salud con datos precisos y análisis inteligentes.
              </p>
              
              <div className="pt-4 space-y-2 text-xs text-muted-foreground/70">
                <div className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>Datos cifrados en Supabase</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>Sin compartir información</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>Análisis predictivo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div 
            className="p-8"
            style={{ animation: "slideInRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            <div className="space-y-4">
              {/* Header */}
              <div>
                <h1 className="text-2xl font-bold text-foreground">Inicia sesión</h1>
              </div>

              {/* Error */}
              {error && (
                <div 
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                  style={{ animation: "slideInRight 0.3s cubic-bezier(0.36, 0, 0.66, -0.56)" }}
                >
                  <Shield className="size-3 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={entrar} className="space-y-3">
                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
                  <div className="relative mt-1">
                    <Mail className={`absolute left-2.5 top-2.5 size-4 transition-colors ${
                      focusedField === "email" ? "text-primary" : "text-muted-foreground"
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
                      className="h-9 pl-9 text-sm rounded-lg border-2 border-input transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {validatedEmail && !focusedField && (
                      <Check className="absolute right-2.5 top-2.5 size-4 text-green-500" />
                    )}
                  </div>
                </div>

                {/* Password */}
                <div>
                  <Label htmlFor="password" className="text-xs font-semibold">Contraseña</Label>
                  <div className="relative mt-1">
                    <Lock className={`absolute left-2.5 top-2.5 size-4 transition-colors ${
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
                      className="h-9 pl-9 text-sm rounded-lg border-2 border-input transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Remember & Forgot */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="recordarme"
                      checked={recordarme}
                      onChange={(e) => setRecordarme(e.target.checked)}
                      disabled={cargando}
                      className="size-3.5 rounded cursor-pointer accent-primary"
                    />
                    <Label htmlFor="recordarme" className="text-xs cursor-pointer">Recuérdame</Label>
                  </div>
                  <Link href="/recuperar" className="text-xs font-medium text-primary hover:underline">
                    ¿Olvidaste?
                  </Link>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={cargando}
                  className="w-full h-9 text-sm font-semibold rounded-lg transition-all active:scale-95"
                  style={{
                    transform: shaking ? "translateX(-4px)" : "translateX(0)",
                    animation: shaking ? "shake 0.4s cubic-bezier(0.36, 0, 0.66, -0.56)" : "none"
                  }}
                >
                  {cargando ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      Iniciar
                      <ArrowRight className="size-3.5 ml-1.5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Social */}
              <div className="!mt-4">
                <SocialLogin />
              </div>

              {/* Sign Up */}
              <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30">
                ¿No tienes cuenta?{" "}
                <Link href="/registro" className="font-semibold text-primary hover:underline">
                  Crear una
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
