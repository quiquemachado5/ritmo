"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export default function RegistroPage() {
  const router = useRouter();
  const configurado = isSupabaseConfigured();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmar, setConfirmar] = React.useState(false);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCargando(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) throw error;
      if (data.session) {
        router.push("/onboarding");
        router.refresh();
      } else {
        setConfirmar(true);
        setCargando(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
      setCargando(false);
    }
  }

  if (!configurado) {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-display text-xl font-bold">Modo demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El registro requiere Supabase. Mientras tanto, prueba RITMO con datos de ejemplo.
        </p>
        <Button asChild className="mt-5 w-full">
          <Link href="/">Entrar a la demo</Link>
        </Button>
      </Card>
    );
  }

  if (confirmar) {
    return (
      <Card className="p-6 text-center">
        <MailCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 font-display text-xl font-bold">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Te enviamos un enlace de confirmación a <span className="font-medium text-foreground">{email}</span>. Ábrelo para activar tu cuenta.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold">Crea tu cuenta</h1>
      <p className="mt-1 text-sm text-muted-foreground">Empieza a construir tu ritmo hoy.</p>
      <form onSubmit={registrar} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={cargando} className="gap-2">
          {cargando && <Loader2 className="size-4 animate-spin" />}
          Crear cuenta
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
