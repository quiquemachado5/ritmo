"use client";

import { Beaker, Check, FlaskConical, Image as ImageIcon, RotateCcw, Sparkles } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { EXPERIMENTOS_POR_DEFECTO, guardarExperimentos, useExperimentos, type ExperimentosRitmo } from "@/lib/experiments";
import { estadoVisualRitmo } from "@/lib/model/insights";
import { PageHeader } from "@/components/app/primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MODULES: Array<{ key: keyof ExperimentosRitmo; title: string; description: string }> = [
  { key: "interfazViva", title: "Interfaz viva", description: "La atmósfera visual responde a tu constancia reciente sin cambiar el significado de los colores." },
  { key: "rescateAutomatico", title: "Modo rescate automático", description: "Tras tres días flojos, Hoy reduce el ruido y deja una única misión reversible." },
  { key: "detectorAvanzado", title: "Detector de señales", description: "Busca asociaciones repetidas entre sueño, deporte, alcohol, días de la semana y recuperación." },
  { key: "escenarios", title: "Escenarios contrafactuales", description: "Compara el peso orientativo a 7, 28 y 90 días para cada nivel posible de hábitos." },
  { key: "memoriaCorporal", title: "Memoria corporal", description: "Reconoce cuándo vuelves a un peso anterior y compara cómo llegaste entonces y ahora." },
  { key: "modoInvisible", title: "Lecturas en segundo plano", description: "Aparta de Hoy las lecturas estables que no requieren ninguna decisión." },
];

export function LaboratoryClient() {
  const { estado, userId } = useRitmo();
  const experiments = useExperimentos(userId);
  const pulse = estadoVisualRitmo(estado);
  const active = Object.values(experiments).filter(Boolean).length;
  const change = (key: keyof ExperimentosRitmo, value: boolean) => guardarExperimentos(userId, { ...experiments, [key]: value });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Laboratorio" description="Entorno privado para probar la experiencia antes de publicarla desde Administración." action={<span className="inline-flex items-center gap-1.5 rounded-lg bg-body-wash px-3 py-2 text-xs font-semibold text-body-ink"><Beaker className="size-4" /> {active}/{MODULES.length} activas</span>} />
      <section className="lab-pulse overflow-hidden rounded-2xl border border-primary/15 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" /></span><h2 className="mt-5 font-display text-3xl font-bold">Pulso {pulse.estado === "flujo" ? "fluido" : pulse.estado === "estable" ? "estable" : pulse.estado === "recuperacion" ? "en recuperación" : "neutro"}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{pulse.dias ? `${pulse.constancia}% de constancia en ${pulse.dias} días observados.` : "Todavía no hay días suficientes para modular la experiencia."} Estos controles solo cambian tu vista administradora.</p></div>
          <div className="flex gap-1.5" aria-label="Representación del pulso">{Array.from({ length: 7 }, (_, index) => <span key={index} className={cn("w-3 rounded-full bg-primary/20 transition-[height,background-color]", index < Math.round(pulse.constancia / 100 * 7) && "bg-primary", index % 3 === 0 ? "h-12" : index % 2 ? "h-7" : "h-9")} />)}</div>
        </div>
      </section>
      <Card className="gap-0 overflow-hidden p-0">
        {MODULES.map((module) => <div key={module.key} className="flex items-start gap-3 border-b border-border px-4 py-4 last:border-0 sm:px-5"><span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", experiments[module.key] ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{experiments[module.key] ? <Check className="size-4" /> : <FlaskConical className="size-4" />}</span><label className="min-w-0 flex-1" htmlFor={`lab-${module.key}`}><span className="block text-sm font-semibold">{module.title}</span><span className="mt-1 block max-w-2xl text-xs leading-relaxed text-muted-foreground">{module.description}</span></label><Switch id={`lab-${module.key}`} checked={experiments[module.key]} onCheckedChange={(value) => change(module.key, value)} aria-label={module.title} /></div>)}
      </Card>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="flex items-start gap-3"><ImageIcon className="mt-0.5 size-5 shrink-0 text-body" /><div><p className="text-sm font-semibold">Publicación separada de la prueba</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Activa aquí para probar en tu cuenta; decide la audiencia real en Administración → Funciones.</p></div></div><Button variant="secondary" onClick={() => guardarExperimentos(userId, EXPERIMENTOS_POR_DEFECTO)} className="gap-2"><RotateCcw className="size-4" /> Restaurar pruebas</Button></div>
    </div>
  );
}
