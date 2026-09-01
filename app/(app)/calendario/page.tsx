"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, MessageSquareText, Plane, Plus, UtensilsCrossed } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { energiaDe } from "@/lib/model/analytics";
import { nivelDia } from "@/lib/model/metrics";
import { habitosModelo } from "@/lib/model/config";
import { claveMes, DIAS_SEMANA, diaSemanaLunes, hoy, limitesMes, sumarDias, sumarMeses } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel, Chip } from "@/components/app/primitives";
import { fmtPeso, fmtKcal, fmtFechaLarga, fmtMes, capitalizar, fmtSigno, fmtFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EnergiaDia } from "@/lib/model/types";

const NIVEL = ["bg-transparent", "bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary"];

export default function CalendarioPage() {
  const { estado, dia, actualizarDia } = useRitmo();
  const { abrir } = useQuickLog();
  const hoyISO = hoy();
  const [mes, setMes] = React.useState(claveMes(hoyISO));
  const [sel, setSel] = React.useState(hoyISO);
  const habitosActivos = React.useMemo(() => habitosModelo(estado.perfil), [estado.perfil]);
  const totalHabitos = habitosActivos.length;

  const { desde, dias } = limitesMes(mes);
  const offset = diaSemanaLunes(desde);
  const celdas: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: dias }, (_, i) => sumarDias(desde, i)),
  ];

  const d = dia(sel);
  const energiaSel = energiaDe(estado, sel);
  const habHechos = habitosActivos.filter((h) => d.habitos?.[h.clave]).length;
  const calidad = calidadDia(energiaSel, habHechos, totalHabitos);
  const diasConRegistroMes = Array.from({ length: dias }, (_, i) => dia(sumarDias(desde, i))).filter((registro) =>
    Object.values(registro.habitos || {}).some(Boolean) || (registro.comidas?.length ?? 0) > 0 || registro.peso != null,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Calendario</h1>
      </header>

      <Card className="w-full overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary/35 px-4 py-3.5 sm:px-5">
          <div><p className="font-display text-lg font-bold">{capitalizar(fmtMes(`${mes}-01`))}</p><p className="text-xs text-muted-foreground">{diasConRegistroMes} de {dias} días con datos</p></div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-9" onClick={() => setMes((m) => sumarMeses(m, -1))} aria-label="Mes anterior"><ChevronLeft className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => setMes((m) => sumarMeses(m, 1))} aria-label="Mes siguiente"><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <div className="p-3 sm:p-4">
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground sm:gap-2">
          {DIAS_SEMANA.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {celdas.map((fecha, i) => {
            if (!fecha) return <span key={i} />;
            const dd = dia(fecha);
            const habitosDelDia = Object.fromEntries(habitosActivos.map((h) => [h.clave, dd.habitos?.[h.clave] === true]));
            const nivel = nivelDia(habitosDelDia, totalHabitos);
            const futuro = fecha > hoyISO;
            const e = energiaDe(estado, fecha);
            const esHoy = fecha === hoyISO;
            const activo = fecha === sel;
            const cumplidos = habitosActivos.filter((h) => dd.habitos?.[h.clave]).length;
            const hechos = habitosActivos.filter((h) => dd.habitos?.[h.clave]).map((h) => h.etiqueta);
            const resumenDia = futuro
              ? undefined
              : [
                  `${fmtFechaCorta(fecha)} · ${cumplidos}/${totalHabitos} hábitos`,
                  hechos.length ? hechos.join(", ") : "sin hábitos marcados",
                  dd.peso != null ? `Peso: ${dd.peso} kg` : null,
                  e.imputado ? "Día sin registro (imputado)" : null,
                ]
                  .filter(Boolean)
                  .join("\n");
            return (
              <button
                key={fecha}
                onClick={() => setSel(fecha)}
                disabled={futuro}
                title={resumenDia}
                aria-label={resumenDia}
                className={cn(
                  "relative flex aspect-square min-h-12 flex-col items-center justify-center rounded-xl text-sm transition-all sm:min-h-16",
                  futuro ? "text-muted-foreground/30" : "hover:-translate-y-0.5 hover:shadow-sm",
                  nivel > 0 ? NIVEL[nivel] : "bg-secondary/50",
                  nivel >= 3 ? "text-primary-foreground" : "text-foreground",
                  activo && "ring-2 ring-primary shadow-sm",
                  esHoy && "font-bold ring-1 ring-primary/35",
                )}
              >
                <span className="tabular">{Number(fecha.slice(-2))}</span>
                <span className="mt-1 flex h-1.5 gap-1">
                  {dd.peso != null && <span className="size-1.5 rounded-full bg-weight" />}
                  {e.imputado && <span className="size-1.5 rounded-full bg-warning" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-weight" /> pesaje</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-warning" /> imputado</span>
        </div>
        </div>
      </Card>

      {/* Resumen del día seleccionado */}
      <section>
        <SectionLabel action={<Button size="sm" variant="secondary" className="h-7 gap-1.5" onClick={() => abrir(undefined, sel)}><Plus className="size-3.5" /> Registrar</Button>}>
          {sel === hoyISO ? "Hoy" : capitalizar(fmtFechaLarga(sel))}
        </SectionLabel>
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-3 border-b border-border bg-secondary/35">
            <DiaMetric label="Hábitos" value={`${habHechos}`} unit={`/${totalHabitos}`} tone="habit" />
            <DiaMetric label="Peso" value={d.peso != null ? fmtPeso(d.peso) : "—"} tone="weight" />
            <DiaMetric label="Balance" value={energiaSel.sinRegistro && !energiaSel.imputado ? "—" : fmtSigno(energiaSel.balance, 0)} tone={energiaSel.balance > 0 ? "energy" : "weight"} />
          </div>
          <div className="p-3.5 sm:p-4">
          <div className={cn("relative overflow-hidden rounded-xl border px-3.5 py-3", calidad.bg, calidad.border)}>
            <span className={cn("absolute bottom-0 left-0 top-0 w-1", calidad.dot)} />
            <div className="flex items-start justify-between gap-3 pl-1.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className={cn("text-sm font-semibold", calidad.ink)}>{calidad.titulo}</p>{energiaSel.imputado && <Chip tone="warning">estimado</Chip>}</div><p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{calidad.detalle}</p></div></div>
          </div>
          {(d.comidas?.length || habHechos > 0) && <div className="mt-3 flex flex-wrap gap-1.5">
            {d.comidas && d.comidas.length > 0 && <span className="inline-flex h-7 items-center rounded-full bg-energy-wash px-2.5 text-xs font-medium text-energy-ink">{d.comidas.length} comida{d.comidas.length > 1 ? "s" : ""} · {fmtKcal(d.kcalConsumidas ?? 0)} kcal</span>}
            {habitosActivos.filter((h) => d.habitos?.[h.clave]).map((h) => <Chip key={h.clave} tone="habit">{h.etiqueta}</Chip>)}
          </div>}
          <NotaContexto key={sel} fecha={sel} inicial={d.notas} onGuardar={(notas) => actualizarDia(sel, { notas })} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function NotaContexto({ fecha, inicial, onGuardar }: { fecha: string; inicial?: string; onGuardar: (notas: string | undefined) => Promise<void> }) {
  const [texto, setTexto] = React.useState(inicial ?? "");
  const [guardando, setGuardando] = React.useState(false);

  const limpio = texto.trim();
  const cambio = limpio !== (inicial ?? "").trim();
  const etiquetas = [
    { etiqueta: "Viaje", icono: Plane },
    { etiqueta: "Comida libre", icono: UtensilsCrossed },
    { etiqueta: "Enfermedad", icono: HeartPulse },
    { etiqueta: "Entrenamiento especial", icono: Dumbbell },
  ];

  function sumarEtiqueta(etiqueta: string) {
    setTexto((actual) => actual.includes(etiqueta) ? actual : `${actual.trim()}${actual.trim() ? " · " : ""}${etiqueta}`);
  }

  async function guardar() {
    setGuardando(true);
    try {
      await onGuardar(limpio || undefined);
    } finally {
      setGuardando(false);
    }
  }

  const activas = etiquetas.filter(({ etiqueta }) => limpio.includes(etiqueta)).map(({ etiqueta }) => etiqueta);

  return <details className="group mt-3 overflow-hidden rounded-xl border border-border bg-secondary/25 open:bg-card">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 marker:hidden sm:px-3.5">
      <div className="flex min-w-0 items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-body-wash text-body"><MessageSquareText className="size-4" /></span><div className="min-w-0"><p className="text-sm font-semibold text-foreground">Contexto del día</p><p className="truncate text-xs text-muted-foreground">{activas.length ? activas.join(" · ") : limpio ? "Nota guardada" : "Añade una excepción si la hubo"}</p></div></div>
      <div className="flex shrink-0 items-center gap-2"><Chip tone={limpio ? "body" : "muted"}>{limpio ? "Con nota" : "Opcional"}</Chip><ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" /></div>
    </summary>
    <div className="border-t border-border p-3 sm:p-3.5">
      <div className="flex flex-wrap gap-1.5">
        {etiquetas.map(({ etiqueta, icono: Icono }) => <button key={etiqueta} type="button" onClick={() => sumarEtiqueta(etiqueta)} className={cn("flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors", texto.includes(etiqueta) ? "border-body-border bg-body-wash text-body-ink" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground")}><Icono className="size-3.5 shrink-0" />{etiqueta}</button>)}
      </div>
      <Textarea id={`nota-${fecha}`} aria-label="Nota de contexto del día" value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Ej.: cena fuera, viaje o entrenamiento especial…" className="mt-3 min-h-20 resize-y border-body-border/60 bg-body-wash/15 text-sm placeholder:text-muted-foreground" />
      <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">No altera tu balance ni la predicción.</span><Button size="sm" variant="secondary" disabled={!cambio || guardando} onClick={() => void guardar()} className="h-8 px-3 text-xs">{guardando ? "Guardando…" : "Guardar"}</Button></div>
    </div>
  </details>;
}

function calidadDia(energia: EnergiaDia, habitos: number, totalHabitos: number) {
  if (energia.imputado) return { titulo: "Sin hábitos · superávit estimado", detalle: "No hubo registro. El modelo aplica el superávit conservador configurado para un día sin adherencia.", bg: "bg-warning-wash", border: "border-warning-border", dot: "bg-warning", ink: "text-warning-ink" };
  if (energia.sinRegistro) return { titulo: "Sin datos suficientes", detalle: "Añade comidas o hábitos para que este día empiece a contar.", bg: "bg-secondary", border: "border-border", dot: "bg-muted-foreground", ink: "text-foreground" };
  if (habitos === 0) return { titulo: "Sin hábitos · superávit estimado", detalle: "Hay datos registrados, pero sin hábitos el modelo aplica un superávit conservador, nunca un déficit.", bg: "bg-warning-wash", border: "border-warning-border", dot: "bg-warning", ink: "text-warning-ink" };
  if (energia.ingestaIncompleta) return { titulo: "Estimación ajustada por hábitos", detalle: `${habitos}/${totalHabitos} hábitos marcados. La comida registrada suma información; el modelo completa lo que falta con tus hábitos.`, bg: "bg-energy-wash", border: "border-energy-border", dot: "bg-energy", ink: "text-energy-ink" };
  return { titulo: "Día válido para el modelo", detalle: "Los hábitos y la ingesta permiten usar este día en las tendencias.", bg: "bg-weight-wash", border: "border-weight-border", dot: "bg-weight", ink: "text-weight-ink" };
}

function DiaMetric({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "weight" | "energy" | "habit" }) {
  const color = tone === "weight" ? "text-weight" : tone === "energy" ? "text-energy" : tone === "habit" ? "text-habit" : "text-foreground";
  return <div className="min-w-0 px-3 py-4 text-center first:border-r last:border-l first:border-border last:border-border sm:px-5 sm:py-5"><p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className={cn("mt-1.5 font-display text-2xl font-bold leading-none tabular", color)}>{value}{unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}</p></div>;
}
