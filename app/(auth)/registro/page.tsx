"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [estado, setEstado] = React.useState<"form" | "confirmacion" | "exito">("form");

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Ingresa un correo.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();
      console.log("Intentando registrar:", email);

      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (signupError) {
        console.error("Error signup:", signupError);
        throw signupError;
      }

      console.log("Signup exitoso:", data);

      // Si el usuario se creó sin requerir confirmación, entra directamente
      if (data.session) {
        console.log("Sesión creada, entrando a la app");
        setEstado("exito");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      } else {
        console.log("Requiere confirmación de email");
        setEstado("confirmacion");
      }
    } catch (err) {
      console.error("Error completo:", err);
      const msg = err instanceof Error ? err.message : String(err);
      console.log("Mensaje de error:", msg);

      if (msg.includes("already registered") || msg.includes("User already exists"))
        setError("Ya existe una cuenta con ese correo. Ve a Inicia sesión.");
      else if (msg.includes("weak_password") || msg.includes("password"))
        setError("La contraseña es demasiado débil. Usa al menos 6 caracteres.");
      else if (msg.includes("Invalid email"))
        setError("El correo no es válido.");
      else if (msg.includes("400") || msg.includes("unauthorized"))
        setError("Error de conexión con el servidor. Verifica las credenciales de Supabase.");
      else
        setError(msg || "No se pudo crear la cuenta. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  if (estado === "exito") {
    return (
      <Card className="p-6 text-center">
        <CheckCircle className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 font-display text-xl font-bold">¡Bienvenido!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta se creó exitosamente. Entrando a RITMO...
        </p>
      </Card>
    );
  }

  if (estado === "confirmacion") {
    return (
      <Card className="p-6 text-center">
        <MailCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 font-display text-xl font-bold">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Te enviamos un enlace a <span className="font-medium text-foreground">{email}</span>. Ábrelo para activar tu cuenta.
        </p>
        <Button variant="outline" onClick={() => setEstado("form")} className="mt-4">
          Volver
        </Button>
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
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
          {cargando ? "Creando..." : "Crear cuenta"}
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
