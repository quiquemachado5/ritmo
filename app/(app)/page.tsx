"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Droplets, Flame, Footprints, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { resumen } from "@/lib/model/analytics";
import { macrosObjetivo } from "@/lib/model/metrics";
import { HABITOS } from "@/lib/model/config";
import { hoy } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Ring, MacroBar, Metric, SectionLabel, Chip } from "@/components/app/primitives";
import { fmtPeso, fmtKcal, fmtSigno, fmtFechaCorta, relativo, capitalizar } from "@/lib/format";
import { cn } from "@/lib/utils";

function saludo(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export default function HoyPage() {
  const { estado, cargando, dia, alternarHabito } = useRitmo();
  const { abrir } = useQuickLog();
  const hoyISO = hoy();

  const r = React.useMemo(() => resumen(estado), [estado]);
  const diaHoy = dia(hoyISO);

  if (cargando) return <CargandoHoy />;

  const nombre = estado.perfil.nombre?.split(" ")[0];
  const objetivoKcal = estado.perfil.kcalObjetivo ?? 2000;
  const consumidas = diaHoy.kcalConsumidas ?? 0;
  const restanteKcal = objetivoKcal - consumidas;

  const comidas = diaHoy.comidas ?? [];
  const macros = comidas.reduce(
    (a, c) => ({
      p: a.p + (c.proteinas || 0),
      c: a.c + (c.carbohidratos || 0),
      g: a.g + (c.grasas || 0),
    }),
    { p: 0, c: 0, g: 0 },
  );
  const objMacros = macrosObjetivo({
    kcal: objetivoKcal,
    pesoKg: r.peso.estimadoHoy,
    objetivo: estado.perfil.objetivo,
    proteinaGkg: estado.perfil.proteinaObjetivo,
  });

  const agua = diaHoy.aguaMl ?? 0;
  const aguaObj = estado.perfil.aguaObjetivoMl ?? 2500;
  const pasos = diaHoy.pasos ?? 0;
  const pasosObj = estado.perfil.pasosObjetivo ?? 8000;

  const habitosHechos = HABITOS.filter((h) => diaHoy.habitos?.[h.clave]).length;
  const tendKg = r.prediccion.modelo?.kgSemana ?? r.tendencia?.kgSemana ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Saludo */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{capitalizar(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date()))}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {saludo()}{nombre ? `, ${nombre}` : ""}.
          </h1>
        </div>
        {r.habitos.rachaActual > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-streak/12 px-3 py-1.5">
            <Flame className="size-4 text-streak" />
            <span className="font-display font-bold tabular text-streak">{r.habitos.rachaActual}</span>
            <span className="text-xs font-medium text-streak/90">días</span>
          </div>
        )}
      </header>

      {/* Energía de hoy */}
      <section>
        <SectionLabel action={<Link href="/nutricion" className="text-xs font-medium text-primary hover:underline">Ver nutrición</Link>}>
          Energía de hoy
        </SectionLabel>
        <Card className="p-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
            <Ring value={consumidas} max={objetivoKcal} colorVar="--energy" size={140} stroke={13}>
              <div>
                <span className="block font-display text-3xl font-bold leading-none tabular">
                  {fmtKcal(Math.abs(restanteKcal))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {restanteKcal >= 0 ? "kcal restantes" : "kcal de más"}
                </span>
              </div>
            </Ring>
            <div className="grid w-full flex-1 gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <span className="font-semibold tabular text-foreground">{fmtKcal(consumidas)}</span> de {fmtKcal(objetivoKcal)} kcal
                </span>
              </div>
              <MacroBar label="Proteínas" value={macros.p} max={objMacros.proteinas} colorVar="--weight" />
              <MacroBar label="Carbohidratos" value={macros.c} max={objMacros.carbohidratos} colorVar="--habit" />
              <MacroBar label="Grasas" value={macros.g} max={objMacros.grasas} colorVar="--energy" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <MiniStat
              icon={<Droplets className="size-4 text-water" />}
              label="Agua"
              value={`${(agua / 1000).toFixed(1)} / ${(aguaObj / 1000).toFixed(1)} L`}
              pct={Math.min(100, (agua / aguaObj) * 100)}
              colorVar="--water"
              onClick={() => abrir("agua")}
            />
            <MiniStat
              icon={<Footprints className="size-4 text-habit" />}
              label="Pasos"
              value={`${fmtKcal(pasos)} / ${fmtKcal(pasosObj)}`}
              pct={Math.min(100, (pasos / pasosObj) * 100)}
              colorVar="--habit"
              onClick={() => abrir("ejercicio")}
            />
          </div>
        </Card>
      </section>

      {/* Peso y predicción */}
      <section>
        <SectionLabel action={<Link href="/progreso" className="text-xs font-medium text-primary hover:underline">Ver progreso</Link>}>
          Peso y predicción
        </SectionLabel>
        <Card className="p-5">
          {r.peso.estimadoHoy != null ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <Metric
                    label="Peso estimado hoy"
                    value={fmtPeso(r.peso.estimadoHoy)}
                    unit="kg"
                    tone="weight"
                  />
                  {r.prediccion.partida != null && (
                    <p className="mt-1 text-xs text-muted-foreground tabular">
                      rango {fmtPeso(r.prediccion.manana?.minimo ?? r.peso.estimadoHoy)}–{fmtPeso(r.prediccion.manana?.maximo ?? r.peso.estimadoHoy)} kg
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {tendKg != null && (
                    <div className={cn("inline-flex items-center gap-1 font-semibold tabular", tendKg <= 0 ? "text-weight" : "text-energy")}>
                      {tendKg <= 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                      {fmtSigno(tendKg, 2)} kg/sem
                    </div>
                  )}
                  {r.prediccion.modelo && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      confianza {r.prediccion.modelo.calidad}
                    </p>
                  )}
                </div>
              </div>

              {/* Franja báscula → hoy → revisión */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-secondary/50 p-3 text-center">
                <RevItem etiqueta="Último pesaje" valor={fmtPeso(r.peso.actual)} sub={r.peso.fecha ? relativo(r.peso.fecha, hoyISO) : "—"} />
                <RevItem etiqueta="Hoy (est.)" valor={fmtPeso(r.peso.estimadoHoy)} sub="estimado" destacado />
                <RevItem
                  etiqueta="Próx. revisión"
                  valor={r.prediccion.proximoPesaje ? fmtFechaCorta(r.prediccion.proximoPesaje) : "—"}
                  sub="pésate"
                />
              </div>

              {r.peso.restante != null && estado.perfil.pesoObjetivo != null && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">
                    {Math.abs(r.peso.restante) < 0.1
                      ? "¡Estás en tu objetivo!"
                      : `${fmtPeso(Math.abs(r.peso.restante))} kg ${r.peso.restante > 0 ? "hasta" : "por debajo de"} tu objetivo`}
                  </span>
                  <Chip tone="weight">meta {fmtPeso(estado.perfil.pesoObjetivo)} kg</Chip>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">Aún no hay pesajes. Registra tu peso para activar la predicción.</p>
              <Button onClick={() => abrir("peso")} variant="secondary" className="gap-2">
                <Plus className="size-4" /> Registrar peso
              </Button>
            </div>
          )}
        </Card>
      </section>

      {/* Hábitos de hoy */}
      <section>
        <SectionLabel action={<Link href="/habitos" className="text-xs font-medium text-primary hover:underline">Ver hábitos</Link>}>
          Hábitos de hoy · {habitosHechos}/{HABITOS.length}
        </SectionLabel>
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {HABITOS.map((h) => {
              const hecho = diaHoy.habitos?.[h.clave] === true;
              return (
                <button
                  key={h.clave}
                  onClick={() => alternarHabito(hoyISO, h.clave)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    hecho ? "border-primary/40 bg-primary/8 text-foreground" : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2",
                      hecho ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {hecho && <span className="text-[0.6rem]">✓</span>}
                  </span>
                  <span className="truncate">{h.etiqueta}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Comidas de hoy */}
      <section>
        <SectionLabel action={<button onClick={() => abrir("comida")} className="text-xs font-medium text-primary hover:underline">Añadir</button>}>
          Comidas de hoy
        </SectionLabel>
        <Card className="divide-y divide-border p-0">
          {comidas.length === 0 ? (
            <button onClick={() => abrir("comida")} className="flex w-full items-center justify-center gap-2 py-6 text-sm text-muted-foreground hover:text-foreground">
              <Plus className="size-4" /> Registra tu primera comida del día
            </button>
          ) : (
            comidas.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.texto}</p>
                  <p className="text-xs capitalize text-muted-foreground">{c.tipo}</p>
                </div>
                <span className="shrink-0 font-display font-bold tabular text-energy">{fmtKcal(c.kcal)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">kcal</span></span>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  pct,
  colorVar,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct: number;
  colorVar: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col gap-1.5 rounded-xl bg-secondary/50 p-3 text-left transition-colors hover:bg-secondary">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <span className="text-sm font-semibold tabular">{value}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: `var(${colorVar})` }} />
      </div>
    </button>
  );
}

function RevItem({ etiqueta, valor, sub, destacado }: { etiqueta: string; valor: string; sub: string; destacado?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</span>
      <span className={cn("font-display font-bold tabular", destacado ? "text-lg text-weight" : "text-base")}>{valor}</span>
      <span className="text-[0.65rem] text-muted-foreground">{sub}</span>
    </div>
  );
}

function CargandoHoy() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
