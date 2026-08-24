"use client";

import { fmtFechaCorta } from "@/lib/format";

import * as React from "react";
import { Check, Flame, Trophy } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { resumen, adherenciaPorHabito } from "@/lib/model/analytics";
import { HABITOS } from "@/lib/model/config";
import { hoy } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heatmap } from "@/components/app/heatmap";
import { Metric, SectionLabel } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

export default function HabitosPage() {
  const { estado, cargando, dia, alternarHabito } = useRitmo();
  const hoyISO = hoy();
  const r = React.useMemo(() => resumen(estado), [estado]);
  const porHabito = React.useMemo(() => adherenciaPorHabito(estado, HABITOS, 30), [estado]);
  const diaHoy = dia(hoyISO);

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Hábitos</h1>
      </header>

      {/* Rachas */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col items-center gap-1 p-4 text-center">
          <Flame className="size-5 text-streak" />
          <span className="font-display text-2xl font-bold tabular text-streak">{r.habitos.rachaActual.longitud}</span>
          <span className="text-[0.7rem] text-muted-foreground">racha actual</span>
          <span className="text-[0.65rem] text-muted-foreground/70">
            {r.habitos.rachaActual.longitud > 0 ? `desde el ${fmtFechaCorta(r.habitos.rachaActual.desde!)}` : "los 6 hábitos, sin fallar"}
          </span>
        </Card>
        <Card className="flex flex-col items-center gap-1 p-4 text-center">
          <Trophy className="size-5 text-habit" />
          <span className="font-display text-2xl font-bold tabular text-habit">{r.habitos.mejorRacha.longitud}</span>
          <span className="text-[0.7rem] text-muted-foreground">mejor racha</span>
          <span className="text-[0.65rem] text-muted-foreground/70">
            {r.habitos.mejorRacha.longitud > 0
              ? `${fmtFechaCorta(r.habitos.mejorRacha.desde!)} – ${fmtFechaCorta(r.habitos.mejorRacha.hasta!)}`
              : "aún sin racha"}
          </span>
        </Card>
        <Card className="flex flex-col items-center gap-1 p-4 text-center">
          <span className="font-display text-2xl font-bold tabular text-primary">{r.habitos.adherencia7}%</span>
          <span className="text-[0.7rem] text-muted-foreground">últimos 7 días</span>
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
