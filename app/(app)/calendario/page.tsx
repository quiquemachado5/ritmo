"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MessageSquareText, Plus } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { energiaDe } from "@/lib/model/analytics";
import { nivelDia } from "@/lib/model/metrics";
import { TOTAL_HABITOS, HABITOS } from "@/lib/model/config";
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

  const { desde, dias } = limitesMes(mes);
  const offset = diaSemanaLunes(desde);
  const celdas: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: dias }, (_, i) => sumarDias(desde, i)),
  ];

  const d = dia(sel);
  const energiaSel = energiaDe(estado, sel);
  const habHechos = HABITOS.filter((h) => d.habitos?.[h.clave]).length;
  const calidad = calidadDia(energiaSel, habHechos);
  const diasConRegistroMes = Array.from({ length: dias }, (_, i) => dia(sumarDias(desde, i))).filter((registro) =>
    Object.values(registro.habitos || {}).some(Boolean) || (registro.comidas?.length ?? 0) > 0 || registro.peso != null,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Calendario</h1>
      </header>

      <Card className="overflow-hidden p-0">
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
            const nivel = nivelDia(dd.habitos, TOTAL_HABITOS);
            const futuro = fecha > hoyISO;
            const e = energiaDe(estado, fecha);
            const esHoy = fecha === hoyISO;
            const activo = fecha === sel;
            const cumplidos = HABITOS.filter((h) => dd.habitos?.[h.clave]).length;
            const hechos = HABITOS.filter((h) => dd.habitos?.[h.clave]).map((h) => h.etiqueta);
            const resumenDia = futuro
              ? undefined
              : [
                  `${fmtFechaCorta(fecha)} · ${cumplidos}/${TOTAL_HABITOS} hábitos`,
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
          <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-secondary/25">
            <DiaMetric label="Hábitos" value={`${habHechos}`} unit={`/${TOTAL_HABITOS}`} />
            <DiaMetric label="Peso" value={d.peso != null ? fmtPeso(d.peso) : "—"} tone="weight" />
            <DiaMetric label="Balance" value={energiaSel.sinRegistro || energiaSel.ingestaIncompleta || energiaSel.sinHabitosMarcados ? "—" : fmtSigno(energiaSel.balance, 0)} tone={energiaSel.balance > 0 ? "energy" : "weight"} />
          </div>
          <div className="flex flex-col gap-3 p-5">
          <div className={cn("flex items-start gap-3 rounded-xl px-3 py-3", calidad.bg)}>
            <span className={cn("mt-1 size-2 shrink-0 rounded-full", calidad.dot)} />
            <div><p className={cn("text-sm font-semibold", calidad.ink)}>{calidad.titulo}</p><p className="mt-0.5 text-xs text-muted-foreground">{calidad.detalle}</p></div>
          </div>
          {d.comidas && d.comidas.length > 0 && (
            <div className="border-t border-border pt-3 text-sm text-muted-foreground">
              {d.comidas.length} comida{d.comidas.length > 1 ? "s" : ""} · {fmtKcal(d.kcalConsumidas ?? 0)} kcal
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {HABITOS.filter((h) => d.habitos?.[h.clave]).map((h) => (
              <Chip key={h.clave} tone="habit">{h.etiqueta}</Chip>
            ))}
            {energiaSel.imputado && <Chip tone="warning">día imputado</Chip>}
          </div>
          <NotaContexto fecha={sel} inicial={d.notas} onGuardar={(notas) => actualizarDia(sel, { notas })} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function NotaContexto({ fecha, inicial, onGuardar }: { fecha: string; inicial?: string; onGuardar: (notas: string | undefined) => Promise<void> }) {
  const [texto, setTexto] = React.useState(inicial ?? "");
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => setTexto(inicial ?? ""), [fecha, inicial]);

  const limpio = texto.trim();
  const cambio = limpio !== (inicial ?? "").trim();
  const etiquetas = ["Viaje", "Comida libre", "Enfermedad", "Entrenamiento especial"];

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

  return <div className="border-t border-border pt-4">
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-body-wash text-body"><MessageSquareText className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <label htmlFor={`nota-${fecha}`} className="text-sm font-semibold text-foreground">Contexto del día</label>
        <p className="mt-0.5 text-xs text-muted-foreground">Una observación para recordar qué pasó; no modifica los cálculos.</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5">
      {etiquetas.map((etiqueta) => <button key={etiqueta} type="button" onClick={() => sumarEtiqueta(etiqueta)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", texto.includes(etiqueta) ? "border-body-border bg-body-wash text-body-ink" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground")}>{etiqueta}</button>)}
    </div>
    <Textarea id={`nota-${fecha}`} value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Ej.: viaje, cena fuera, fiebre o sesión de fuerza." className="mt-3 min-h-20 resize-y bg-card text-sm" />
    <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{limpio ? "Nota privada del día" : "Sin contexto añadido"}</span><Button size="sm" variant="secondary" disabled={!cambio || guardando} onClick={() => void guardar()} className="h-8 px-3 text-xs">{guardando ? "Guardando…" : "Guardar nota"}</Button></div>
  </div>;
}

function calidadDia(energia: EnergiaDia, habitos: number) {
  if (energia.imputado) return { titulo: "Día imputado", detalle: "No hubo registro; el modelo aplica la regla de huecos configurada.", bg: "bg-warning-wash", dot: "bg-warning", ink: "text-warning-ink" };
  if (energia.sinRegistro) return { titulo: "Sin datos suficientes", detalle: "Añade comidas o hábitos para que este día empiece a contar.", bg: "bg-secondary", dot: "bg-muted-foreground", ink: "text-foreground" };
  if (habitos === 0) return { titulo: "Registro sin validar", detalle: "Hay datos de comida, pero sin hábitos RITMO no calcula déficit ni superávit.", bg: "bg-warning-wash", dot: "bg-warning", ink: "text-warning-ink" };
  if (energia.ingestaIncompleta) return { titulo: "Registro parcial", detalle: "Falta la cena; el balance queda fuera del modelo hasta completar el día.", bg: "bg-energy-wash", dot: "bg-energy", ink: "text-energy-ink" };
  return { titulo: "Día válido para el modelo", detalle: "Los hábitos y la ingesta permiten usar este día en las tendencias.", bg: "bg-weight-wash", dot: "bg-weight", ink: "text-weight-ink" };
}

function DiaMetric({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "weight" | "energy" }) {
  return <div className="min-w-0 px-3 py-4 text-center sm:px-5"><p className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={cn("mt-1 font-display text-xl font-bold tabular", tone === "weight" ? "text-weight" : tone === "energy" ? "text-energy" : "text-foreground")}>{value}{unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}</p></div>;
}
