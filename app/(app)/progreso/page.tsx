"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Pencil,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { energiaDe, pesajes as getPesajes, resumen, seriePesoDiaria } from "@/lib/model/analytics";
import { hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PuntoPeso } from "@/components/app/charts";
import { Metric, SectionLabel, Chip, EmptyState } from "@/components/app/primitives";
import { fmtPeso, fmtSigno, fmtNum, fmtFechaCorta, relativo } from "@/lib/format";
import { cn } from "@/lib/utils";

const WeightChart = dynamic(() => import("@/components/app/charts").then((m) => m.WeightChart), { loading: () => <Skeleton className="h-72 w-full rounded-xl" /> });
const CompositionChart = dynamic(() => import("@/components/app/charts").then((m) => m.CompositionChart), { loading: () => <Skeleton className="h-64 w-full rounded-xl" /> });

const RANGOS = [
  { id: "1M", dias: 30 },
  { id: "3M", dias: 90 },
  { id: "6M", dias: 180 },
  { id: "1A", dias: 365 },
  { id: "Todo", dias: Infinity },
] as const;

const CALIDAD_LABEL = { inicial: "inicial", media: "media", alta: "alta" } as const;
const CALIDAD_TONE = { inicial: "muted", media: "habit", alta: "weight" } as const;
/**
 * Pantalla única de evolución corporal. Los datos de báscula y composición son
 * hechos registrados; el modelo ocupa deliberadamente su propio bloque.
 */
export default function ProgresoPage() {
  const { estado, cargando, medicion, actualizarDia, borrarMedicion } = useRitmo();
  const { abrir } = useQuickLog();
  const [rango, setRango] = React.useState<(typeof RANGOS)[number]["id"]>("1A");
  const [confirmBorrar, setConfirmBorrar] = React.useState<string | null>(null);
  const r = React.useMemo(() => resumen(estado), [estado]);
  // Algunos historiales pueden ofrecer proyecciones futuras antes de tener un
  // intervalo calibrado para hoy. La UI no debe asumir que ese rango existe.
  const intervaloHoy = r.prediccion.hoy ?? null;
  const hoyISO = hoy();

  const lecturaModelo = React.useMemo(() => {
    const acumulado = { validos: 0, completadosPorHabitos: 0, sinHabitos: 0, imputados: 0, sinRegistro: 0 };
    for (let i = 0; i < 14; i += 1) {
      const energia = energiaDe(estado, sumarDias(hoyISO, -i));
      if (energia.imputado) acumulado.imputados += 1;
      else if (energia.sinRegistro) acumulado.sinRegistro += 1;
      else if (energia.sinHabitosMarcados) acumulado.sinHabitos += 1;
      else { acumulado.validos += 1; if (energia.ingestaIncompleta) acumulado.completadosPorHabitos += 1; }
    }
    return acumulado;
  }, [estado, hoyISO]);

  const historial = React.useMemo(() => {
    const puntos = getPesajes(estado);
    const compPorFecha = new Map(estado.composicion.filter((c) => c.grasaPct != null).map((c) => [c.fecha, c.grasaPct!]));
    return puntos.map((punto, i) => ({
      fecha: punto.fecha,
      peso: punto.peso,
      delta: i > 0 ? Math.round((punto.peso - puntos[i - 1].peso) * 10) / 10 : null,
      grasaPct: compPorFecha.get(punto.fecha) ?? null,
    }));
  }, [estado]);

  const compSerie = React.useMemo(
    () => estado.composicion
      .filter((c) => c.grasaPct != null)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((c) => ({ label: fmtFechaCorta(c.fecha), grasa: c.grasaPct!, masaGrasa: Math.round((c.peso * c.grasaPct! / 100) * 10) / 10, masaMagra: Math.round((c.peso * (1 - c.grasaPct! / 100)) * 10) / 10, muscular: c.masaMuscularKg ?? null })),
    [estado],
  );

  const ultimaMedicion = React.useMemo(
    () => [...estado.composicion].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0],
    [estado.composicion],
  );

  const { datosPeso, statsWin } = React.useMemo(() => {
    const dias = RANGOS.find((x) => x.id === rango)!.dias;
    const fechaHoy = hoy();
    const desde = dias === Infinity ? "0000-01-01" : sumarDias(fechaHoy, -dias);
    const ventana = historial.filter((p) => p.fecha >= desde);
    const fechaUltimoReal = r.peso.fecha;

    // La proyección solo comienza en el último pesaje real. Así nunca se
    // disfraza una estimación histórica de lectura de báscula.
    const pesoData: PuntoPeso[] = seriePesoDiaria(estado, desde, fechaHoy).map((d) => ({
      label: fmtFechaCorta(d.fecha),
      real: d.real,
      pred: fechaUltimoReal && d.fecha >= fechaUltimoReal ? d.estimado : null,
      banda: d.fecha === fechaHoy && d.estimado != null && intervaloHoy
        ? [intervaloHoy.minimo, intervaloHoy.maximo]
        : null,
    }));

    for (const [diasFuturos, iv] of [[14, r.prediccion.quincena], [30, r.prediccion.mes]] as const) {
      if (!iv) continue;
      pesoData.push({ label: fmtFechaCorta(sumarDias(hoy(), diasFuturos)), real: null, pred: iv.peso, banda: [iv.minimo, iv.maximo] });
    }

    return {
      datosPeso: pesoData,
      statsWin: {
        inicial: ventana[0]?.peso ?? null,
        actual: ventana[ventana.length - 1]?.peso ?? null,
        cambio: ventana.length > 1 ? Math.round((ventana[ventana.length - 1].peso - ventana[0].peso) * 10) / 10 : null,
      },
    };
  }, [estado, historial, intervaloHoy, r, rango]);

  async function borrarPesaje(fecha: string) {
    if (medicion(fecha)) await borrarMedicion(fecha);
    await actualizarDia(fecha, { peso: undefined });
    setConfirmBorrar(null);
  }

  if (cargando) {
    return <div className="flex flex-col gap-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-72 w-full rounded-xl" /><Skeleton className="h-56 w-full rounded-xl" /></div>;
  }

  const hayPesajes = historial.length > 0;
  // La tendencia de este bloque se deriva únicamente de pesajes registrados.
  const tendKg = r.tendencia?.kgSemana ?? null;
  const composicion = r.composicion;
  const diasDesdeBascula = r.prediccion.diasSinPesaje ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Progreso</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Tu historial confirmado y la orientación del modelo se leen por separado.</p>
        </div>
        <Button onClick={() => abrir("peso")} className="min-h-11 gap-2"><Scale className="size-4" /> Registrar medición</Button>
      </header>

      {!hayPesajes ? (
        <EmptyState icon={<Scale className="size-8" />} title="Empieza con una medición real" action={<Button onClick={() => abrir("peso")} className="mt-1 gap-2"><Scale className="size-4" /> Registrar peso</Button>}>
          Con pesajes regulares, RITMO podrá separar tu evolución real de la estimación del modelo.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="estado-actual">
            <h2 id="estado-actual" className="sr-only">Estado actual</h2>
            <Card className="overflow-hidden p-0">
              <div className="grid divide-y divide-border lg:grid-cols-[1fr_1.08fr] lg:divide-x lg:divide-y-0">
                <div className="p-5 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Última medición real</p>
                      <p className="mt-1 text-xs text-muted-foreground">Dato introducido por ti · no es una predicción</p>
                    </div>
                    <Chip tone="weight">Báscula</Chip>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="font-display text-5xl font-bold leading-none tabular text-weight">{fmtPeso(r.peso.actual)}</span>
                    <span className="mb-1 text-base font-medium text-muted-foreground">kg</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {r.peso.fecha ? <>Registrado el <span className="font-medium text-foreground">{fmtFechaCorta(r.peso.fecha)}</span></> : "Sin fecha"}
                  </p>
                  {tendKg != null && (
                    <div className={cn("mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular", tendKg <= 0 ? "bg-weight-wash text-weight-ink" : "bg-energy-wash text-energy-ink")}>
                      {tendKg <= 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                      Tendencia de pesajes: {fmtSigno(tendKg, 2)} kg/semana
                    </div>
                  )}
                </div>

                <div className="bg-body-wash/45 p-5 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Estimación del modelo para hoy</p>
                      <p className="mt-1 text-xs text-muted-foreground">Calculada a partir de tu último pesaje y balance energético</p>
                    </div>
                    <Chip tone="body">Modelo</Chip>
                  </div>
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="font-display text-5xl font-bold leading-none tabular text-body">{fmtPeso(r.peso.estimadoHoy)}</span>
                    <span className="mb-1 text-base font-medium text-muted-foreground">kg</span>
                    {intervaloHoy && <span className="mb-1 text-xs tabular text-muted-foreground">rango {fmtPeso(intervaloHoy.minimo)}–{fmtPeso(intervaloHoy.maximo)}</span>}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {diasDesdeBascula === 0
                      ? "Coincide con tu pesaje de hoy."
                      : <><span className="font-medium text-foreground tabular">{diasDesdeBascula} días</span> desde la báscula; el rango se ampliará hasta el próximo pesaje.</>}
                    {r.peso.restante != null && <> Según esta estimación, faltan <span className="font-medium text-foreground tabular">{fmtPeso(Math.abs(r.peso.restante))} kg</span> para tu objetivo.</>}
                  </p>
                  <div className="mt-5 border-t border-body-border pt-4 text-xs leading-relaxed text-muted-foreground">
                    Una medición nueva recalibra el modelo. Esta cifra orienta: no sustituye a la báscula.
                  </div>
                  {r.prediccion.disponible && <div className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pr-0 [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible"><PredCell etiqueta="Mañana" iv={r.prediccion.manana} base={r.peso.estimadoHoy} /><PredCell etiqueta="3 días" iv={r.prediccion.tresDias} base={r.peso.estimadoHoy} /><PredCell etiqueta="1 semana" iv={r.prediccion.semana} base={r.peso.estimadoHoy} /><PredCell etiqueta="1 mes" iv={r.prediccion.mes} base={r.peso.estimadoHoy} /></div>}
                </div>
              </div>
            </Card>
          </section>

          <section aria-labelledby="evolucion-real">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="evolucion-real" className="font-display text-xl font-bold">Evolución y proyección</h2>
                <p className="mt-1 text-sm text-muted-foreground">La línea verde recoge pesajes; la ciruela solo comienza donde termina tu última medición.</p>
              </div>
              <div className="flex max-w-full overflow-x-auto rounded-full bg-secondary p-1 [scrollbar-width:none]">
                {RANGOS.map((x) => (
                  <button key={x.id} onClick={() => setRango(x.id)} aria-pressed={rango === x.id} className={cn("h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors", rango === x.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{x.id}</button>
                ))}
              </div>
            </div>
            <Card className="p-4 sm:p-6">
              <div className="mb-5 grid grid-cols-2 gap-4 border-b border-border pb-5 sm:grid-cols-3">
                <Metric label="Inicio del período" value={fmtPeso(statsWin.inicial)} unit="kg" />
                <Metric label="Cambio medido" value={statsWin.cambio != null ? fmtSigno(statsWin.cambio) : "—"} unit="kg" tone={statsWin.cambio != null && statsWin.cambio <= 0 ? "weight" : "energy"} />
                <Metric className="col-span-2 sm:col-span-1" label="Objetivo" value={fmtPeso(r.peso.objetivo)} unit="kg" />
              </div>
              <WeightChart data={datosPeso} objetivo={estado.perfil.pesoObjetivo} />
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded bg-weight" /> Peso medido</span>
                <span className="flex items-center gap-2"><span className="h-0.5 w-5 border-b-2 border-dashed border-body" /> Estimación del modelo</span>
                <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-body/15 ring-1 ring-body/30" /> Rango orientativo</span>
                {estado.perfil.pesoObjetivo != null && <span className="flex items-center gap-2"><span className="h-0.5 w-5 border-b-2 border-dotted border-weight/60" /> Objetivo</span>}
              </div>
            </Card>
          </section>

          <section aria-labelledby="confianza-modelo">
            <details className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <summary id="confianza-modelo" className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4"><span><span className="font-display text-lg font-bold">Confianza del modelo</span><span className="mt-0.5 block text-xs text-muted-foreground">Cómo ha tratado los últimos 14 días.</span></span><Chip tone={CALIDAD_TONE[r.prediccion.modelo?.calidad ?? "inicial"]}>{CALIDAD_LABEL[r.prediccion.modelo?.calidad ?? "inicial"]}</Chip></summary>
              <div className="grid divide-y divide-border sm:grid-cols-[minmax(0,1.15fr)_minmax(14rem,.85fr)] sm:divide-x sm:divide-y-0">
                <div className="p-5 sm:p-6">
                  <p className="text-sm font-semibold">Días que sostienen la tendencia</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-display text-5xl font-bold leading-none tabular text-weight">{lecturaModelo.validos}</span>
                    <span className="mb-1 text-sm text-muted-foreground">días completos</span>
                  </div>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Cuentan desde que marcas algún hábito. Las comidas afinan el cálculo; si faltan, el modelo completa la estimación con el nivel de hábitos.</p>
                </div>
                <div className="bg-secondary/35 p-5 sm:p-6">
                  <p className="text-sm font-semibold">Lectura de la ventana</p>
                  <dl className="mt-3 divide-y divide-border text-sm">
                    <ModeloFila cantidad={lecturaModelo.sinHabitos} etiqueta="Superávit" detalle="sin hábitos marcados" tone="warning" />
                    <ModeloFila cantidad={lecturaModelo.completadosPorHabitos} etiqueta="Estimados" detalle="comida parcial, ajustada por hábitos" tone="energy" />
                    <ModeloFila cantidad={lecturaModelo.sinRegistro} etiqueta="Sin datos" detalle="no cuentan ni se estiman" tone="muted" />
                    <ModeloFila cantidad={lecturaModelo.imputados} etiqueta="Imputados" detalle="aplican tu regla de huecos" tone="body" />
                  </dl>
                </div>
              </div>
              <div className="border-t border-border bg-card px-5 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">Las notas contextuales —viaje, comida libre, enfermedad o entrenamiento especial— quedan visibles en Calendario para interpretar el día, pero no alteran calorías, hábitos ni la predicción.</div>
            </details>
          </section>

          {(composicion || compSerie.length > 1 || ultimaMedicion) && (
            <section aria-labelledby="composicion">
              <div className="mb-3">
                <h2 id="composicion" className="font-display text-xl font-bold">Composición corporal</h2>
                <p className="mt-1 text-sm text-muted-foreground">Aquí solo aparecen mediciones reales; RITMO no extrapola grasa ni masa muscular.</p>
              </div>
              <Card className="gap-5 p-5 sm:p-6">
                {composicion && <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                    <Metric label="Grasa" value={fmtNum(composicion.grasaPct, 1)} unit="%" tone="body" />
                    <Metric label="Masa magra" value={fmtPeso(composicion.magraKg)} unit="kg" tone="weight" />
                    <Metric label="Masa grasa" value={fmtPeso(composicion.grasaKg)} unit="kg" tone="body" />
                    <Metric label="FFMI" value={composicion.ffmi != null ? fmtNum(composicion.ffmi, 1) : "—"} />
                  </div>
                  <div className="mt-5 border-t border-border pt-4">
                    <div className="mb-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>Rango de grasa ({estado.perfil.sexo})</span><span className="tabular">{composicion.rango.min}–{composicion.rango.max}%</span></div>
                    <RangoGrasa valor={composicion.grasaPct} rango={composicion.rango} />
                    <p className="mt-3 text-xs text-muted-foreground">Medición del {fmtFechaCorta(composicion.fecha)} · {relativo(composicion.fecha, hoyISO)}</p>
                  </div>
                </>}
                {compSerie.length > 1 ? <div className="border-t border-border pt-5"><CompositionChart data={compSerie} /><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="text-body">● % grasa</span><span className="text-energy">● masa grasa</span><span className="text-weight">● masa magra</span><span className="text-water">┈ músculo</span></div><p className="mt-2 text-xs text-muted-foreground">Morado usa el eje izquierdo (%); las masas usan el derecho (kg). Son mediciones reales, no estimaciones.</p></div> : <div className="border-t border-border pt-5"><p className="font-medium">Aún falta una segunda medición de composición</p><p className="mt-1 text-sm text-muted-foreground">Registra grasa corporal o masa muscular en diferentes fechas para ver la evolución.</p></div>}
              </Card>
              {ultimaMedicion && (ultimaMedicion.cintura || ultimaMedicion.cadera || ultimaMedicion.pecho || ultimaMedicion.brazo || ultimaMedicion.muslo) && (
                <Card className="mt-4 grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
                  {([['Cintura', ultimaMedicion.cintura], ['Cadera', ultimaMedicion.cadera], ['Pecho', ultimaMedicion.pecho], ['Brazo', ultimaMedicion.brazo], ['Muslo', ultimaMedicion.muslo]] as const).filter(([, value]) => value != null).map(([label, value]) => <Metric key={label} label={label} value={fmtNum(value!, 0)} unit="cm" />)}
                </Card>
              )}
            </section>
          )}

          <section aria-labelledby="historial">
            <SectionLabel action={<span className="text-xs text-muted-foreground tabular">{historial.length} registros</span>}><span id="historial">Historial de mediciones</span></SectionLabel>
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-secondary/35 px-5 py-4 sm:px-6">
                <div><p className="text-sm font-semibold">Registro cronológico</p><p className="mt-0.5 text-xs text-muted-foreground">Cada punto es un pesaje real guardado por ti.</p></div>
                <span className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold tabular text-weight shadow-sm">{historial.length} mediciones reales</span>
              </div>
              <div className="max-h-[30rem] overflow-y-auto px-4 py-1 sm:px-6">
              {[...historial].reverse().map((registro, index, registros) => (
                <div key={registro.fecha} className="relative grid grid-cols-[.8rem_minmax(0,1fr)_auto] items-center gap-2.5 py-3 first:pt-4 last:pb-4 sm:gap-3">
                  <div className="relative flex self-stretch justify-center pt-2">
                    <span className="z-10 size-3 rounded-full border-2 border-card bg-weight shadow-[0_0_0_1px_var(--weight-border)]" />
                    {index < registros.length - 1 && <span className="absolute bottom-[-.75rem] top-4 w-px bg-weight-border" />}
                  </div>
                  <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><p className="text-sm font-semibold tabular">{fmtFechaCorta(registro.fecha)}</p><DeltaTag delta={registro.delta} /></div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{relativo(registro.fecha, hoyISO)} · dato real</span>{registro.grasaPct != null && <Chip tone="body">{fmtNum(registro.grasaPct, 1)}% grasa</Chip>}</div></div>
                  <div className="flex items-center gap-1.5"><span className="rounded-lg bg-weight-wash px-2.5 py-2 font-display text-lg font-bold tabular text-weight sm:px-3 sm:text-xl">{fmtPeso(registro.peso)}<span className="ml-0.5 text-[0.65rem] font-normal text-muted-foreground">kg</span></span>{confirmBorrar === registro.fecha ? <div className="flex items-center gap-1"><Button variant="destructive" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => borrarPesaje(registro.fecha)}><AlertTriangle className="size-3" /> Borrar</Button><Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setConfirmBorrar(null)}>No</Button></div> : <><Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => abrir("peso", registro.fecha)} aria-label={`Editar pesaje del ${fmtFechaCorta(registro.fecha)}`}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmBorrar(registro.fecha)} aria-label={`Eliminar pesaje del ${fmtFechaCorta(registro.fecha)}`}><Trash2 className="size-3.5" /></Button></>}</div>
                </div>
              ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function PredCell({ etiqueta, iv, base }: { etiqueta: string; iv: { peso: number; minimo: number; maximo: number } | null; base?: number | null }) {
  const delta = iv && base != null ? iv.peso - base : null;
  const baja = delta != null && delta <= 0;
  return <div className="w-[calc(100%-2.5rem)] shrink-0 snap-start rounded-xl border border-body-border bg-card/75 p-3 text-center sm:w-auto sm:p-4">
    <p className="text-xs font-semibold text-muted-foreground">{etiqueta}</p>
    <p className="mt-3 font-display text-2xl font-bold leading-none tabular text-body">{iv ? fmtPeso(iv.peso) : "—"}<span className="ml-1 text-xs font-medium text-muted-foreground">kg</span></p>
    {iv && <><p className={cn("mt-2 text-xs font-semibold tabular", baja ? "text-weight" : "text-energy")}>{delta != null ? fmtSigno(delta, 1) : "—"} kg</p><p className="mt-1 text-[0.7rem] tabular text-muted-foreground">{fmtPeso(iv.minimo)}–{fmtPeso(iv.maximo)}</p></>}
  </div>;
}

function ModeloFila({ cantidad, etiqueta, detalle, tone }: { cantidad: number; etiqueta: string; detalle: string; tone: "warning" | "energy" | "body" | "muted" }) {
  const color = tone === "warning" ? "bg-warning" : tone === "energy" ? "bg-energy" : tone === "body" ? "bg-body" : "bg-muted-foreground";
  return <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"><span className={cn("size-2 shrink-0 rounded-full", color)} /><span className="min-w-0 flex-1"><span className="font-medium text-foreground">{etiqueta}</span><span className="text-muted-foreground"> · {detalle}</span></span><span className="font-semibold tabular text-foreground">{cantidad}</span></div>;
}

function DeltaTag({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">Sin cambio</span>;
  const cero = Math.abs(delta) < 0.05;
  const baja = delta < 0;
  return <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold tabular", cero ? "bg-secondary text-muted-foreground" : baja ? "bg-weight-wash text-weight" : "bg-energy-wash text-energy")}>{cero ? <Minus className="size-3" /> : baja ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}{cero ? "0" : fmtSigno(delta, 1)} kg</span>;
}

function RangoGrasa({ valor, rango }: { valor: number; rango: { min: number; max: number; atleta: number } }) {
  const escala = Math.max(rango.max + 12, valor + 4);
  const pos = Math.min(100, (valor / escala) * 100);
  const zonaMin = (rango.min / escala) * 100;
  const zonaMax = (rango.max / escala) * 100;
  return <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary"><div className="absolute inset-y-0 rounded-full bg-weight/30" style={{ left: `${zonaMin}%`, width: `${zonaMax - zonaMin}%` }} /><div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-body" style={{ left: `${pos}%` }} /></div>;
}
