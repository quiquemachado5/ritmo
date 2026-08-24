"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Plus, Scale, Trash2, AlertTriangle } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { pesajes as getPesajes, resumen } from "@/lib/model/analytics";
import { mediaMovil } from "@/lib/model/metrics";
import { hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LineSeries, CompositionChart } from "@/components/app/charts";
import { Metric, SectionLabel, Chip, EmptyState } from "@/components/app/primitives";
import { fmtPeso, fmtNum, fmtSigno, fmtFechaCorta, relativo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONO: Record<string, "weight" | "warning" | "energy"> = { good: "weight", warn: "warning", bad: "energy" };

export default function CuerpoPage() {
  const { estado, cargando, medicion, actualizarDia, borrarMedicion } = useRitmo();
  const { abrir } = useQuickLog();
  const hoyISO = hoy();
  const r = React.useMemo(() => resumen(estado), [estado]);

  // Historial COMPLETO de pesajes (todos los días con peso, no solo composición).
  const historial = React.useMemo(() => {
    const p = getPesajes(estado); // ascendente
    const compFechas = new Map(estado.composicion.filter((c) => c.grasaPct != null).map((c) => [c.fecha, c.grasaPct!]));
    return p.map((punto, i) => ({
      fecha: punto.fecha,
      peso: punto.peso,
      delta: i > 0 ? Math.round((punto.peso - p[i - 1].peso) * 10) / 10 : null,
      grasaPct: compFechas.get(punto.fecha) ?? null,
    }));
  }, [estado]);

  const serie = React.useMemo(() => {
    const suav = mediaMovil(historial.map((h) => h.peso), 5);
    return historial.map((h, i) => ({ label: fmtFechaCorta(h.fecha), valor: suav[i] ?? h.peso }));
  }, [historial]);

  const [confirmBorrar, setConfirmBorrar] = React.useState<string | null>(null);

  async function borrarPesaje(fecha: string) {
    if (medicion(fecha)) await borrarMedicion(fecha);
    await actualizarDia(fecha, { peso: undefined });
    setConfirmBorrar(null);
  }

  const compSerie = React.useMemo(() => {
    return estado.composicion
      .filter((c) => c.grasaPct != null)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((c) => ({
        label: fmtFechaCorta(c.fecha),
        grasa: c.grasaPct!,
        muscular: c.masaMuscularKg ?? null,
      }));
  }, [estado]);

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-xl" /></div>;

  const comp = r.composicion;
  const ultima = [...estado.composicion].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
  const primero = historial[0];
  const actualPeso = historial.length ? historial[historial.length - 1] : null;
  const totalCambio = primero && actualPeso ? Math.round((actualPeso.peso - primero.peso) * 10) / 10 : null;

  // Media de peso de los últimos 30 días con pesaje.
  const desde30 = sumarDias(hoyISO, -30);
  const ult30 = historial.filter((h) => h.fecha >= desde30).map((h) => h.peso);
  const media30 = ult30.length ? Math.round((ult30.reduce((a, b) => a + b, 0) / ult30.length) * 10) / 10 : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Cuerpo</h1>
        <Button onClick={() => abrir("peso")} size="sm" className="gap-1.5">
          <Scale className="size-4" /> Pesarme
        </Button>
      </header>

      {/* Estado actual */}
      <section>
        <SectionLabel>Estado actual</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <Metric
              label="Último peso real"
              value={fmtPeso(r.peso.actual)}
              unit="kg"
              hint={r.peso.fecha ? <span className="text-[0.7rem] text-muted-foreground">báscula · {fmtFechaCorta(r.peso.fecha)}</span> : undefined}
            />
          </Card>
          <Card className="p-4">
            <Metric
              label="Peso estimado hoy"
              value={fmtPeso(r.peso.estimadoHoy)}
              unit="kg"
              tone="weight"
              hint={
                r.prediccion.diasSinPesaje
                  ? <span className="text-[0.7rem] text-muted-foreground">{r.prediccion.diasSinPesaje} d sin pesarte</span>
                  : <span className="text-[0.7rem] text-muted-foreground">pesaje de hoy</span>
              }
            />
          </Card>
          <Card className="p-4">
            <Metric
              label="Objetivo"
              value={fmtPeso(r.peso.objetivo)}
              unit="kg"
              hint={r.peso.restante != null ? <span className="text-[0.7rem] text-muted-foreground">faltan {fmtPeso(Math.abs(r.peso.restante))} kg</span> : undefined}
            />
          </Card>
          <Card className="p-4">
            {r.imc ? (
              <Metric label="IMC" value={fmtNum(r.imc.valor, 1)} hint={<Chip tone={r.imc.categoria ? TONO[r.imc.categoria.tono] : "muted"}>{r.imc.categoria?.etiqueta}</Chip>} />
            ) : (
              <Metric label="IMC" value="—" />
            )}
          </Card>
        </div>
      </section>

      {/* Evolución del peso */}
      {historial.length > 0 ? (
        <section>
          <SectionLabel>Evolución del peso</SectionLabel>
          <Card className="p-5">
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Metric label="Inicial" value={fmtPeso(primero?.peso)} unit="kg" />
              <Metric label="Cambio total" value={totalCambio != null ? fmtSigno(totalCambio) : "—"} unit="kg" tone={totalCambio != null && totalCambio <= 0 ? "weight" : "energy"} />
              <Metric label="Media 30 d" value={fmtPeso(media30)} unit="kg" />
            </div>
            {serie.length >= 2 && <LineSeries data={serie} colorVar="--weight" unidad="kg" />}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {historial.length} pesajes · media móvil de 5
            </p>
          </Card>
        </section>
      ) : (
        <EmptyState icon={<Scale className="size-8" />} title="Aún no hay pesajes" action={<Button onClick={() => abrir("peso")} className="mt-1 gap-2"><Scale className="size-4" /> Registrar peso</Button>}>
          Pésate con regularidad para ver tu evolución y activar la predicción.
        </EmptyState>
      )}

      {/* Composición */}
      {comp && (
        <section>
          <SectionLabel>Composición corporal</SectionLabel>
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Grasa" value={fmtNum(comp.grasaPct, 1)} unit="%" tone="body" />
              <Metric label="Masa grasa" value={fmtPeso(comp.grasaKg)} unit="kg" tone="body" />
              <Metric label="Masa magra" value={fmtPeso(comp.magraKg)} unit="kg" tone="weight" />
              <Metric label="FFMI" value={comp.ffmi != null ? fmtNum(comp.ffmi, 1) : "—"} />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Rango saludable de grasa ({estado.perfil.sexo})</span>
                <span className="tabular">{comp.rango.min}–{comp.rango.max}%</span>
              </div>
              <RangoGrasa valor={comp.grasaPct} rango={comp.rango} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Medición del {fmtFechaCorta(comp.fecha)} · {relativo(comp.fecha, hoyISO)}</p>
          </Card>
        </section>
      )}

      {/* Evolución composición */}
      {compSerie.length >= 2 && (
        <section>
          <SectionLabel>Evolución de composición</SectionLabel>
          <Card className="p-5">
            <CompositionChart data={compSerie} />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {compSerie.length} mediciones con % grasa
            </p>
          </Card>
        </section>
      )}

      {/* Medidas */}
      {ultima && (ultima.cintura || ultima.cadera || ultima.pecho || ultima.brazo || ultima.muslo) && (
        <section>
          <SectionLabel>Medidas (cm)</SectionLabel>
          <Card className="grid grid-cols-3 gap-4 p-5 sm:grid-cols-5">
            {([["Cintura", ultima.cintura], ["Cadera", ultima.cadera], ["Pecho", ultima.pecho], ["Brazo", ultima.brazo], ["Muslo", ultima.muslo]] as const)
              .filter(([, v]) => v != null)
              .map(([label, v]) => <Metric key={label} label={label} value={fmtNum(v!, 0)} />)}
          </Card>
        </section>
      )}

      {/* Historial de pesajes — completo */}
      {historial.length > 0 && (
        <section>
          <SectionLabel action={<span className="text-xs text-muted-foreground">{historial.length} registros</span>}>
            Historial de pesajes
          </SectionLabel>
          <Card className="max-h-[26rem] divide-y divide-border overflow-y-auto p-0">
            {[...historial].reverse().map((h) => (
              <div key={h.fecha} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium tabular">{fmtFechaCorta(h.fecha)}</span>
                  <span className="text-[0.7rem] text-muted-foreground">{relativo(h.fecha, hoyISO)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {h.grasaPct != null && <Chip tone="body">{fmtNum(h.grasaPct, 1)}% grasa</Chip>}
                  <DeltaTag delta={h.delta} />
                  <span className="w-16 text-right font-display font-bold tabular text-weight">{fmtPeso(h.peso)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span></span>
                  {confirmBorrar === h.fecha ? (
                    <div className="flex items-center gap-1">
                      <Button variant="destructive" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => borrarPesaje(h.fecha)}>
                        <AlertTriangle className="size-3" /> Borrar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirmBorrar(null)}>
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="size-11 text-muted-foreground hover:text-destructive" onClick={() => setConfirmBorrar(h.fecha)} aria-label="Eliminar pesaje">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function DeltaTag({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="flex w-14 items-center justify-end text-xs text-muted-foreground">—</span>;
  const cero = Math.abs(delta) < 0.05;
  const baja = delta < 0;
  return (
    <span
      className={cn(
        "flex w-14 items-center justify-end gap-0.5 text-xs font-medium tabular",
        cero ? "text-muted-foreground" : baja ? "text-weight" : "text-energy",
      )}
    >
      {cero ? <Minus className="size-3" /> : baja ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
      {cero ? "0" : fmtSigno(delta, 1)}
    </span>
  );
}

function RangoGrasa({ valor, rango }: { valor: number; rango: { min: number; max: number; atleta: number } }) {
  const escala = Math.max(rango.max + 12, valor + 4);
  const pos = Math.min(100, (valor / escala) * 100);
  const zonaMin = (rango.min / escala) * 100;
  const zonaMax = (rango.max / escala) * 100;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className="absolute inset-y-0 rounded-full bg-weight/30" style={{ left: `${zonaMin}%`, width: `${zonaMax - zonaMin}%` }} />
      <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-body" style={{ left: `${pos}%` }} />
    </div>
  );
}
