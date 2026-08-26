"use client";

import { fmtFechaCorta } from "@/lib/format";

import * as React from "react";
import dynamic from "next/dynamic";
import { Check, Flame } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { resumen, adherenciaPorHabito } from "@/lib/model/analytics";
import { HABITOS } from "@/lib/model/config";
import { DIAS_SEMANA, diaSemanaLunes, hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

const Heatmap = dynamic(() => import("@/components/app/heatmap").then((m) => m.Heatmap), {
  loading: () => <Skeleton className="h-36 w-full rounded-xl" />,
});

const ESCALA_CUMPLIMIENTO = [
  { superficie: "border-destructive/25 bg-destructive/5", barra: "bg-destructive", tinta: "text-destructive" },
  { superficie: "border-energy-border bg-energy-wash", barra: "bg-energy", tinta: "text-energy" },
  { superficie: "border-energy-border bg-energy-wash", barra: "bg-energy", tinta: "text-energy" },
  { superficie: "border-habit-border bg-habit-wash", barra: "bg-habit", tinta: "text-habit-ink" },
  { superficie: "border-habit-border bg-habit-wash", barra: "bg-habit", tinta: "text-habit-ink" },
  { superficie: "border-weight-border bg-weight-wash", barra: "bg-primary", tinta: "text-weight" },
  { superficie: "border-weight-border bg-weight-wash", barra: "bg-primary", tinta: "text-weight" },
] as const;

function tonoCumplimiento(valor: number, maximo = HABITOS.length) {
  const nivel = Math.max(0, Math.min(ESCALA_CUMPLIMIENTO.length - 1, Math.round((valor / maximo) * (ESCALA_CUMPLIMIENTO.length - 1))));
  return ESCALA_CUMPLIMIENTO[nivel];
}

export default function HabitosPage() {
  const { estado, cargando, dia, alternarHabito } = useRitmo();
  const hoyISO = hoy();
  const r = React.useMemo(() => resumen(estado), [estado]);
  const porHabito = React.useMemo(() => adherenciaPorHabito(estado, HABITOS, 30), [estado]);
  const diaHoy = dia(hoyISO);
  const semanaReciente = React.useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(hoyISO, i - 6);
    const cumplidos = HABITOS.filter((h) => estado.dias[fecha]?.habitos?.[h.clave] === true).length;
    return { fecha, cumplidos, esHoy: fecha === hoyISO };
  }), [estado.dias, hoyISO]);

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  const sinRacha = r.habitos.rachaActual.longitud === 0;
  const tonoRacha = sinRacha ? ESCALA_CUMPLIMIENTO[0] : null;
  const tonoSemana = tonoCumplimiento(r.habitos.adherencia7, 100);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Hábitos</h1>
      </header>

      {/* Rachas */}
      <div className="grid gap-3 lg:grid-cols-[minmax(15rem,.72fr)_minmax(0,1.28fr)]">
        <Card className={cn("gap-0 overflow-hidden p-4 sm:p-5", sinRacha ? tonoRacha!.superficie : "border-streak/20 bg-streak/5")}>
          <div className={cn("flex items-center gap-2", sinRacha ? tonoRacha!.tinta : "text-streak")}><span className="grid size-8 place-items-center rounded-xl bg-card shadow-sm"><Flame className="size-4" /></span><p className="text-sm font-semibold">Racha actual</p></div>
          <div className="mt-5 flex items-end gap-2"><span className={cn("font-display text-5xl font-bold leading-none tabular", sinRacha ? tonoRacha!.tinta : "text-streak")}>{r.habitos.rachaActual.longitud}</span><span className={cn("mb-1 text-sm font-medium", sinRacha ? tonoRacha!.tinta : "text-streak/80")}>días</span></div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {r.habitos.rachaActual.longitud > 0 ? `Los 6 hábitos, sin fallar · desde el ${fmtFechaCorta(r.habitos.rachaActual.desde!)}` : "Completa los 6 hábitos hoy para iniciar una nueva racha."}
          </p>
        </Card>
        <Card className="gap-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-display text-lg font-bold">Últimos 7 días</h2><p className="mt-0.5 text-xs text-muted-foreground">Tu ritmo reciente, de un vistazo.</p></div>
            <div className="shrink-0 text-right"><p className={cn("font-display text-3xl font-bold leading-none tabular", tonoSemana.tinta)}>{r.habitos.adherencia7}%</p><p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">constancia</p></div>
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="list" aria-label="Cumplimiento de hábitos de los últimos siete días">
            {semanaReciente.map((d) => {
              const altura = (d.cumplidos / HABITOS.length) * 100;
              const tono = tonoCumplimiento(d.cumplidos);
              return <div key={d.fecha} role="listitem" aria-label={`${DIAS_SEMANA[diaSemanaLunes(d.fecha)]}: ${d.cumplidos} de ${HABITOS.length} hábitos`} className={cn("min-w-0 rounded-xl border p-1.5 text-center sm:p-2", tono.superficie, d.esHoy && "ring-1 ring-habit-border")}>
                <p className={cn("truncate text-[0.65rem] font-semibold sm:text-xs", d.esHoy ? "text-habit-ink" : "text-muted-foreground")}>{DIAS_SEMANA[diaSemanaLunes(d.fecha)]}</p>
                <div className="mt-2 flex h-11 items-end rounded-lg bg-card/85 p-1" aria-hidden="true">
                  <div className={cn("w-full rounded-md transition-[height] duration-500", tono.barra)} style={{ height: `${altura}%` }} />
                </div>
                <p className={cn("mt-1.5 font-display text-lg font-bold leading-none tabular", tono.tinta)}>{d.cumplidos}<span className="ml-0.5 text-[0.6rem] font-medium text-muted-foreground">/6</span></p>
              </div>;
            })}
          </div>
        </Card>
      </div>

      {/* Hoy */}
      <section>
        <SectionLabel>Marca los de hoy</SectionLabel>
        <Card className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {HABITOS.map((h) => {
            const hecho = diaHoy.habitos?.[h.clave] === true;
            return (
              <button
                key={h.clave}
                onClick={() => alternarHabito(hoyISO, h.clave)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  hecho ? "border-primary/40 bg-primary/8 text-foreground" : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", hecho ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {hecho && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="truncate">{h.etiqueta}</span>
              </button>
            );
          })}
        </Card>
      </section>

      {/* Progreso por hábito */}
      <section>
        <SectionLabel>Cumplimiento (30 días)</SectionLabel>
        <Card className="flex flex-col gap-3 p-5">
          {porHabito.map((h) => {
            const tono = tonoCumplimiento(h.pct, 100);
            return (
              <div key={h.clave} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{h.etiqueta}</span>
                <span className="tabular text-muted-foreground">
                  <span className={cn("font-semibold", tono.tinta)}>{h.pct}%</span> · {h.hechos}/{h.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className={cn("h-full rounded-full transition-[width] duration-700", tono.barra)} style={{ width: `${h.pct}%` }} />
              </div>
              </div>
            );
          })}
        </Card>
      </section>

      {/* Heatmap */}
      <section>
        <SectionLabel>Constancia</SectionLabel>
        <Card className="p-5">
          <Heatmap estado={estado} />
          <p className="mt-2 text-xs text-muted-foreground">
            Cada casilla es un día; cuanto más intensa, más hábitos cumpliste. Desplázate en horizontal para ver todo el histórico.
          </p>
        </Card>
      </section>
    </div>
  );
}
