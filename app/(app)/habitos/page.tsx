"use client";

import { fmtFechaCorta } from "@/lib/format";

import * as React from "react";
import { Check, Flame } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { resumen, adherenciaPorHabito } from "@/lib/model/analytics";
import { HABITOS } from "@/lib/model/config";
import { DIAS_SEMANA, diaSemanaLunes, hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heatmap } from "@/components/app/heatmap";
import { SectionLabel } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Hábitos</h1>
      </header>

      {/* Rachas */}
      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,.65fr)_minmax(0,1.35fr)]">
        <Card className="flex flex-col items-center gap-1 p-4 text-center">
          <Flame className="size-5 text-streak" />
          <span className="font-display text-2xl font-bold tabular text-streak">{r.habitos.rachaActual.longitud}</span>
          <span className="text-[0.7rem] text-muted-foreground">racha actual</span>
          <span className="text-[0.65rem] text-muted-foreground/70">
            {r.habitos.rachaActual.longitud > 0 ? `desde el ${fmtFechaCorta(r.habitos.rachaActual.desde!)}` : "los 6 hábitos, sin fallar"}
          </span>
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary/35 px-4 py-3 sm:px-5">
            <div><h2 className="font-display text-lg font-bold">Últimos 7 días</h2><p className="text-xs text-muted-foreground">Tu ritmo reciente, día a día.</p></div>
            <span className="font-display text-2xl font-bold tabular text-primary">{r.habitos.adherencia7}%</span>
          </div>
          <div className="grid grid-cols-7 gap-px bg-border">
            {semanaReciente.map((d) => {
              const completo = d.cumplidos === HABITOS.length;
              const activo = d.cumplidos > 0;
              return <div key={d.fecha} className={cn("min-w-0 bg-card px-1 py-3 text-center sm:py-4", d.esHoy && "bg-habit-wash")}>
                <p className={cn("text-xs font-semibold", d.esHoy ? "text-habit-ink" : "text-muted-foreground")}>{DIAS_SEMANA[diaSemanaLunes(d.fecha)]}</p>
                <p className={cn("mt-2 font-display text-xl font-bold tabular", completo ? "text-primary" : activo ? "text-habit" : "text-muted-foreground")}>{d.cumplidos}</p>
                <p className="text-[0.65rem] text-muted-foreground">de {HABITOS.length}</p>
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
          {porHabito.map((h) => (
            <div key={h.clave} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{h.etiqueta}</span>
                <span className="tabular text-muted-foreground">
                  <span className="font-semibold text-foreground">{h.pct}%</span> · {h.hechos}/{h.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-habit transition-[width] duration-700" style={{ width: `${h.pct}%` }} />
              </div>
            </div>
          ))}
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
