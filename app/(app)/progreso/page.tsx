"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { pesajes as getPesajes, resumen, serieBalance, seriePesoDiaria } from "@/lib/model/analytics";
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
              <SectionLabel>Predicción</SectionLabel>
              
              {/* Proyecciones */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PredCell etiqueta="Mañana" iv={r.prediccion.manana} />
                <PredCell etiqueta="1 semana" iv={r.prediccion.semana} />
                <PredCell etiqueta="15 días" iv={r.prediccion.quincena} />
                <PredCell etiqueta="1 mes" iv={r.prediccion.mes} />
              </div>

              {/* Metadata: calidad, TDEE, pesaje */}
              <div className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span>
                    <span className="font-medium text-foreground">Calidad:</span> {r.prediccion.modelo?.calidad === "inicial" ? "Inicial" : r.prediccion.modelo?.calidad === "media" ? "Media" : "Alta"}
                  </span>
                  {r.prediccion.modelo?.tdee && (
                    <span>
                      <span className="font-medium text-foreground">TDEE:</span> ~{r.prediccion.modelo.tdee} kcal/día
                    </span>
                  )}
                  {r.prediccion.pesajes && (
                    <span>
                      <span className="font-medium text-foreground">Datos:</span> {r.prediccion.pesajes} pesajes
                    </span>
                  )}
                </div>

                {/* Alertas sutiles */}
                {r.prediccion.diasSinPesaje != null && r.prediccion.diasSinPesaje > 21 && (
                  <p className="mt-2 text-warning-ink">
                    ⚖️ No pesas desde hace {r.prediccion.diasSinPesaje} días. Próxima medición: {r.prediccion.proximoPesaje ? fmtFechaCorta(r.prediccion.proximoPesaje) : "pronto"}.
                  </p>
                )}
                {r.prediccion.modelo?.kgSemana != null && r.peso.objetivo != null && r.prediccion.modelo.kgSemana > 0 && (
                  <p className="mt-2 text-energy-ink">
                    ⚠️ Tendencia: +{fmtSigno(r.prediccion.modelo.kgSemana, 2)} kg/sem. Revisa tu balance.
                  </p>
                )}

                {/* Contexto */}
                <p className="mt-2">
                  {r.prediccion.modelo?.calidad === "inicial"
                    ? "Registra comidas y más pesajes para mejorar la precisión."
                    : r.prediccion.modelo?.calidad === "media"
                      ? "Con más registros de comidas, el rango será más estrecho."
                      : "Banda al 80% de confianza. Modelo calibrado con tu TDEE observado."}
                </p>
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
        </>
      )}
    </div>
  );
}

function PredCell({ etiqueta, iv }: { etiqueta: string; iv: { peso: number; minimo: number; maximo: number } | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</span>
      <span className="font-display text-lg font-bold tabular text-weight">{iv ? fmtPeso(iv.peso) : "—"}<span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span></span>
      {iv && <span className="text-[0.65rem] text-muted-foreground tabular">{fmtPeso(iv.minimo)}–{fmtPeso(iv.maximo)}</span>}
    </div>
  );
}
