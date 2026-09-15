"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RitmoLogo } from "@/components/ritmo-mark";
import { useRitmo } from "@/lib/store/provider";
import { FACTORES_ACTIVIDAD, tdeeTeorico } from "@/lib/model/metrics";
import { hoy } from "@/lib/model/dates";
import type { Objetivo, Sexo } from "@/lib/model/types";
import { createClient } from "@/lib/supabase/client";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

interface Datos {
  nombre: string;
  sexo: Sexo;
  edad: string;
  alturaCm: string;
  pesoActual: string;
  pesoObjetivo: string;
  objetivo: Objetivo;
  factorActividad: number;
}

const OBJETIVOS: { id: Objetivo; label: string; desc: string }[] = [
  { id: "perder", label: "Perder grasa", desc: "Déficit calórico sostenible" },
  { id: "mantener", label: "Mantenerme", desc: "Sostener mi peso y hábitos" },
  { id: "ganar", label: "Ganar músculo", desc: "Superávit controlado" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { estado, cargando, actualizarPerfil, actualizarDia } = useRitmo();
  const [paso, setPaso] = React.useState(0);
  const [guardando, setGuardando] = React.useState(false);
  const [errorGuardado, setErrorGuardado] = React.useState<string | null>(null);
  const [mostrarErrores, setMostrarErrores] = React.useState(false);
  const [consentimiento, setConsentimiento] = React.useState(false);
  const guardadoEnCurso = React.useRef(false);
  const [d, setD] = React.useState<Datos>({
    nombre: "",
    sexo: "hombre",
    edad: "",
    alturaCm: "",
    pesoActual: "",
    pesoObjetivo: "",
    objetivo: "perder",
    factorActividad: 1.375,
  });
  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => setD((s) => ({ ...s, [k]: v }));

  const num = (s: string) => /^\d+(?:[.,]\d+)?$/.test(s.trim()) ? Number(s.trim().replace(",", ".")) : NaN;
  const errores = {
    edad: num(d.edad) >= 18 && num(d.edad) <= 120 && Number.isInteger(num(d.edad)) ? undefined : "Introduce una edad entre 18 y 120 años, sin decimales.",
    altura: num(d.alturaCm) >= 100 && num(d.alturaCm) <= 250 && Number.isInteger(num(d.alturaCm)) ? undefined : "Introduce una altura entre 100 y 250 cm, sin decimales.",
    pesoActual: !d.pesoActual.trim() || (num(d.pesoActual) >= 25 && num(d.pesoActual) <= 400) ? undefined : "Introduce un peso entre 25 y 400 kg.",
    pesoObjetivo: !d.pesoObjetivo.trim() || (num(d.pesoObjetivo) >= 30 && num(d.pesoObjetivo) <= 300) ? undefined : "Introduce un peso entre 30 y 300 kg.",
  };

  React.useEffect(() => {
    document.getElementById("onboarding-title")?.focus();
  }, [paso]);

  function continuar(event: React.FormEvent) {
    event.preventDefault();
    if (guardadoEnCurso.current || cargando) return;
    const campoInvalido = paso === 0 ? (errores.edad ? "edad" : null) : paso === 1 ? (["altura", "pesoActual", "pesoObjetivo"] as const).find(campo => errores[campo]) : paso === 2 && !consentimiento ? "consentimiento-salud" : null;
    if (campoInvalido) {
      setMostrarErrores(true);
      document.getElementById(campoInvalido)?.focus();
      return;
    }
    setMostrarErrores(false);
    if (paso < 2) setPaso(p => p + 1);
    else void finalizar();
  }

  async function finalizar() {
    if (guardadoEnCurso.current || cargando || Object.values(errores).some(Boolean) || !consentimiento) return;
    guardadoEnCurso.current = true;
    setGuardando(true);
    setErrorGuardado(null);
    const peso = num(d.pesoActual);
    const alturaCm = num(d.alturaCm);
    const edad = num(d.edad);
    const tdee = Number.isFinite(peso) ? tdeeTeorico({ peso, alturaCm, edad, sexo: d.sexo, factorActividad: d.factorActividad }) : null;
    const kcal =
      tdee == null ? estado.perfil.kcalObjetivo : d.objetivo === "perder" ? tdee - 450 : d.objetivo === "ganar" ? tdee + 300 : tdee;
    const kcalObjetivo = Math.min(4000, Math.max(1200, Math.round(kcal / 10) * 10));

    try {
      const { error: consentimientoError } = await createClient().rpc("ritmo_grant_health_consent", { p_version: PRIVACY_NOTICE_VERSION });
      if (consentimientoError) {
        setErrorGuardado("No se ha podido guardar tu consentimiento. Tus datos siguen aquí; vuelve a intentarlo.");
        return;
      }
      // El primer pesaje debe confirmarse antes de cerrar la configuración.
      if (Number.isFinite(peso) && !await actualizarDia(hoy(), { peso: Math.round(peso * 10) / 10 })) {
        setErrorGuardado("No se ha podido guardar tu primer pesaje. Tus datos siguen aquí; vuelve a intentarlo.");
        return;
      }
      const perfilGuardado = await actualizarPerfil({
        nombre: d.nombre.trim() || undefined,
        sexo: d.sexo,
        edad,
        alturaCm,
        pesoObjetivo: d.pesoObjetivo.trim() ? Math.round(num(d.pesoObjetivo) * 10) / 10 : undefined,
        objetivo: d.objetivo,
        factorActividad: d.factorActividad,
        kcalObjetivo,
        onboardingCompleto: true,
      });
      if (!perfilGuardado) {
        setErrorGuardado("No se ha podido confirmar tu perfil. Tus datos siguen aquí; vuelve a intentarlo.");
        return;
      }

      router.replace("/?focus=habitos");
      router.refresh();
    } catch {
      setErrorGuardado("No hemos podido completar la configuración. Revisa tu conexión y vuelve a intentarlo.");
    } finally {
      guardadoEnCurso.current = false;
      setGuardando(false);
    }
  }

  const total = 3;

  return (
    <main className="flex min-h-dvh flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between">
          <RitmoLogo />
          <span className="text-sm text-muted-foreground tabular">
            {paso + 1} / {total}
          </span>
        </div>

        {/* Progreso */}
        <div className="mb-8 flex gap-1.5" role="progressbar" aria-label="Configuración inicial" aria-valuemin={0} aria-valuemax={total} aria-valuenow={paso + 1} aria-valuetext={`Paso ${paso + 1} de ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= paso ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>

        <form onSubmit={continuar} className="flex flex-1 flex-col" aria-busy={guardando || cargando} noValidate>
        <fieldset disabled={guardando || cargando} className="flex-1">
          {paso === 0 && (
            <Step titulo="Empecemos por ti" sub="Personalizamos tu plan con estos datos.">
              <Campo label="¿Cómo te llamas? (opcional)" htmlFor="nombre">
                <Input id="nombre" name="given-name" autoComplete="given-name" maxLength={80} value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Tu nombre" className="h-12" />
              </Campo>
              <Campo label="Sexo biológico">
                <div className="grid grid-cols-2 gap-2">
                  {(["hombre", "mujer"] as Sexo[]).map((s) => (
                    <Opcion key={s} activo={d.sexo === s} onClick={() => set("sexo", s)}>
                      {s === "hombre" ? "Hombre" : "Mujer"}
                    </Opcion>
                  ))}
                </div>
              </Campo>
              <Campo label="Edad" htmlFor="edad" ayuda="RITMO está dirigida a personas mayores de 18 años." error={mostrarErrores ? errores.edad : undefined}>
                <Input id="edad" inputMode="numeric" required aria-invalid={mostrarErrores && !!errores.edad} aria-describedby="edad-help" value={d.edad} onChange={(e) => set("edad", e.target.value)} placeholder="34" className="h-12 tabular" />
              </Campo>
            </Step>
          )}

          {paso === 1 && (
            <Step titulo="Tus cifras" sub="Puedes dejar el peso para otro momento. Se necesita un primer pesaje para estimar tu evolución.">
              <Campo label="Altura (cm)" htmlFor="altura" error={mostrarErrores ? errores.altura : undefined}>
                <Input id="altura" inputMode="numeric" required aria-invalid={mostrarErrores && !!errores.altura} aria-describedby={mostrarErrores && errores.altura ? "altura-help" : undefined} value={d.alturaCm} onChange={(e) => set("alturaCm", e.target.value)} placeholder="185" className="h-12 tabular" />
              </Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Peso de hoy (kg, opcional)" htmlFor="pesoActual" ayuda="Si es de otro día, regístralo luego con su fecha. Sin pesaje, el objetivo calórico será provisional." error={mostrarErrores ? errores.pesoActual : undefined}>
                  <Input id="pesoActual" inputMode="decimal" aria-invalid={mostrarErrores && !!errores.pesoActual} aria-describedby="pesoActual-help" value={d.pesoActual} onChange={(e) => set("pesoActual", e.target.value)} placeholder="88,5" className="h-12 tabular" />
                </Campo>
                <Campo label="Peso objetivo (kg, opcional)" htmlFor="pesoObjetivo" error={mostrarErrores ? errores.pesoObjetivo : undefined}>
                  <Input id="pesoObjetivo" inputMode="decimal" aria-invalid={mostrarErrores && !!errores.pesoObjetivo} aria-describedby={mostrarErrores && errores.pesoObjetivo ? "pesoObjetivo-help" : undefined} value={d.pesoObjetivo} onChange={(e) => set("pesoObjetivo", e.target.value)} placeholder="82" className="h-12 tabular" />
                </Campo>
              </div>
            </Step>
          )}

          {paso === 2 && (
            <Step titulo="Tu objetivo" sub="Ajustaremos tus calorías a partir de esto.">
              <Campo label="¿Qué buscas?">
                <div className="grid gap-2">
                  {OBJETIVOS.map((o) => (
                    <Opcion key={o.id} activo={d.objetivo === o.id} onClick={() => set("objetivo", o.id)} full>
                      <span className="font-semibold">{o.label}</span>
                      <span className="block text-xs text-muted-foreground">{o.desc}</span>
                    </Opcion>
                  ))}
                </div>
              </Campo>
              <Campo label="Nivel de actividad">
                <div className="grid gap-2">
                  {FACTORES_ACTIVIDAD.map((f) => (
                    <Opcion key={f.clave} activo={d.factorActividad === f.factor} onClick={() => set("factorActividad", f.factor)} full>
                      <span className="font-semibold">{f.etiqueta}</span>
                      <span className="block text-xs text-muted-foreground">{f.detalle}</span>
                    </Opcion>
                  ))}
                </div>
              </Campo>
              <div className="rounded-xl border border-border bg-secondary/35 p-3">
                <label htmlFor="consentimiento-salud" className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                  <input id="consentimiento-salud" type="checkbox" checked={consentimiento} onChange={(event) => setConsentimiento(event.target.checked)} aria-describedby="consentimiento-salud-ayuda" className="mt-1 size-4 shrink-0 accent-primary" />
                  <span>Consiento expresamente que RITMO trate los datos de salud y bienestar que introduzca para mostrarme seguimiento, cálculos y predicciones personales.</span>
                </label>
                <p id="consentimiento-salud-ayuda" className={cn("mt-2 text-xs leading-relaxed", mostrarErrores && !consentimiento ? "text-destructive" : "text-muted-foreground")}>
                  {mostrarErrores && !consentimiento ? "Necesitamos tu consentimiento explícito antes de guardar estos datos. " : "Puedes retirarlo eliminando tus datos de RITMO. "}<Link href="/privacidad" target="_blank" className="font-medium text-primary underline underline-offset-2">Lee la información de privacidad</Link>.
                </p>
              </div>
            </Step>
          )}
        </fieldset>

        {errorGuardado && <p role="alert" className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{errorGuardado}</p>}

        <div className="mt-8 flex gap-3">
          {paso > 0 && (
            <Button type="button" variant="secondary" disabled={guardando || cargando} onClick={() => { setMostrarErrores(false); setPaso((p) => p - 1); }} className="min-h-12 gap-2">
              <ArrowLeft className="size-4" /> Atrás
            </Button>
          )}
          {paso < total - 1 ? (
            <Button type="submit" disabled={guardando || cargando} className="min-h-12 flex-1 gap-2">
              Continuar <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={guardando || cargando} className="min-h-12 flex-1 gap-2">
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {guardando ? "Guardando…" : errorGuardado ? "Reintentar" : "Empezar"}
            </Button>
          )}
        </div>
        </form>
      </div>
    </main>
  );
}

function Step({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 id="onboarding-title" tabIndex={-1} className="font-display text-2xl font-bold tracking-tight focus:outline-none">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function Campo({ label, ayuda, htmlFor, error, children }: { label: string; ayuda?: string; htmlFor?: string; error?: string; children: React.ReactNode }) {
  const labelId = React.useId();
  return (
    <div className="flex flex-col gap-2" role={htmlFor ? undefined : "group"} aria-labelledby={htmlFor ? undefined : labelId}>
      <Label id={labelId} htmlFor={htmlFor}>{label}</Label>
      {children}
      {(error || ayuda) && <p id={htmlFor ? `${htmlFor}-help` : undefined} role={error ? "alert" : undefined} className={cn("text-xs leading-relaxed", error ? "text-destructive" : "text-muted-foreground")}>{error || ayuda}</p>}
    </div>
  );
}

function Opcion({
  children,
  activo,
  onClick,
  full,
}: {
  children: React.ReactNode;
  activo: boolean;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "min-h-12 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
        full ? "" : "text-center",
        activo ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
