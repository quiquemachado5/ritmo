"use client";

import * as React from "react";
import { Gauge, Minus, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { detectarMeseta, pesajes as getPesajes, resumen, serieBalance, seriePesoDiaria } from "@/lib/model/analytics";
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
  const meseta = React.useMemo(() => detectarMeseta(estado), [estado]);

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
          {/* Evolución de peso */}
          <Card className="overflow-hidden p-0">
            {/* Cabecera: peso real + tendencia */}
            <div className="flex items-center justify-between p-5 pb-0">
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Último pesaje real</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular">{fmtPeso(r.peso.actual)}</span>
                  <span className="text-sm text-muted-foreground">kg</span>
                  {r.peso.fecha && <span className="text-xs text-muted-foreground">· {fmtFechaCorta(r.peso.fecha)}</span>}
                </div>
              </div>
              <div className="text-right">
                {tendKg != null && (
                  <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular",
                    tendKg <= 0 ? "bg-weight/10 text-weight" : "bg-energy/10 text-energy"
                  )}>
                    {tendKg <= 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                    {fmtSigno(tendKg, 2)} kg/sem
                  </div>
                )}
                {r.peso.restante != null && (
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    objetivo {fmtPeso(r.peso.objetivo)} kg · faltan {fmtPeso(Math.abs(r.peso.restante))}
                  </p>
                )}
              </div>
            </div>

            {/* Gráfica */}
            <div className="p-5">
              <div className="mb-3 flex items-center justify-end">
                <div className="flex gap-1 rounded-full bg-secondary p-0.5">
                  {RANGOS.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => setRango(x.id)}
                      className={cn(
                        "h-8 rounded-full px-2.5 text-[0.65rem] font-medium transition-colors",
                        rango === x.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {x.id}
                    </button>
                  ))}
                </div>
              </div>
              <WeightChart data={datosPeso} objetivo={estado.perfil.pesoObjetivo} />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.65rem] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-weight" /> Báscula</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded border-b-2 border-dashed border-weight" /> Estimado</span>
                {estado.perfil.pesoObjetivo && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded border-b-2 border-dotted border-weight" /> Objetivo</span>}
              </div>
            </div>

            {/* Predicción */}
            {r.prediccion.disponible && (
              <div className="border-t border-border bg-secondary/20 p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Predicción del modelo</p>
                  <Chip tone={CALIDAD_TONE[r.prediccion.modelo?.calidad ?? "inicial"]}>
                    {CALIDAD_LABEL[r.prediccion.modelo?.calidad ?? "inicial"]}
                  </Chip>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <PredCell etiqueta="Mañana" iv={r.prediccion.manana} base={r.peso.estimadoHoy} />
                  <PredCell etiqueta="1 sem" iv={r.prediccion.semana} base={r.peso.estimadoHoy} />
                  <PredCell etiqueta="15 días" iv={r.prediccion.quincena} base={r.peso.estimadoHoy} />
                  <PredCell etiqueta="1 mes" iv={r.prediccion.mes} base={r.peso.estimadoHoy} />
                </div>

                <div className="mt-4 flex flex-col gap-2 text-[0.7rem]">
                  <div className="flex items-start gap-2.5">
                    <Gauge className={cn("size-3.5 mt-0.5 shrink-0", CALIDAD_ICON[r.prediccion.modelo?.calidad ?? "inicial"])} />
                    <span className="text-muted-foreground">
                      {r.prediccion.modelo?.calidad === "alta"
                        ? <>TDEE observado{r.prediccion.modelo?.tdee ? <> ~<span className="tabular font-medium text-foreground">{r.prediccion.modelo.tdee}</span> kcal/día</> : null}. Rango al 80%.</>
                        : r.prediccion.modelo?.calidad === "media"
                          ? "Basada en tu balance calórico. Registra más comidas para afinar."
                          : <><span className="tabular font-medium text-foreground">{r.prediccion.pesajes}</span> pesajes. Registra comidas para afinar.</>}
                    </span>
                  </div>

                  {r.prediccion.diasSinPesaje != null && r.prediccion.diasSinPesaje > 0 && (
                    <div className="flex items-start gap-2.5">
                      <Scale className={cn("size-3.5 mt-0.5 shrink-0", r.prediccion.diasSinPesaje > 21 ? "text-warning" : "text-muted-foreground")} />
                      <span className="text-muted-foreground">
                        <span className="tabular font-medium text-foreground">{r.prediccion.diasSinPesaje}</span> días sin pesarte.
                        {r.prediccion.proximoPesaje && <> Pésate hacia <span className="font-medium text-foreground">{fmtFechaCorta(r.prediccion.proximoPesaje)}</span>.</>}
                      </span>
                    </div>
                  )}

                  {meseta.enMeseta && (
                    <div className="flex items-start gap-2.5">
                      <Minus className="size-3.5 mt-0.5 shrink-0 text-warning" />
                      <span className="text-muted-foreground">
                        Estancado <span className="tabular font-medium text-foreground">{meseta.dias}</span> días.{" "}
                        {meseta.sugerencia === "bajar-kcal" ? "Ajusta 100–150 kcal menos." : meseta.sugerencia === "subir-kcal" ? "Sube 100–150 kcal." : "Revisa registro de comidas."}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

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


function PredCell({ etiqueta, iv, base }: { etiqueta: string; iv: { peso: number; minimo: number; maximo: number } | null; base?: number | null }) {
  const delta = iv && base ? iv.peso - base : null;
  const baja = delta != null && delta <= 0;

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/50 px-3 py-3 text-center">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{etiqueta}</span>
      <span className={cn("font-display text-2xl font-bold leading-none tabular", baja ? "text-weight" : "text-energy")}>
        {iv ? fmtPeso(iv.peso) : "—"}
      </span>
      <span className="text-[0.6rem] font-medium text-muted-foreground">kg</span>
      {iv && (
        <>
          {delta != null && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold tabular",
              baja ? "bg-weight/10 text-weight" : "bg-energy/10 text-energy"
            )}>
              {baja ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
              {fmtSigno(delta, 1)}
            </span>
          )}
          <span className="text-[0.6rem] text-muted-foreground/70 tabular">
            {fmtPeso(iv.minimo)}–{fmtPeso(iv.maximo)}
          </span>
        </>
      )}
    </div>
  );
}
