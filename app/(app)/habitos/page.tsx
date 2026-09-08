"use client";

import { capitalizar, fmtFechaCorta, fmtFechaLarga } from "@/lib/format";

import * as React from "react";
import dynamic from "next/dynamic";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { resumen, adherenciaPorHabito } from "@/lib/model/analytics";
import { habitosModelo } from "@/lib/model/config";
import { DIAS_SEMANA, diaSemanaLunes, hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { evaluarCicloModelos } from "@/lib/model-audit/lifecycle";

const Heatmap = dynamic(() => import("@/components/app/heatmap").then((m) => m.Heatmap), {
  loading: () => <Skeleton className="h-36 w-full rounded-xl" />,
});

const ESCALA_CUMPLIMIENTO = [
  { superficie: "border-destructive/30 bg-destructive/5", barra: "bg-destructive", tinta: "text-destructive" },
  { superficie: "border-energy-border bg-energy-wash", barra: "bg-energy", tinta: "text-energy" },
  { superficie: "border-warning-border bg-warning-wash", barra: "bg-warning", tinta: "text-warning-ink" },
  { superficie: "border-habit-border bg-habit-wash", barra: "bg-habit", tinta: "text-habit-ink" },
  { superficie: "border-primary/20 bg-primary/8", barra: "bg-primary/55", tinta: "text-weight" },
  { superficie: "border-primary/35 bg-primary/12", barra: "bg-primary/75", tinta: "text-weight" },
  { superficie: "border-primary/45 bg-weight-wash", barra: "bg-primary", tinta: "text-primary" },
] as const;

function tonoCumplimiento(valor: number, maximo: number) {
  const nivel = Math.max(0, Math.min(ESCALA_CUMPLIMIENTO.length - 1, Math.round((valor / maximo) * (ESCALA_CUMPLIMIENTO.length - 1))));
  return ESCALA_CUMPLIMIENTO[nivel];
}

export default function HabitosPage() {
  const { estado, auditoriaModelo, cargando, dia, alternarHabito } = useRitmo();
  const hoyISO = hoy();
  const [fechaSeleccionada, setFechaSeleccionada] = React.useState(hoyISO);
  const editorRef = React.useRef<HTMLElement>(null);
  const cicloModelo = React.useMemo(
    () => evaluarCicloModelos(estado, auditoriaModelo.predicciones, hoyISO),
    [estado, auditoriaModelo.predicciones, hoyISO],
  );
  const r = React.useMemo(() => resumen(estado, cicloModelo.estrategia), [estado, cicloModelo.estrategia]);
  const activos = React.useMemo(() => habitosModelo(estado.perfil), [estado.perfil]);
  const porHabito = React.useMemo(() => adherenciaPorHabito(estado, activos, 30), [estado, activos]);
  const diaSeleccionado = dia(fechaSeleccionada);
  const habitosSeleccionados = activos.filter((h) => diaSeleccionado.habitos?.[h.clave] === true).length;
  const semanaReciente = React.useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(hoyISO, i - 6);
    const cumplidos = activos.filter((h) => estado.dias[fecha]?.habitos?.[h.clave] === true).length;
    return { fecha, cumplidos, esHoy: fecha === hoyISO };
  }), [estado.dias, hoyISO, activos]);

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  const sinRacha = r.habitos.rachaActual.longitud === 0;
  const tonoRacha = sinRacha ? ESCALA_CUMPLIMIENTO[0] : null;
  const tonoSemana = tonoCumplimiento(r.habitos.adherencia7, 100);
  const esHoy = fechaSeleccionada === hoyISO;

  function seleccionarFecha(fecha: string, desplazar = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyISO) return;
    setFechaSeleccionada(fecha);
    if (desplazar) window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: "start" }));
  }

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
            {r.habitos.rachaActual.longitud > 0 ? `Todos tus hábitos activos, sin fallar · desde el ${fmtFechaCorta(r.habitos.rachaActual.desde!)}` : `Completa tus ${activos.length} hábitos activos hoy para iniciar una nueva racha.`}
          </p>
        </Card>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-0 [scrollbar-width:none] lg:block lg:overflow-visible lg:pb-0">
        <Card className="w-[calc(100%-2.5rem)] shrink-0 snap-start gap-4 p-4 sm:p-5 lg:w-auto">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-display text-lg font-bold">Últimos 7 días</h2><p className="mt-0.5 text-xs text-muted-foreground">Tu ritmo reciente, de un vistazo.</p></div>
            <div className="shrink-0 text-right"><p className={cn("font-display text-3xl font-bold leading-none tabular", tonoSemana.tinta)}>{r.habitos.adherencia7}%</p><p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">constancia</p></div>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label="Cumplimiento de hábitos de los últimos siete días">
            {semanaReciente.map((d) => {
              const altura = (d.cumplidos / activos.length) * 100;
              const tono = tonoCumplimiento(d.cumplidos, activos.length);
              return <button key={d.fecha} type="button" aria-pressed={fechaSeleccionada === d.fecha} aria-label={`Editar ${DIAS_SEMANA[diaSemanaLunes(d.fecha)]}: ${d.cumplidos} de ${activos.length} hábitos`} onClick={() => seleccionarFecha(d.fecha, true)} className={cn("min-w-0 rounded-xl border px-0.5 py-1.5 text-center transition-[box-shadow,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-2", tono.superficie, d.esHoy && "ring-1 ring-habit-border", fechaSeleccionada === d.fecha && "shadow-sm ring-2 ring-primary")}>
                <p className={cn("text-[0.65rem] font-semibold sm:text-xs", d.esHoy ? "text-habit-ink" : "text-muted-foreground")}>{DIAS_SEMANA[diaSemanaLunes(d.fecha)]}</p>
                <div className="mt-2 flex h-11 items-end rounded-lg bg-card/85 p-1" aria-hidden="true">
                  <div className={cn("w-full rounded-md transition-[height] duration-500", tono.barra)} style={{ height: `${altura}%` }} />
                </div>
                <p className={cn("mt-1.5 font-display text-lg font-bold leading-none tabular", tono.tinta)}>{d.cumplidos}<span className="ml-0.5 text-[0.6rem] font-medium text-muted-foreground">/{activos.length}</span></p>
              </button>;
            })}
          </div>
        </Card>
        <Card className="w-[calc(100%-2.5rem)] shrink-0 snap-start gap-4 p-4 sm:p-5 lg:hidden">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold">Este mes</h2><p className="mt-0.5 text-xs text-muted-foreground">Tu constancia en 30 días.</p></div><p className={cn("font-display text-3xl font-bold leading-none tabular", tonoCumplimiento(r.habitos.adherencia30, 100).tinta)}>{r.habitos.adherencia30}%</p></div>
          <div className="grid gap-2">{porHabito.slice(0, 3).map((h) => <div key={h.clave} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{h.etiqueta}</span><span className="font-semibold tabular text-foreground">{h.pct}%</span></div>)}</div>
          <p className="text-[0.7rem] text-muted-foreground">Desliza para comparar semana y mes.</p>
        </Card>
        </div>
      </div>

      {/* Editor por fecha */}
      <section ref={editorRef} className="scroll-mt-20">
        <SectionLabel>Editar hábitos</SectionLabel>
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/35 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-sm"><CalendarDays className="size-4" /></span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-bold sm:text-lg">{esHoy ? "Hoy" : capitalizar(fmtFechaLarga(fechaSeleccionada))}</h2>
                  <p className="text-xs text-muted-foreground">{habitosSeleccionados}/{activos.length} hábitos marcados</p>
                </div>
              </div>
            </div>
            <div className="flex max-w-full items-center gap-1 rounded-xl border border-border bg-card p-1">
              <Button type="button" variant="ghost" size="icon" className="size-9 rounded-lg" onClick={() => seleccionarFecha(sumarDias(fechaSeleccionada, -1))} aria-label="Día anterior"><ChevronLeft className="size-4" /></Button>
              <Input type="date" aria-label="Día que quieres editar" max={hoyISO} value={fechaSeleccionada} onChange={(event) => seleccionarFecha(event.target.value)} className="h-9 w-[9.1rem] rounded-lg border-0 bg-transparent px-1.5 text-sm shadow-none focus-visible:ring-2" />
              <Button type="button" variant="ghost" size="icon" className="size-9 rounded-lg" onClick={() => seleccionarFecha(sumarDias(fechaSeleccionada, 1))} disabled={esHoy} aria-label="Día siguiente"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-5">
          {activos.map((h) => {
            const hecho = diaSeleccionado.habitos?.[h.clave] === true;
            return (
              <button
                key={h.clave}
                type="button"
                onClick={() => void alternarHabito(fechaSeleccionada, h.clave)}
                aria-pressed={hecho}
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
          </div>
          {!esHoy && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
            <span>Los cambios actualizan el histórico y las estimaciones de este día.</span>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2.5" onClick={() => seleccionarFecha(hoyISO)}>Volver a hoy</Button>
          </div>}
        </Card>
      </section>

      {/* Progreso por hábito */}
      <section className="hidden lg:block">
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

      {/* Constancia histórica */}
      <section>
        <SectionLabel>Constancia</SectionLabel>
        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">Histórico de hábitos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Cada casilla resume un día completo de tu año.</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-[0.68rem] text-muted-foreground">
                  <span className="size-2 rounded-full bg-destructive" />
                  <span>0</span>
                  <span className="h-1.5 w-12 rounded-full bg-gradient-to-r from-destructive via-warning to-primary" />
                  <span className="size-2 rounded-full bg-primary" />
                  <span>{activos.length}/{activos.length}</span>
                </div>
              </div>
              <Heatmap estado={estado} onSelect={(fecha) => seleccionarFecha(fecha, true)} />
              <p className="mt-2 text-xs text-muted-foreground">
                Desplázate en horizontal para ver todo el histórico. El color sube de rojo a verde según hábitos cumplidos.
              </p>
            </div>
            <div className="border-t border-border bg-secondary/25 p-4 sm:p-5 lg:border-l lg:border-t-0">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Este mes</p>
                  <p className="mt-1 text-xs text-muted-foreground">Últimos 30 días</p>
                </div>
                <p className={cn("font-display text-4xl font-bold leading-none tabular", tonoCumplimiento(r.habitos.adherencia30, 100).tinta)}>{r.habitos.adherencia30}%</p>
              </div>
              <div className="mt-5 grid gap-3">
                {porHabito.slice(0, 5).map((h) => {
                  const tono = tonoCumplimiento(h.pct, 100);
                  return (
                    <div key={h.clave} className="min-w-0">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium text-foreground">{h.etiqueta}</span>
                        <span className={cn("font-semibold tabular", tono.tinta)}>{h.pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card">
                        <div className={cn("h-full rounded-full transition-[width] duration-700", tono.barra)} style={{ width: `${h.pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
