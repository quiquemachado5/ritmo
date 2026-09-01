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

export default function RecuperarPage() {
  return (
    <React.Suspense fallback={null}>
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
    setEmailError(value ? (validateEmail(value).error || null) : null);
  }

  function triggerShake(msg: string) {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  async function recuperar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validateEmail(email).valid) { triggerShake("Correo inválido."); return; }

    setCargando(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/recuperar-contrasena`,
      });
      if (resetError) throw resetError;
      setExito(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerShake(msg.includes("Failed to fetch") ? "Sin conexión." : (msg || "Error al enviar."));
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
            <h1 className="font-display text-xl font-bold">Correo enviado</h1>
            <p className="text-sm text-muted-foreground">Revisa tu bandeja de entrada.</p>
            <p className="text-xs text-muted-foreground">Si no lo ves, revisa spam.</p>
            <Link href="/login">
              <Button variant="outline" size="sm" className="mt-2 rounded-lg gap-1.5">
                <ArrowLeft className="size-3.5" />Volver al login
              </Button>
            </Link>
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
              <h1 className="font-display text-3xl font-bold" style={{ animation: `revealText 0.7s ${springBezier} forwards` }}>
                Recuperar contraseña
              </h1>
              <p className="text-sm text-muted-foreground mt-1" style={{ animation: `revealText 0.7s ${springBezier} 0.1s forwards`, opacity: 0 }}>
                Te enviaremos un enlace para resetearla.
              </p>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                style={{ animation: `toastIn 0.3s ${springBezier}` }}>
                <Shield className="size-3.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={recuperar} className="space-y-3">
              <div style={stagger(1)}>
                <Label htmlFor="email" className="text-sm font-semibold mb-1.5 block">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 size-4 text-muted-foreground sm:top-2.5" />
                  <Input id="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="tu@correo.com" disabled={cargando}
                    className={`h-12 rounded-lg border-2 pl-10 text-base transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary/20 sm:h-10 sm:pl-9 sm:text-sm ${emailError ? "border-destructive" : ""}`}
                  />
                </div>
                {emailError && <p className="text-[0.65rem] text-destructive mt-0.5">{emailError}</p>}
              </div>

              <Button type="submit" disabled={cargando || emailError !== null}
                className="h-12 w-full rounded-lg text-base font-semibold transition-transform active:scale-[0.98] sm:h-10 sm:text-sm sm:active:scale-95"
                style={stagger(2)}>
                {cargando ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Enviando...</> : "Enviar enlace"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30" style={stagger(3)}>
              <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Volver al login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
