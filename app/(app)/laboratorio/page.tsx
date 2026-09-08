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

const MODULOS: Array<{ clave: keyof ExperimentosRitmo; titulo: string; descripcion: string }> = [
  { clave: "interfazViva", titulo: "Interfaz viva", descripcion: "La atmósfera visual responde a tu constancia reciente sin cambiar el significado de los colores." },
  { clave: "rescateAutomatico", titulo: "Modo rescate automático", descripcion: "Tras tres días flojos, Hoy reduce el ruido y te deja una única misión reversible." },
  { clave: "detectorAvanzado", titulo: "Detector de señales", descripcion: "Busca asociaciones repetidas entre sueño, deporte, alcohol, días de la semana y recuperación." },
  { clave: "escenarios", titulo: "Escenarios contrafactuales", descripcion: "Compara el peso orientativo a 7, 28 y 90 días para cada nivel posible de hábitos." },
  { clave: "memoriaCorporal", titulo: "Memoria corporal", descripcion: "Reconoce cuándo vuelves a un peso antiguo y compara cómo llegaste entonces y ahora." },
];

export default function LaboratorioPage() {
  const { estado, userId } = useRitmo();
  const experimentos = useExperimentos(userId);
  const pulso = estadoVisualRitmo(estado);
  const activos = Object.values(experimentos).filter(Boolean).length;
  function cambiar(clave: keyof ExperimentosRitmo, valor: boolean) { guardarExperimentos(userId, { ...experimentos, [clave]: valor }); }
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Laboratorio" description="Funciones ambiciosas, transparentes y reversibles. Tus datos no cambian al activar o desactivar una experiencia." action={<span className="inline-flex items-center gap-1.5 rounded-lg bg-body-wash px-3 py-2 text-xs font-semibold text-body-ink"><Beaker className="size-4" /> {activos}/{MODULOS.length} activas</span>} />
      <section className="lab-pulse overflow-hidden rounded-2xl border border-primary/15 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" /></span><h2 className="mt-5 font-display text-3xl font-bold">El pulso actual es {pulso.estado === "flujo" ? "fluido" : pulso.estado === "estable" ? "estable" : pulso.estado === "recuperacion" ? "de recuperación" : "neutro"}.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{pulso.dias ? `${pulso.constancia}% de constancia en ${pulso.dias} días observados.` : "Todavía no hay días suficientes para modular la experiencia."} El contenido y los cálculos permanecen iguales.</p></div><div className="flex gap-1.5" aria-label="Representación del pulso">{Array.from({ length: 7 }, (_, i) => <span key={i} className={cn("w-3 rounded-full bg-primary/20 transition-[height,background-color]", i < Math.round(pulso.constancia / 100 * 7) && "bg-primary", i % 3 === 0 ? "h-12" : i % 2 ? "h-7" : "h-9")} />)}</div></div>
      </section>
      <Card className="gap-0 overflow-hidden p-0">
        {MODULOS.map((modulo) => <div key={modulo.clave} className="flex items-start gap-3 border-b border-border px-4 py-4 last:border-0 sm:px-5"><span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", experimentos[modulo.clave] ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{experimentos[modulo.clave] ? <Check className="size-4" /> : <FlaskConical className="size-4" />}</span><label className="min-w-0 flex-1" htmlFor={`lab-${modulo.clave}`}><span className="block text-sm font-semibold">{modulo.titulo}</span><span className="mt-1 block max-w-2xl text-xs leading-relaxed text-muted-foreground">{modulo.descripcion}</span></label><Switch id={`lab-${modulo.clave}`} checked={experimentos[modulo.clave]} onCheckedChange={(valor) => cambiar(modulo.clave, valor)} aria-label={modulo.titulo} /></div>)}
      </Card>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="flex items-start gap-3"><ImageIcon className="mt-0.5 size-5 shrink-0 text-body" /><div><p className="text-sm font-semibold">Póster mensual editorial</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ya es una función estable: se genera localmente desde Hoy y permite ocultar peso o comidas.</p></div></div><Button variant="secondary" onClick={() => guardarExperimentos(userId, EXPERIMENTOS_POR_DEFECTO)} className="gap-2"><RotateCcw className="size-4" /> Restaurar laboratorio</Button></div>
    </div>
  );
}
