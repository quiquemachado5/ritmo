"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Mail, Lock, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { SocialLogin } from "@/components/social-login";
import { loginRateLimiter, validateEmail } from "@/lib/validation";
import { transitionCSS, springBezier, stagger } from "@/lib/transitions";

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
  const [showPassword, setShowPassword] = React.useState(false);

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
      triggerShake("Correo inválido.");
      return;
    }
    if (!password) {
      triggerShake("Ingresa tu contraseña.");
      return;
    }

    const rateLimitCheck = loginRateLimiter.check(email);
    if (!rateLimitCheck.allowed) {
      const minutes = Math.ceil(rateLimitCheck.resetIn / 1000 / 60);
      triggerShake(`Demasiados intentos. Intenta en ${minutes}m.`);
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      if (recordarme) localStorage.setItem("ritmo_recordarme", "true");
      else localStorage.removeItem("ritmo_recordarme");

      router.push(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Invalid login") || msg.includes("Invalid credentials"))
        triggerShake("Correo o contraseña incorrectos.");
      else if (msg.includes("Email not confirmed"))
        triggerShake("Confirma tu correo primero.");
      else if (msg.includes("User not found"))
        triggerShake("No existe esa cuenta.");
      else if (msg.includes("Failed to fetch"))
        triggerShake("Sin conexión.");
      else
        triggerShake("Error al iniciar sesión.");
      setCargando(false);
    }
  }

  function triggerShake(msg: string) {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
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
              <h1
                className="font-display text-3xl font-bold"
                style={{ animation: `revealText 0.7s ${springBezier} forwards` }}
              >
                Bienvenido
              </h1>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}
              >
                <Shield className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={entrar} className="space-y-3">
              <div style={stagger(1)}>
                <Label htmlFor="email" className="text-sm font-semibold mb-1.5 block">Email</Label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-2.5 size-4 transition-all duration-200 ${
                    focusedField === "email" ? "text-primary" : "text-muted-foreground"
                  } ${validatedEmail && focusedField !== "email" ? "text-green-500" : ""}`} />
                  <Input
                    id="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => handleEmailChange(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="tu@correo.com" disabled={cargando}
                    className="pl-9 h-10 text-sm rounded-lg border-2 transition-all focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                  {validatedEmail && focusedField !== "email" && (
                    <Check className="absolute right-3 top-2.5 size-4 text-green-500"
                      style={{ animation: `successPop 0.3s ${springBezier}` }} />
                  )}
                </div>
              </div>

              <div style={stagger(2)}>
                <Label htmlFor="password" className="text-sm font-semibold mb-1.5 block">Contraseña</Label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-2.5 size-4 transition-all duration-200 ${
                    focusedField === "password" ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <Input
                    id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••" disabled={cargando}
                    className="pl-9 pr-10 h-10 text-sm rounded-lg border-2 transition-all focus:border-primary focus:ring-1 focus:ring-primary/20"
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
              </div>

              <div className="flex items-center justify-between" style={stagger(3)}>
                <label className="flex items-center gap-2 cursor-pointer group hover:bg-primary/5 px-2 py-1 rounded-lg transition-colors">
                  <input
                    type="checkbox" checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    disabled={cargando}
                    className="size-4 rounded border-2 border-primary/30 accent-primary cursor-pointer transition-all group-hover:border-primary disabled:opacity-60"
                  />
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Recuérdame</span>
                </label>
                <Link href="/recuperar" className="text-[0.7rem] font-medium text-primary hover:text-primary/80 transition-colors">
                  ¿Olvidaste contraseña?
                </Link>
              </div>

              <Button
                type="submit" disabled={cargando}
                className="w-full h-10 text-sm font-semibold rounded-lg transition-all active:scale-95"
                style={stagger(4)}
              >
                {cargando ? (
                  <><Loader2 className="size-3.5 animate-spin mr-1.5" />Entrando...</>
                ) : (
                  <>Iniciar sesión<ArrowRight className="size-3.5 ml-1.5" /></>
                )}
              </Button>
            </form>

            <div style={stagger(5)}>
              <SocialLogin />
            </div>

            <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30" style={stagger(6)}>
              ¿Sin cuenta?{" "}
              <Link href="/registro" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Crear una
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
