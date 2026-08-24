"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

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
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Ingresa tu correo.");
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();
      console.log("Intentando entrar:", email);

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.error("Error login:", loginError);
        throw loginError;
      }

      console.log("Login exitoso:", data);
      router.push(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      console.error("Error completo:", err);
      const msg = err instanceof Error ? err.message : String(err);
      console.log("Mensaje de error:", msg);

      if (msg.includes("Invalid login") || msg.includes("Invalid credentials"))
        setError("Correo o contraseña incorrectos.");
      else if (msg.includes("Email not confirmed"))
        setError("Tu correo aún no está confirmado. Revisa tu bandeja de entrada.");
      else if (msg.includes("400") || msg.includes("unauthorized"))
        setError("Error de conexión. Verifica las credenciales de Supabase.");
      else if (msg.includes("User not found"))
        setError("No existe una cuenta con ese correo.");
      else
        setError(msg || "No se pudo iniciar sesión. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold">Inicia sesión</h1>
      <p className="mt-1 text-sm text-muted-foreground">Bienvenido de vuelta a tu ritmo.</p>
      <form onSubmit={entrar} className="mt-5 flex flex-col gap-4">
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          {cargando ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary hover:underline">
          Crear una
        </Link>
      </p>
      <p className="mt-3 text-center text-[0.65rem] text-muted-foreground/50">
        Tus datos se guardan cifrados en Supabase. RITMO no comparte información con terceros.
      </p>
    </Card>
  );
}
