"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Pencil,
  Database,
  Gauge,
  Ruler,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { curvaBalanceModelo, energiaDe, pesajes as getPesajes, resumen, seriePesoDiaria } from "@/lib/model/analytics";
import { hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PuntoPeso } from "@/components/app/charts";
import { Metric, SectionLabel, Chip, EmptyState } from "@/components/app/primitives";
import { capitalizar, fmtPeso, fmtSigno, fmtNum, fmtFechaCorta, relativo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DataLegend } from "@/components/app/data-legend";
import { ModelAudit } from "@/components/app/model-audit";
import { evaluarCicloModelos } from "@/lib/model-audit/lifecycle";

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
type HistorialRegistro = { fecha: string; peso: number; delta: number | null; grasaPct: number | null };
/**
 * Pantalla única de evolución corporal. Los datos de báscula y composición son
 * hechos registrados; el modelo ocupa deliberadamente su propio bloque.
 */
export default function ProgresoPage() {
  const { estado, auditoriaModelo, cargando, medicion, actualizarDia, borrarMedicion } = useRitmo();
  const { abrir } = useQuickLog();
  const [rango, setRango] = React.useState<(typeof RANGOS)[number]["id"]>("1A");
  const [confirmBorrar, setConfirmBorrar] = React.useState<string | null>(null);
  const hoyISO = hoy();
  const cicloModelo = React.useMemo(
    () => evaluarCicloModelos(estado, auditoriaModelo.predicciones, hoyISO),
    [estado, auditoriaModelo.predicciones, hoyISO],
  );
  const r = React.useMemo(() => resumen(estado, cicloModelo.estrategia), [estado, cicloModelo.estrategia]);
  const curvaModelo = React.useMemo(() => curvaBalanceModelo(estado), [estado]);
  // Algunos historiales pueden ofrecer proyecciones futuras antes de tener un
  // intervalo calibrado para hoy. La UI no debe asumir que ese rango existe.
  const intervaloHoy = r.prediccion.hoy ?? null;

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
    })) satisfies HistorialRegistro[];
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
  const historialDesc = React.useMemo(() => [...historial].reverse(), [historial]);
  const cambioTotal = historial.length > 1 ? Math.round((historial[historial.length - 1].peso - historial[0].peso) * 10) / 10 : null;
  const historialPorMes = React.useMemo(() => {
    const grupos: Array<{ mes: string; registros: HistorialRegistro[]; cambio: number | null }> = [];
    for (const registro of historialDesc) {
      const mes = capitalizar(new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(`${registro.fecha}T00:00:00`)));
      let grupo = grupos[grupos.length - 1];
      if (!grupo || grupo.mes !== mes) {
        grupo = { mes, registros: [], cambio: null };
        grupos.push(grupo);
      }
      grupo.registros.push(registro);
    }
    return grupos.map((grupo) => {
      const primero = grupo.registros[grupo.registros.length - 1];
      const ultimo = grupo.registros[0];
      return {
        ...grupo,
        cambio: grupo.registros.length > 1 ? Math.round((ultimo.peso - primero.peso) * 10) / 10 : null,
      };
    });
  }, [historialDesc]);
  const lecturaHistorial = React.useMemo(() => {
    const pesos = historial.map((x) => x.peso);
    const minimo = pesos.length ? Math.min(...pesos) : null;
    const maximo = pesos.length ? Math.max(...pesos) : null;
    const mejorBajada = historial.reduce<HistorialRegistro | null>((mejor, actual) => {
      if (actual.delta == null || actual.delta >= 0) return mejor;
      if (!mejor || (mejor.delta != null && actual.delta < mejor.delta)) return actual;
      return mejor;
    }, null);
    return {
      primero: historial[0] ?? null,
      ultimo: historial[historial.length - 1] ?? null,
      minimo,
      maximo,
      mejorBajada,
    };
  }, [historial]);

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
    if (medicion(fecha)) { if (!await borrarMedicion(fecha)) return; }
    else if (!await actualizarDia(fecha, { peso: undefined })) return;
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
  const cambioModeloDesdeBascula = r.peso.actual != null && r.peso.estimadoHoy != null
    ? Math.round((r.peso.estimadoHoy - r.peso.actual) * 10) / 10
    : null;
  const composicionModelo = r.prediccion.composicion;
  const ritmoModelo = r.prediccion.modelo?.kgSemana ?? null;
  const retencionHoy = r.prediccion.modelo?.retencionLiquidosHoyKg ?? 0;
  const retencionManana = r.prediccion.modelo?.retencionLiquidosMananaKg ?? 0;
  const energiaHoyModelo = energiaDe(estado, hoyISO);
  const siguienteDato = diasDesdeBascula >= 7
    ? "un pesaje nuevo, preferiblemente al levantarte"
    : energiaHoyModelo.sinRegistro
      ? "marcar al menos un hábito de hoy"
      : energiaHoyModelo.ingestaIncompleta
        ? "revisar las cantidades de las comidas estimadas"
        : "mantener el próximo pesaje en condiciones parecidas";
  const explicacionModelo = retencionHoy > 0
    ? `El alcohol reciente puede sumar unos ${fmtPeso(retencionHoy)} kg de líquido hoy; no es grasa.`
    : retencionManana > 0
      ? `Al no marcar “Sin alcohol” hoy, mañana se contemplan unos ${fmtPeso(retencionManana)} kg de líquido.`
      : ritmoModelo == null
    ? "Una nueva medición recalibrará esta orientación."
    : Math.abs(ritmoModelo) < 0.1
      ? "Tu ritmo reciente apunta a un peso estable."
      : ritmoModelo < 0
        ? "Tus registros recientes apuntan a una bajada gradual."
        : "Tus registros recientes apuntan a una subida gradual.";

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
        <EmptyState icon={<Scale className="size-8" />} title="Empieza con una medición real" unlocks={["1 pesaje: punto de partida", "2 pesajes: cambio real", "4+ pesajes: error personalizado"]} action={<Button onClick={() => abrir("peso")} className="mt-1 gap-2"><Scale className="size-4" /> Registrar peso</Button>}>
          Con pesajes regulares, RITMO podrá separar tu evolución real de la estimación del modelo.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="estado-actual">
            <h2 id="estado-actual" className="sr-only">Estado actual</h2>
            <Card className="overflow-hidden p-0">
              <div className="grid divide-y divide-border lg:grid-cols-[1.15fr_.85fr] lg:divide-x lg:divide-y-0">
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
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Estimación del modelo para hoy</p>
                      <p className="mt-1 text-xs text-muted-foreground">Orientación desde tu último pesaje</p>
                    </div>
                    <Chip tone="body">Modelo</Chip>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="font-display text-3xl font-bold leading-none tabular text-body">{fmtPeso(r.peso.estimadoHoy)}</span>
                    <span className="mb-1 text-base font-medium text-muted-foreground">kg</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {diasDesdeBascula === 0
                      ? "Coincide con tu pesaje de hoy."
                      : cambioModeloDesdeBascula != null
                        ? <><span className={cn("font-semibold tabular", cambioModeloDesdeBascula <= 0 ? "text-weight" : "text-energy")}>{fmtSigno(cambioModeloDesdeBascula, 1)} kg</span> desde la última medición.</>
                        : "Se actualizará con tu próxima medición."}
                    {intervaloHoy && <span className="ml-1.5 tabular">Rango {fmtPeso(intervaloHoy.minimo)}–{fmtPeso(intervaloHoy.maximo)} kg.</span>}
                  </p>
                  {r.prediccion.disponible && (
                    <div className="mt-4 border-t border-body-border pt-4">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-[0.68rem] font-semibold text-muted-foreground">Si mantienes el ritmo</p>
                        <p className={cn("text-[0.68rem]", retencionHoy > 0 || retencionManana > 0 ? "text-water-ink" : "text-body-ink")}>{explicacionModelo}</p>
                      </div>
                      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pr-0 [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible">
                        <PredCell etiqueta="Mañana" iv={r.prediccion.manana} base={r.peso.estimadoHoy} />
                        <PredCell etiqueta="3 días" iv={r.prediccion.tresDias} base={r.peso.estimadoHoy} />
                        <PredCell etiqueta="1 semana" iv={r.prediccion.semana} base={r.peso.estimadoHoy} />
                        <PredCell etiqueta="2 semanas" iv={r.prediccion.quincena} base={r.peso.estimadoHoy} />
                        <PredCell etiqueta="4 semanas" iv={r.prediccion.cuatroSemanas} base={r.peso.estimadoHoy} />
                      </div>
                      {composicionModelo && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[0.68rem] text-muted-foreground">
                          <p><span className="font-semibold text-foreground">Composición estimada</span> · no es una medición</p>
                          <p className="tabular">
                            Hoy: <span className="font-semibold text-body-ink">{fmtPeso(composicionModelo.hoy.grasaKg)} kg grasa</span> · {fmtPeso(composicionModelo.hoy.magraKg)} kg masa libre
                            {composicionModelo.hoy.liquidoTransitorioKg > 0 && <span className="text-water-ink"> · +{fmtPeso(composicionModelo.hoy.liquidoTransitorioKg)} kg líquido</span>}
                            <span className="mx-1.5 text-border">→</span>
                            4 sem.: <span className="font-semibold text-body-ink">{fmtPeso(composicionModelo.cuatroSemanas.grasaKg)} kg</span> · {fmtPeso(composicionModelo.cuatroSemanas.magraKg)} kg
                          </p>
                        </div>
                      )}
                      <p className="mt-2 text-[0.68rem] text-muted-foreground"><span className="font-semibold text-foreground">Para afinarlo:</span> {siguienteDato}.</p>
                    </div>
                  )}
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
              <DataLegend className="mt-4" items={[{ label: "Peso medido", colorVar: "--weight" }, { label: "Estimación del modelo", colorVar: "--body", style: "dashed" }, { label: "Rango orientativo", colorVar: "--body", style: "wash" }, ...(estado.perfil.pesoObjetivo != null ? [{ label: "Objetivo", colorVar: "--weight" as const, style: "dotted" as const }] : [])]} />
            </Card>
          </section>

          <section aria-labelledby="confianza-modelo">
            <details className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <summary id="confianza-modelo" className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none sm:px-6">
                <span className="min-w-0">
                  <span className="font-display text-lg font-bold">Precisión y datos del modelo</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {r.prediccion.modelo?.errorHistoricoKg != null
                      ? `MAE histórico de ${fmtPeso(r.prediccion.modelo.errorHistoricoKg)} kg en ${r.prediccion.modelo.prediccionesEvaluadas} predicciones`
                      : "Se mostrará cuando existan suficientes tramos de pesaje para evaluarlo"}
                  </span>
                </span>
                <Chip tone={CALIDAD_TONE[r.prediccion.modelo?.calidad ?? "inicial"]}>{CALIDAD_LABEL[r.prediccion.modelo?.calidad ?? "inicial"]}</Chip>
              </summary>
              <ModelAudit />
              <div className="grid divide-y divide-border sm:grid-cols-[minmax(0,1.15fr)_minmax(14rem,.85fr)] sm:divide-x sm:divide-y-0">
                <div className="p-5 sm:p-6">
                  <p className="text-sm font-semibold">Días que sostienen la tendencia</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-display text-5xl font-bold leading-none tabular text-weight">{lecturaModelo.validos}</span>
                    <span className="mb-1 text-sm text-muted-foreground">días completos</span>
                  </div>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Cuentan desde que marcas algún hábito. Las comidas afinan el cálculo; si faltan, la predicción usa la curva aprendida de tu histórico.</p>
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
              <div className="border-t border-border bg-card px-5 py-5 sm:px-6 sm:py-6">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div><p className="text-sm font-semibold">Cómo se comportó con tu historial</p><p className="mt-0.5 text-xs text-muted-foreground">Se oculta cada siguiente pesaje y se usan los anteriores y los hábitos del tramo.</p></div>
                  {r.prediccion.hoy && <span className="hidden text-right text-xs tabular text-muted-foreground sm:block">Rango de hoy<br /><strong className="font-semibold text-foreground">{fmtPeso(r.prediccion.hoy.minimo)}–{fmtPeso(r.prediccion.hoy.maximo)} kg</strong></span>}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {r.prediccion.modelo?.errorUltimoPesoKg != null ? `Sin modelo, repetir el último peso habría tenido un error medio de ${fmtPeso(r.prediccion.modelo.errorUltimoPesoKg)} kg. ` : "Añade pesajes en fechas distintas para comparar el modelo con repetir el último peso. "}
                  {r.prediccion.modelo?.coberturaIntervaloPct != null ? `En el ensayo histórico, bandas fijadas con errores anteriores incluyeron el siguiente peso en el ${r.prediccion.modelo.coberturaIntervaloPct}% de ${r.prediccion.modelo.intervalosEvaluados} tramos. Esta cobertura no garantiza la del rango de tu proyección futura.` : "Aún faltan tramos para evaluar las bandas del ensayo histórico."}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Es un ensayo retrospectivo condicionado a hábitos ya registrados, no una predicción guardada ni una garantía sobre el futuro. Las fechas anteriores al primer historial de configuración usan un supuesto inicial fijo, no ajustes observados entonces.</p>
                <div className="grid overflow-hidden rounded-xl border border-border bg-secondary/20 sm:grid-cols-3 sm:divide-x sm:divide-border">
                  <ModeloDato icon={Gauge} label="MAE observado" value={r.prediccion.modelo?.errorHistoricoKg != null ? `${fmtPeso(r.prediccion.modelo.errorHistoricoKg)} kg` : "—"} detail="error absoluto medio del backtest" />
                  <ModeloDato icon={Ruler} label="80% de los tramos" value={r.prediccion.modelo?.errorHistoricoP80Kg != null ? `≤ ${fmtPeso(r.prediccion.modelo.errorHistoricoP80Kg)} kg` : "—"} detail="error que no se superó en 8 de cada 10 casos" />
                  <ModeloDato icon={Database} label="Datos evaluados" value={r.prediccion.modelo?.prediccionesEvaluadas ? `${r.prediccion.modelo.prediccionesEvaluadas} predicciones` : "Aún insuficientes"} detail={`${r.prediccion.modelo?.puntos ?? 0} pesajes · ${r.prediccion.modelo?.coberturaHistorica ?? 0}% de cobertura`} />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">El rango de cada fecha combina este error histórico con los días sin pesaje y la calidad de los registros recientes. El punto de partida usa sexo, edad, altura, actividad y objetivo; después cada tramo cerrado recalibra la respuesta a tus hábitos.</p>
                <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Balance diario estimado según hábitos cumplidos">
                  {curvaModelo.map(({ balance, cumplidos, total }) => (
                    <div key={cumplidos} className={cn("min-w-16 flex-1 rounded-lg border px-1.5 py-2 text-center", balance > 0 ? "border-energy-border bg-energy-wash text-energy-ink" : "border-weight-border bg-weight-wash text-weight-ink")}>
                      <p className="text-[0.65rem] font-semibold tabular">{cumplidos}/{total}</p>
                      <p className="mt-1 text-[0.68rem] font-bold tabular">{fmtSigno(balance, 0)} kcal</p>
                    </div>
                  ))}
                </div>
              </div>
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
                {compSerie.length > 1 ? <div className="border-t border-border pt-5"><CompositionChart data={compSerie} /><DataLegend className="mt-3" items={[{ label: "% grasa", colorVar: "--body" }, { label: "Masa grasa", colorVar: "--energy" }, { label: "Masa magra", colorVar: "--weight" }, { label: "Músculo", colorVar: "--water", style: "dashed" }]} /><p className="mt-2 text-xs text-muted-foreground">% de grasa usa el eje izquierdo; las masas usan el derecho (kg). Son mediciones reales, no estimaciones.</p></div> : <div className="border-t border-border pt-5"><p className="font-medium">Aún falta una segunda medición de composición</p><p className="mt-1 text-sm text-muted-foreground">Registra grasa corporal o masa muscular en otra fecha para desbloquear la gráfica conjunta.</p></div>}
              </Card>
              {ultimaMedicion && (ultimaMedicion.cintura || ultimaMedicion.cadera || ultimaMedicion.pecho || ultimaMedicion.brazo || ultimaMedicion.muslo) && (
                <Card className="mt-4 grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
                  {([['Cintura', ultimaMedicion.cintura], ['Cadera', ultimaMedicion.cadera], ['Pecho', ultimaMedicion.pecho], ['Brazo', ultimaMedicion.brazo], ['Muslo', ultimaMedicion.muslo]] as const).filter(([, value]) => value != null).map(([label, value]) => <Metric key={label} label={label} value={fmtNum(value!, 0)} unit="cm" />)}
                </Card>
              )}
            </section>
          )}

          <section aria-labelledby="historial">
            <SectionLabel action={<span className="text-xs font-medium text-muted-foreground">{historial.length} registros</span>}><span id="historial">Historial de mediciones</span></SectionLabel>
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-4 overflow-x-auto border-b border-border bg-secondary/25 px-4 py-3 [scrollbar-width:none] sm:px-5">
                <div className="flex shrink-0 items-baseline gap-2.5 border-r border-border pr-4">
                  <span className="font-display text-3xl font-bold leading-none tabular text-weight">{fmtPeso(lecturaHistorial.ultimo?.peso)}<span className="ml-1 text-xs font-medium text-muted-foreground">kg</span></span>
                  <DeltaTag delta={cambioTotal} />
                </div>
                <div className="grid min-w-[32rem] flex-1 grid-cols-4 gap-4">
                  <HistorialStat label="Inicio" value={fmtPeso(lecturaHistorial.primero?.peso)} detail={lecturaHistorial.primero ? fmtFechaCorta(lecturaHistorial.primero.fecha) : "—"} />
                  <HistorialStat label="Mínimo" value={fmtPeso(lecturaHistorial.minimo)} detail="mejor lectura" tone="text-weight" />
                  <HistorialStat label="Máximo" value={fmtPeso(lecturaHistorial.maximo)} detail="pico registrado" tone="text-energy" />
                  <HistorialStat label="Mejor salto" value={lecturaHistorial.mejorBajada?.delta != null ? fmtSigno(lecturaHistorial.mejorBajada.delta, 1) : "—"} detail={lecturaHistorial.mejorBajada ? fmtFechaCorta(lecturaHistorial.mejorBajada.fecha) : "sin tramo"} tone="text-weight" />
                </div>
              </div>
              <div className="bg-card">
                {historialPorMes.map((grupo) => (
                  <section key={grupo.mes} className="border-b border-border last:border-b-0">
                    <div className="flex min-h-11 items-center justify-between gap-3 bg-secondary/35 px-4 py-2 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2.5"><h3 className="truncate text-sm font-semibold">{grupo.mes}</h3><span className="text-xs text-muted-foreground">{grupo.registros.length}</span></div>
                      <DeltaTag delta={grupo.cambio} compact />
                    </div>
                    <div className="divide-y divide-border">
                      {grupo.registros.map((registro) => (
                        <PesajeTimelineRow
                          key={registro.fecha}
                          registro={registro}
                          hoyISO={hoyISO}
                          confirmando={confirmBorrar === registro.fecha}
                          onEditar={() => abrir("peso", registro.fecha)}
                          onPedirBorrar={() => setConfirmBorrar(registro.fecha)}
                          onCancelarBorrar={() => setConfirmBorrar(null)}
                          onBorrar={() => borrarPesaje(registro.fecha)}
                        />
                      ))}
                    </div>
                  </section>
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

function ModeloDato({ icon: Icon, label, value, detail }: { icon: typeof Gauge; label: string; value: string; detail: string }) {
  return <div className="border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-3.5" aria-hidden /><p className="text-[0.68rem] font-semibold">{label}</p></div><p className="mt-2 font-display text-xl font-bold tabular text-foreground">{value}</p><p className="mt-1 text-[0.68rem] leading-snug text-muted-foreground">{detail}</p></div>;
}

function DeltaTag({ delta, compact = false }: { delta: number | null; compact?: boolean }) {
  if (delta == null) return <span className={cn("rounded-full bg-secondary text-muted-foreground", compact ? "px-1.5 py-0.5 text-[0.65rem]" : "px-2 py-1 text-xs")}>Sin cambio</span>;
  const cero = Math.abs(delta) < 0.05;
  const baja = delta < 0;
  return <span className={cn("inline-flex items-center gap-0.5 rounded-full font-semibold tabular", compact ? "px-1.5 py-0.5 text-[0.65rem]" : "px-2 py-1 text-xs", cero ? "bg-secondary text-muted-foreground" : baja ? "bg-weight-wash text-weight" : "bg-energy-wash text-energy")}>{cero ? <Minus className="size-3" /> : baja ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}{cero ? "0" : fmtSigno(delta, 1)} kg</span>;
}

function HistorialStat({ label, value, detail, tone = "text-foreground" }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-lg font-bold leading-none tabular", tone)}>{value}</p>
      <p className="mt-0.5 truncate text-[0.62rem] text-muted-foreground">{detail}</p>
    </div>
  );
}

function PesajeTimelineRow({
  registro,
  hoyISO,
  confirmando,
  onEditar,
  onPedirBorrar,
  onCancelarBorrar,
  onBorrar,
}: {
  registro: HistorialRegistro;
  hoyISO: string;
  confirmando: boolean;
  onEditar: () => void;
  onPedirBorrar: () => void;
  onCancelarBorrar: () => void;
  onBorrar: () => void;
}) {
  const fecha = new Date(`${registro.fecha}T00:00:00`);
  const dia = new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(fecha);
  const mes = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(fecha).replace(".", "");
  return (
    <article className="group grid grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2 transition-colors hover:bg-secondary/35 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-5 sm:py-2.5">
      <div className="text-center">
        <p className="font-display text-base font-bold leading-none tabular sm:text-lg">{dia}</p>
        <p className="mt-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-[0.62rem]">{mes}</p>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-x-2">
          <p className="shrink-0 font-display text-lg font-bold leading-none tabular text-weight sm:text-xl">{fmtPeso(registro.peso)}<span className="ml-0.5 text-[0.62rem] font-medium text-muted-foreground">kg</span></p>
          <DeltaTag delta={registro.delta} compact />
          {registro.grasaPct != null ? <Chip tone="body">{fmtNum(registro.grasaPct, 1)}% grasa</Chip> : null}
          <span className="ml-auto hidden text-[0.68rem] text-muted-foreground sm:inline">{relativo(registro.fecha, hoyISO)}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1">
        {confirmando ? (
          <div className="flex items-center gap-1 rounded-lg bg-card">
            <Button variant="destructive" size="sm" className="h-8 gap-1 rounded-lg px-2 text-xs" onClick={onBorrar}><AlertTriangle className="size-3" /><span className="hidden sm:inline">Borrar</span></Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs" onClick={onCancelarBorrar}>No</Button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 rounded-lg bg-secondary/45 p-0.5 opacity-90 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="size-10 rounded-md text-muted-foreground hover:bg-card hover:text-weight sm:size-8" onClick={onEditar} aria-label={`Editar pesaje del ${fmtFechaCorta(registro.fecha)}`}><Pencil className="size-3.5" /></Button>
            <Button variant="ghost" size="icon" className="size-10 rounded-md text-muted-foreground hover:bg-card hover:text-destructive sm:size-8" onClick={onPedirBorrar} aria-label={`Eliminar pesaje del ${fmtFechaCorta(registro.fecha)}`}><Trash2 className="size-3.5" /></Button>
          </div>
        )}
      </div>
    </article>
  );
}

function RangoGrasa({ valor, rango }: { valor: number; rango: { min: number; max: number; atleta: number } }) {
  const escala = Math.max(rango.max + 12, valor + 4);
  const pos = Math.min(100, (valor / escala) * 100);
  const zonaMin = (rango.min / escala) * 100;
  const zonaMax = (rango.max / escala) * 100;
  return <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary"><div className="absolute inset-y-0 rounded-full bg-weight/30" style={{ left: `${zonaMin}%`, width: `${zonaMax - zonaMin}%` }} /><div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-body" style={{ left: `${pos}%` }} /></div>;
}
