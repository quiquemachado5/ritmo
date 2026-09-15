"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Mail, Lock, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { SocialLogin } from "@/components/social-login";
import { ButtonRipple } from "@/components/button-ripple";
import { loginRateLimiter, validateEmail } from "@/lib/validation";
import { transitionCSS, springBezier, stagger } from "@/lib/transitions";
import { rutaInternaSegura } from "@/lib/auth-redirect";

const suscribirCliente = () => () => {};
const clientePreparado = () => true;
const servidorPreparado = () => false;

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div role="status" className="flex min-h-80 items-center justify-center gap-2 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Preparando tu acceso…</div>}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  // Impide escribir sobre el HTML estático antes de que React controle los
  // campos: en WebKit ese texto podía perderse durante la hidratación.
  const preparado = React.useSyncExternalStore(suscribirCliente, clientePreparado, servidorPreparado);
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const [shaking, setShaking] = React.useState(false);
  const [validatedEmail, setValidatedEmail] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value) {
      const validation = validateEmail(value.trim());
      setValidatedEmail(!validation.error);
    } else {
      setValidatedEmail(false);
    }
  };

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!preparado || cargando) return;
    setError(null);
    setShaking(false);

    const correo = email.trim();
    const emailValidation = validateEmail(correo);
    if (!emailValidation.valid) {
      triggerShake("Correo inválido.");
      return;
    }
    if (!password) {
      triggerShake("Ingresa tu contraseña.");
      return;
    }

    const rateLimitCheck = loginRateLimiter.check(correo.toLowerCase());
    if (!rateLimitCheck.allowed) {
      const minutes = Math.ceil(rateLimitCheck.resetIn / 1000 / 60);
      triggerShake(`Demasiados intentos. Vuelve a intentarlo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`);
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: correo, password });
      if (loginError) throw loginError;

      // El proveedor escucha el cambio de identidad y el layout se resuelve de
      // nuevo en servidor, evitando reutilizar el onboarding de otra cuenta.
      router.replace(rutaInternaSegura(params.get("next")));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Invalid login") || msg.includes("Invalid credentials"))
        triggerShake("Correo o contraseña incorrectos.");
      else if (msg.includes("Email not confirmed"))
        triggerShake("Confirma tu correo con el enlace que recibiste. Revisa también la carpeta de spam.");
      else if (msg.includes("User not found"))
        triggerShake("Correo o contraseña incorrectos.");
      else if (msg.includes("Failed to fetch"))
        triggerShake("No hemos podido conectar. Revisa tu conexión y vuelve a intentarlo.");
      else
        triggerShake("No hemos podido iniciar sesión. Vuelve a intentarlo en unos momentos.");
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
          style={{ animation: shaking ? `shake 0.42s cubic-bezier(0.22, 1, 0.36, 1)` : "none" }}
        >
          <div className="h-0.5 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          <div className="space-y-5 px-5 py-6 sm:px-7 sm:py-6">
            <div className="overflow-hidden">
              <h1
                className="font-display text-2xl font-bold sm:text-3xl"
                style={{ animation: `revealText 0.7s ${springBezier} forwards` }}
              >
                Bienvenido
              </h1>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}
              >
                <Shield className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={entrar} aria-busy={!preparado || cargando}>
              <fieldset disabled={!preparado || cargando} className="space-y-3">
              <div style={stagger(1)}>
                <Label htmlFor="email" className="text-sm font-semibold mb-1.5 block">Correo electrónico</Label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-3.5 size-4 transition-colors duration-200 sm:top-3 ${
                    focusedField === "email" ? "text-primary" : "text-muted-foreground"
                  } ${validatedEmail && focusedField !== "email" ? "text-weight" : ""}`} />
                  <Input
                    id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required
                    value={email} onChange={(e) => handleEmailChange(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="tu@correo.com" disabled={cargando}
                    className="h-12 rounded-lg border-2 pl-10 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-11 sm:pl-9 md:text-sm"
                  />
                  {validatedEmail && focusedField !== "email" && (
                    <Check className="absolute right-3 top-3.5 size-4 text-weight sm:top-3"
                      style={{ animation: `successPop 0.3s ${springBezier}` }} />
                  )}
                </div>
              </div>

              <div style={stagger(2)}>
                <Label htmlFor="password" className="text-sm font-semibold mb-1.5 block">Contraseña</Label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-3.5 size-4 transition-colors duration-200 sm:top-3 ${
                    focusedField === "password" ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <Input
                    id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••" disabled={cargando}
                    className="h-12 rounded-lg border-2 pl-10 pr-11 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-11 sm:pl-9 sm:pr-10 md:text-sm"
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
              </div>

              <div className="flex justify-end" style={stagger(3)}>
                <Link href="/recuperar" prefetch={false} className="inline-flex min-h-11 items-center text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <ButtonRipple
                type="submit" disabled={cargando}
                className="h-12 w-full rounded-lg text-base font-semibold transition-[background-color,color,box-shadow,transform] active:scale-[0.98] sm:h-11 md:text-sm sm:active:scale-95"
                style={stagger(4)}
              >
                {cargando ? (
                  <><Loader2 className="size-3.5 animate-spin mr-1.5" />Entrando...</>
                ) : (
                  <>Iniciar sesión<ArrowRight className="size-3.5 ml-1.5" /></>
                )}
              </ButtonRipple>
              </fieldset>
            </form>

            <div style={stagger(5)}>
              <SocialLogin disabled={!preparado || cargando} />
            </div>

            <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30" style={stagger(6)}>
              ¿Sin cuenta?{" "}
              <Link href="/registro" prefetch={false} className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Crear una
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
