"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  const { actualizarPerfil, actualizarDia } = useRitmo();
  const [paso, setPaso] = React.useState(0);
  const [guardando, setGuardando] = React.useState(false);
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

  const num = (s: string) => parseFloat(s.replace(",", "."));
  const pasoValido =
    paso === 0
      ? d.nombre.trim().length > 0 && num(d.edad) >= 14 && num(d.edad) <= 100
      : paso === 1
        ? num(d.alturaCm) >= 120 && num(d.alturaCm) <= 230 && num(d.pesoActual) >= 25 && num(d.pesoObjetivo) >= 25
        : true;

  async function finalizar() {
    setGuardando(true);
    const peso = num(d.pesoActual);
    const alturaCm = num(d.alturaCm);
    const edad = num(d.edad);
    const tdee = tdeeTeorico({ peso, alturaCm, edad, sexo: d.sexo, factorActividad: d.factorActividad }) ?? 2200;
    const kcal =
      d.objetivo === "perder" ? tdee - 450 : d.objetivo === "ganar" ? tdee + 300 : tdee;
    const kcalObjetivo = Math.min(4000, Math.max(1200, Math.round(kcal / 10) * 10));

    await actualizarPerfil({
      nombre: d.nombre.trim(),
      sexo: d.sexo,
      edad,
      alturaCm,
      pesoObjetivo: Math.round(num(d.pesoObjetivo) * 10) / 10,
      objetivo: d.objetivo,
      factorActividad: d.factorActividad,
      kcalObjetivo,
      onboardingCompleto: true,
    });
    // Primer pesaje: ancla la predicción desde el día uno.
    await actualizarDia(hoy(), { peso: Math.round(peso * 10) / 10 });

    router.push("/");
    router.refresh();
  }

  const total = 3;

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between">
          <RitmoLogo />
          <span className="text-sm text-muted-foreground tabular">
            {paso + 1} / {total}
          </span>
        </div>

        {/* Progreso */}
        <div className="mb-8 flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= paso ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>

        <div className="flex-1">
          {paso === 0 && (
            <Step titulo="Empecemos por ti" sub="Personalizamos tu plan con estos datos.">
              <Campo label="¿Cómo te llamas?">
                <Input value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Tu nombre" autoFocus />
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
              <Campo label="Edad">
                <Input inputMode="numeric" value={d.edad} onChange={(e) => set("edad", e.target.value)} placeholder="34" className="tabular" />
              </Campo>
            </Step>
          )}

          {paso === 1 && (
            <Step titulo="Tus cifras" sub="La báscula y el objetivo anclan la predicción.">
              <Campo label="Altura (cm)">
                <Input inputMode="numeric" value={d.alturaCm} onChange={(e) => set("alturaCm", e.target.value)} placeholder="185" className="tabular" autoFocus />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Peso de HOY (kg)" ayuda="Se guarda como pesaje de hoy. Si tu última báscula es de otro día, impórtala o regístrala luego con su fecha.">
                  <Input inputMode="decimal" value={d.pesoActual} onChange={(e) => set("pesoActual", e.target.value)} placeholder="88,5" className="tabular" />
                </Campo>
                <Campo label="Peso objetivo (kg)">
                  <Input inputMode="decimal" value={d.pesoObjetivo} onChange={(e) => set("pesoObjetivo", e.target.value)} placeholder="82" className="tabular" />
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
            </Step>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          {paso > 0 && (
            <Button variant="secondary" onClick={() => setPaso((p) => p - 1)} className="gap-2">
              <ArrowLeft className="size-4" /> Atrás
            </Button>
          )}
          {paso < total - 1 ? (
            <Button onClick={() => setPaso((p) => p + 1)} disabled={!pasoValido} className="flex-1 gap-2">
              Continuar <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={finalizar} disabled={guardando} className="flex-1 gap-2">
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Empezar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {ayuda && <p className="text-[0.7rem] leading-snug text-muted-foreground">{ayuda}</p>}
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
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition-colors",
        full ? "" : "text-center",
        activo ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
