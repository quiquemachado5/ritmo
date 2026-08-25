"use client";

import * as React from "react";
import { Award, Flame, Gauge, Scale, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { pesajes as getPesajes, recordsPersonales, resumen, resumenPorMes, serieBalance, seriePesoDiaria } from "@/lib/model/analytics";
import { hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WeightChart, BalanceChart, type PuntoPeso } from "@/components/app/charts";
import { Metric, SectionLabel, Chip, EmptyState } from "@/components/app/primitives";
import { fmtPeso, fmtSigno, fmtKcal, fmtFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGOS = [
  { id: "1M", dias: 30 },
  { id: "3M", dias: 90 },
  { id: "6M", dias: 180 },
  { id: "1A", dias: 365 },
  { id: "Todo", dias: Infinity },
] as const;

// Calidad del modelo → lenguaje visual RITMO (color por dato, nunca decorativo).
const CALIDAD_LABEL = { inicial: "inicial", media: "media", alta: "alta" } as const;
const CALIDAD_TONE = { inicial: "muted", media: "habit", alta: "weight" } as const;
const CALIDAD_ICON = { inicial: "text-muted-foreground", media: "text-habit", alta: "text-weight" } as const;

export default function ProgresoPage() {
  const { estado, cargando } = useRitmo();
  const [rango, setRango] = React.useState<(typeof RANGOS)[number]["id"]>("3M");

  const r = React.useMemo(() => resumen(estado), [estado]);

  const { datosPeso, datosBalance, statsWin } = React.useMemo(() => {
    const todos = getPesajes(estado);
    const dias = RANGOS.find((x) => x.id === rango)!.dias;
    const desde = dias === Infinity ? "0000-01-01" : sumarDias(hoy(), -dias);
    const win = todos.filter((p) => p.fecha >= desde);

    // Serie DIARIA: el estimado avanza cada día con el balance energético y se
    // re-ancla en cada báscula. Antes sólo había un punto por pesaje, así que
    // la línea se quedaba en el último peso real y nunca reflejaba el de hoy.
    const pesoData: PuntoPeso[] = seriePesoDiaria(estado, desde, hoy()).map((d) => ({
      label: fmtFechaCorta(d.fecha),
      real: d.real,
      pred: d.estimado,
      banda: null,
    }));

    // Proyección futura, con la banda de confianza del modelo.
    for (const [dias, iv] of [[14, r.prediccion.quincena], [30, r.prediccion.mes]] as const) {
      if (!iv) continue;
      pesoData.push({
        label: fmtFechaCorta(sumarDias(hoy(), dias)),
        real: null,
        pred: iv.peso,
        banda: [iv.minimo, iv.maximo],
      });
    }

    const balDias = dias === Infinity ? 90 : Math.min(dias, 90);
    const balData = serieBalance(estado, balDias).map((b) => ({
      label: fmtFechaCorta(b.fecha),
      balance: b.balance,
      imputado: b.imputado,
    }));

    const inicialWin = win.length ? win[0] : null;
    const actualWin = win.length ? win[win.length - 1] : null;
    return {
      datosPeso: pesoData,
      datosBalance: balData,
      statsWin: {
        inicial: inicialWin?.peso ?? null,
        actual: actualWin?.peso ?? null,
        cambio: inicialWin && actualWin ? Math.round((actualWin.peso - inicialWin.peso) * 10) / 10 : null,
      },
    };
  }, [estado, rango, r]);

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-72 w-full rounded-xl" /><Skeleton className="h-56 w-full rounded-xl" /></div>;

  const tendKg = r.prediccion.modelo?.kgSemana ?? r.tendencia?.kgSemana ?? null;
  const hayPesajes = r.peso.registros > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Progreso</h1>
      </header>

      {!hayPesajes ? (
        <EmptyState title="Aún no hay datos de peso">
          Registra tu peso con regularidad para ver tu evolución y la predicción.
        </EmptyState>
      ) : (
        <>
          {/* Resumen — real, estimado y objetivo siempre diferenciados */}
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
              <Metric
                label="Tendencia"
                value={tendKg != null ? fmtSigno(tendKg, 2) : "—"}
                unit="kg/sem"
                tone={tendKg != null && tendKg <= 0 ? "weight" : "energy"}
                hint={statsWin.cambio != null ? <span className="text-[0.7rem] text-muted-foreground">{fmtSigno(statsWin.cambio)} kg en {rango}</span> : undefined}
              />
            </Card>
          </div>

          {/* Gráfica de peso */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel className="mb-0">Peso real vs. estimado</SectionLabel>
              <div className="flex gap-1 rounded-full bg-secondary p-0.5">
                {RANGOS.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setRango(x.id)}
                    className={cn(
                      "h-9 rounded-full px-3 text-xs font-medium transition-colors",
                      rango === x.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {x.id}
                  </button>
                ))}
              </div>
            </div>
            <WeightChart data={datosPeso} objetivo={estado.perfil.pesoObjetivo} />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-weight" /> Real (báscula)</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-b-2 border-dashed border-weight" /> Estimado (diario)</span>
              {estado.perfil.pesoObjetivo && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-b-2 border-dotted border-weight" /> Objetivo</span>}
            </div>
          </Card>

          {/* Predicción */}
          {r.prediccion.disponible && (
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <SectionLabel className="mb-0">Predicción</SectionLabel>
                <Chip tone={CALIDAD_TONE[r.prediccion.modelo?.calidad ?? "inicial"]}>
                  confianza {CALIDAD_LABEL[r.prediccion.modelo?.calidad ?? "inicial"]}
                </Chip>
              </div>

              {/* Proyecciones */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
                <PredCell etiqueta="Mañana" iv={r.prediccion.manana} />
                <PredCell etiqueta="En 1 semana" iv={r.prediccion.semana} />
                <PredCell etiqueta="En 15 días" iv={r.prediccion.quincena} />
                <PredCell etiqueta="En 1 mes" iv={r.prediccion.mes} />
              </div>

              {/* Lecturas: mismo patrón que el resumen semanal */}
              <div className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4 text-sm">
                <div className="flex items-start gap-3">
                  <Gauge className={cn("size-4 shrink-0", CALIDAD_ICON[r.prediccion.modelo?.calidad ?? "inicial"])} />
                  <span className="text-muted-foreground">
                    {r.prediccion.modelo?.calidad === "alta"
                      ? <>Calibrada con tu TDEE observado{r.prediccion.modelo?.tdee ? <> (~<span className="tabular font-medium text-foreground">{r.prediccion.modelo.tdee}</span> kcal/día)</> : null}. Rango al 80% de confianza.</>
                      : r.prediccion.modelo?.calidad === "media"
                        ? "Basada en tu balance calórico. Registra más comidas para estrechar el rango."
                        : <>Estimación inicial con <span className="tabular font-medium text-foreground">{r.prediccion.pesajes}</span> pesajes. Registra comidas para afinarla.</>}
                  </span>
                </div>

                {r.prediccion.diasSinPesaje != null && (
                  <div className="flex items-start gap-3">
                    <Scale className={cn("size-4 shrink-0", r.prediccion.diasSinPesaje > 21 ? "text-warning" : r.prediccion.diasSinPesaje === 0 ? "text-weight" : "text-muted-foreground")} />
                    <span className="text-muted-foreground">
                      {r.prediccion.diasSinPesaje === 0
                        ? "Reanclada con el pesaje de hoy."
                        : r.prediccion.diasSinPesaje > 21
                          ? <>Llevas <span className="tabular font-medium text-foreground">{r.prediccion.diasSinPesaje}</span> días sin pesarte: la banda se abre.{r.prediccion.proximoPesaje ? <> Pésate hacia <span className="font-medium text-foreground">{fmtFechaCorta(r.prediccion.proximoPesaje)}</span>.</> : null}</>
                          : <>Último pesaje hace <span className="tabular font-medium text-foreground">{r.prediccion.diasSinPesaje}</span> {r.prediccion.diasSinPesaje === 1 ? "día" : "días"}.</>}
                    </span>
                  </div>
                )}

                {r.prediccion.modelo?.kgSemana != null && r.peso.objetivo != null && r.prediccion.modelo.kgSemana > 0.05 && (
                  <div className="flex items-start gap-3">
                    <TrendingUp className="size-4 shrink-0 text-energy" />
                    <span className="text-muted-foreground">
                      Tiende a subir <span className="tabular font-medium text-foreground">{fmtSigno(r.prediccion.modelo.kgSemana, 2)}</span> kg/sem. Revisa tu balance energético.
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Balance calórico */}
          <Card className="p-5">
            <SectionLabel>Balance calórico diario</SectionLabel>
            <BalanceChart data={datosBalance} />
            <p className="mt-3 text-xs text-muted-foreground">
              Verde = déficit (peso a la baja) · terracota = superávit. Las barras translúcidas son días imputados.
            </p>
          </Card>

          {/* Records personales + comparativa mensual */}
          <RecordsYComparativa />
        </>
      )}
    </div>
  );
}

/** Records contra tu propio histórico + este mes vs. el anterior. Solo aparece
    cuando hay suficiente historia para que diga algo. */
function RecordsYComparativa() {
  const { estado } = useRitmo();
  const rec = React.useMemo(() => recordsPersonales(estado), [estado]);
  const meses = React.useMemo(() => resumenPorMes(estado), [estado]);
  const esteMes = meses[0] ?? null;
  const mesPrevio = meses[1] ?? null;

  const hayRecords = rec.mejorMesAdherencia || rec.mayorPerdidaMes || rec.totalDiasRegistrados > 0;
  if (!hayRecords) return null;

  const deltaAdh = esteMes && mesPrevio ? esteMes.adherenciaMedia - mesPrevio.adherenciaMedia : null;

  return (
    <Card className="p-5">
      <SectionLabel>Tus records</SectionLabel>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        <RecordCell
          icon={<Award className="size-4 text-streak" />}
          etiqueta="Mejor racha"
          valor={String(record_racha(estado))}
          unidad="días"
        />
        {rec.mejorMesAdherencia && (
          <RecordCell
            icon={<Flame className="size-4 text-habit" />}
            etiqueta="Mejor mes"
            valor={`${rec.mejorMesAdherencia.adherenciaMedia}%`}
            sub={rec.mejorMesAdherencia.etiqueta}
          />
        )}
        {rec.mayorPerdidaMes && (
          <RecordCell
            icon={<TrendingDown className="size-4 text-weight" />}
            etiqueta="Mayor pérdida"
            valor={fmtSigno(rec.mayorPerdidaMes.cambioPeso as number, 1)}
            unidad="kg"
            sub={rec.mayorPerdidaMes.etiqueta}
          />
        )}
        <RecordCell
          icon={<Utensils className="size-4 text-energy" />}
          etiqueta="Comidas"
          valor={String(rec.totalComidas)}
          sub={`${rec.totalDiasRegistrados} días activos`}
        />
      </div>

      {esteMes && mesPrevio && deltaAdh != null && (
        <div className="mt-5 flex items-start gap-3 border-t border-border pt-4 text-sm">
          {deltaAdh >= 0
            ? <TrendingUp className="size-4 shrink-0 text-weight" />
            : <TrendingDown className="size-4 shrink-0 text-energy" />}
          <span className="text-muted-foreground">
            Este mes ({esteMes.etiqueta}) llevas <span className="tabular font-medium text-foreground">{esteMes.adherenciaMedia}%</span> de constancia,{" "}
            {deltaAdh === 0
              ? "igual que"
              : <><span className="tabular font-medium text-foreground">{Math.abs(deltaAdh)} pts</span> {deltaAdh > 0 ? "por encima" : "por debajo"} de</>}{" "}
            {mesPrevio.etiqueta}{mesPrevio.cambioPeso != null ? <> · entonces {mesPrevio.cambioPeso <= 0 ? "perdiste" : "ganaste"} <span className="tabular font-medium text-foreground">{fmtPeso(Math.abs(mesPrevio.cambioPeso))}</span> kg</> : null}.
          </span>
        </div>
      )}
    </Card>
  );
}

function record_racha(estado: Parameters<typeof recordsPersonales>[0]): number {
  const r = resumen(estado);
  return r.habitos.mejorRacha.longitud;
}

function RecordCell({ icon, etiqueta, valor, unidad, sub }: { icon: React.ReactNode; etiqueta: string; valor: string; unidad?: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {icon} {etiqueta}
      </span>
      <span className="font-display text-xl font-bold leading-none tabular">
        {valor}{unidad && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unidad}</span>}
      </span>
      {sub && <span className="text-[0.68rem] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function PredCell({ etiqueta, iv }: { etiqueta: string; iv: { peso: number; minimo: number; maximo: number } | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{etiqueta}</span>
      <span className="font-display text-xl font-bold leading-none tabular text-weight">
        {iv ? fmtPeso(iv.peso) : "—"}
        <span className="ml-0.5 text-xs font-medium text-muted-foreground">kg</span>
      </span>
      {iv && (
        <span className="text-[0.68rem] text-muted-foreground tabular">
          {fmtPeso(iv.minimo)}–{fmtPeso(iv.maximo)} kg
        </span>
      )}
    </div>
  );
}
