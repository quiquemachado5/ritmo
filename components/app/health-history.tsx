"use client";

import * as React from "react";
import Link from "next/link";
import { Dumbbell, Footprints, MoonStar, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataSourceBadge } from "@/components/app/data-source";
import { healthWindow, type HealthDayPoint } from "@/lib/health-insights";
import { hoy } from "@/lib/model/dates";
import type { Estado } from "@/lib/model/types";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30] as const;

export function HealthHistory({ estado }: { estado: Estado }) {
  const [days, setDays] = React.useState<(typeof PERIODS)[number]>(30);
  const summary = React.useMemo(() => healthWindow(estado, days, hoy()), [days, estado]);

  if (summary.coveredDays === 0) {
    return <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-habit-wash text-habit"><Upload className="size-4" /></span><div><p className="text-sm font-semibold">Aún no hay actividad o descanso importados</p><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Importa Apple Health o Health Connect para ver pasos, sueño y entrenamientos junto a tu evolución.</p></div></div>
      <Button asChild variant="secondary" className="min-h-11 w-full rounded-xl sm:w-auto"><Link href="/ajustes#ajuste-salud">Importar datos</Link></Button>
    </Card>;
  }

  return <Card className="overflow-hidden p-0">
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0"><p className="text-sm font-semibold">Resumen del dispositivo</p><p className="mt-0.5 text-xs text-muted-foreground">{summary.coveredDays} de {days} días con alguna métrica disponible</p></div>
      <div className="flex items-center gap-2"><DataSourceBadge source="measured" detail="Métricas importadas desde una exportación de salud" compact /><div className="flex rounded-full bg-secondary p-0.5">{PERIODS.map((period) => <button key={period} type="button" onClick={() => setDays(period)} aria-pressed={days === period} className={cn("h-8 rounded-full px-3 text-xs font-semibold transition-colors", days === period ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{period} días</button>)}</div></div>
    </div>

    <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <HealthMetric icon={Footprints} label="Pasos medios" value={summary.steps.average == null ? "—" : new Intl.NumberFormat("es-ES").format(summary.steps.average)} detail={`${summary.steps.days} ${summary.steps.days === 1 ? "día medido" : "días medidos"}`} />
      <HealthMetric icon={MoonStar} label="Sueño medio" value={summary.sleep.averageMinutes == null ? "—" : formatDuration(summary.sleep.averageMinutes)} detail={`${summary.sleep.days} ${summary.sleep.days === 1 ? "noche medida" : "noches medidas"}`} />
      <HealthMetric icon={Dumbbell} label="Entrenamiento" value={summary.workout.days ? formatDuration(summary.workout.totalMinutes) : "—"} detail={`${summary.workout.days} ${summary.workout.days === 1 ? "día con datos" : "días con datos"}`} />
    </div>

    <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
      <Timeline label="Pasos" points={summary.points} getValue={(point) => point.steps} max={10_000} tone="bg-habit" format={(value) => `${new Intl.NumberFormat("es-ES").format(value)} pasos`} />
      <Timeline label="Sueño" points={summary.points} getValue={(point) => point.sleepMinutes} max={480} tone="bg-body" format={formatDuration} />
      <Timeline label="Entreno" points={summary.points} getValue={(point) => point.workoutMinutes} max={60} tone="bg-energy" format={formatDuration} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><span>{formatShortDate(summary.points[0].date)} — {formatShortDate(summary.points.at(-1)!.date)}</span><Link href="/ajustes#ajuste-salud" className="font-semibold text-primary underline-offset-2 hover:underline">Actualizar importación</Link></div>
    </div>
  </Card>;
}

function HealthMetric({ icon: Icon, label, value, detail }: { icon: typeof Footprints; label: string; value: string; detail: string }) {
  return <div className="flex items-start gap-3 px-4 py-4 sm:px-5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-display text-xl font-bold tabular">{value}</p><p className="mt-0.5 text-[0.7rem] text-muted-foreground">{detail}</p></div></div>;
}

function Timeline({ label, points, getValue, max, tone, format }: { label: string; points: HealthDayPoint[]; getValue: (point: HealthDayPoint) => number | null; max: number; tone: string; format: (value: number) => string }) {
  const values = points.flatMap((point) => getValue(point) == null ? [] : [getValue(point)!]);
  const summary = values.length ? `${label}: ${values.length} días con datos; último valor ${format(values.at(-1)!)}` : `${label}: sin datos en este periodo`;
  return <div className="grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-end gap-3" role="img" aria-label={summary}>
    <span className="pb-1 text-xs font-semibold">{label}</span>
    <div className="flex h-12 min-w-0 items-end gap-[2px] border-b border-border" aria-hidden="true">{points.map((point) => {
      const value = getValue(point);
      const height = value == null ? 0 : Math.max(5, Math.min(100, value / max * 100));
      return <span key={point.date} title={`${formatShortDate(point.date)} · ${value == null ? "sin datos" : format(value)}`} className={cn("min-w-0 flex-1 rounded-t-[2px]", value == null ? "h-1 border border-dashed border-border" : tone)} style={value == null ? undefined : { height: `${height}%` }} />;
    })}</div>
  </div>;
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}
