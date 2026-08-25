"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Shield, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/validation";

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

  function handleEmailChange(value: string) {
    setEmail(value);
    if (value) {
      const validation = validateEmail(value);
      setEmailError(validation.error || null);
    } else {
      setEmailError(null);
    }
  }

  async function recuperar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error || "Correo inválido.");
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/recuperar-contrasena`,
      });

      if (resetError) throw resetError;

      setExito(true);
      setEmail("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "No se pudo enviar el correo. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <Card className="p-8 border-0 shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <CheckCircle2 className="size-12 text-green-600" />
          <h1 className="font-display text-2xl font-bold">Correo enviado</h1>
          <p className="text-sm text-muted-foreground">
            Revisa tu bandeja de entrada. Te hemos enviado un enlace para resetear tu contraseña.
          </p>
          <p className="text-xs text-muted-foreground">Si no ves el email, revisa spam.</p>
          <Link href="/login" className="mt-2">
            <Button variant="outline">Volver al login</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Recuperar contraseña</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tu correo y te enviaremos un enlace para resetear tu contraseña.
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
        <form onSubmit={recuperar} className="space-y-4">
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

          <Button
            type="submit"
            disabled={cargando || emailError !== null}
            className="w-full gap-2 h-10 font-medium"
          >
            {cargando && <Loader2 className="size-4 animate-spin" />}
            {cargando ? "Enviando..." : "Enviar enlace de recuperación"}
          </Button>
        </form>

        {/* Link */}
        <p className="text-center text-sm text-muted-foreground">
          ¿Recordaste tu contraseña?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Volver al login
          </Link>
        </p>
      </div>
    </Card>
  );
}
