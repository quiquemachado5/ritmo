"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Shield, CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/validation";
import { transitionCSS, springBezier, stagger } from "@/lib/transitions";
import { urlRecuperacionConCallback } from "@/lib/auth-redirect";

export default function RecuperarPage() {
  return (
    <React.Suspense fallback={<div role="status" className="flex min-h-80 items-center justify-center gap-2 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Preparando tu acceso…</div>}>
      <RecuperarForm />
    </React.Suspense>
  );
}

function RecuperarForm() {
  const [email, setEmail] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exito, setExito] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [shaking, setShaking] = React.useState(false);

  function handleEmailChange(value: string) {
    setEmail(value);
    setEmailError(value ? (validateEmail(value.trim()).error || null) : null);
  }

  function triggerShake(msg: string) {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  async function recuperar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(null);
    const correo = email.trim();
    if (!validateEmail(correo).valid) { triggerShake("Introduce un correo válido."); return; }

    setCargando(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo: urlRecuperacionConCallback(window.location.origin),
      });
      if (resetError) throw resetError;
      setExito(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerShake(msg.includes("Failed to fetch")
        ? "No hemos podido conectar. Revisa tu conexión y vuelve a intentarlo."
        : "No hemos podido enviar el enlace. Espera unos minutos y vuelve a intentarlo.");
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <>
        <style>{transitionCSS}</style>
        <div style={{ animation: `fadeScale 0.5s ${springBezier} forwards` }}>
          <div className="bg-background border border-border/50 rounded-2xl shadow-lg px-6 py-6 text-center space-y-3">
            <CheckCircle2 className="mx-auto size-10 text-weight" style={{ animation: `successPop 0.6s ${springBezier}` }} />
            <h1 className="font-display text-xl font-bold">Revisa tu correo</h1>
            <p className="text-sm text-muted-foreground">Si hay una cuenta asociada a <span className="break-all font-medium text-foreground">{email.trim()}</span>, recibirás un enlace para recuperar tu contraseña.</p>
            <p className="text-xs text-muted-foreground">Si no lo ves, revisa spam.</p>
            <Button asChild variant="outline" className="mt-2 min-h-11 rounded-lg gap-1.5">
              <Link href="/login" prefetch={false}><ArrowLeft className="size-3.5" />Volver a iniciar sesión</Link>
            </Button>
            <div><Button variant="ghost" className="min-h-11" onClick={() => { setExito(false); setCargando(false); }}>Cambiar correo</Button></div>
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

          <div className="space-y-5 px-5 py-6 sm:px-7">
            <div className="overflow-hidden">
              <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ animation: `revealText 0.7s ${springBezier} forwards` }}>
                Recuperar contraseña
              </h1>
              <p className="text-sm text-muted-foreground mt-1" style={{ animation: `revealText 0.7s ${springBezier} 0.1s forwards`, opacity: 0 }}>
                Te enviaremos un enlace para crear una nueva contraseña.
              </p>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}>
                <Shield className="size-3.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={recuperar} className="space-y-3" aria-busy={cargando}>
              <div style={stagger(1)}>
                <Label htmlFor="email" className="text-sm font-semibold mb-1.5 block">Correo electrónico</Label>
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

              <Button type="submit" disabled={cargando}
                className="h-12 w-full rounded-lg text-base font-semibold transition-transform active:scale-[0.98] sm:h-11 md:text-sm sm:active:scale-95"
                style={stagger(2)}>
                {cargando ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Enviando...</> : "Enviar enlace"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30" style={stagger(3)}>
              <Link href="/login" prefetch={false} className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Volver a iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
