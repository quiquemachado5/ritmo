"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

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

  async function recuperar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Ingresa tu correo.");
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
      setError(msg || "No se pudo enviar el correo de recuperación. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-green-600" />
          <h1 className="font-display text-xl font-bold">Correo enviado</h1>
          <p className="text-sm text-muted-foreground">
            Revisa tu bandeja de entrada. Te hemos enviado un enlace para resetear tu contraseña.
          </p>
          <Link href="/login" className="mt-4">
            <Button variant="outline">Volver al login</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ingresa tu correo y te enviaremos un enlace para resetear tu contraseña.
      </p>
      <form onSubmit={recuperar} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            disabled={cargando}
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button type="submit" disabled={cargando} className="gap-2">
          {cargando && <Loader2 className="size-4 animate-spin" />}
          {cargando ? "Enviando..." : "Enviar enlace de recuperación"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        ¿Recordaste tu contraseña?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Volver al login
        </Link>
      </p>
    </Card>
  );
}
