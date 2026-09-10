"use client";

import * as React from "react";
import { CheckCircle2, Scale, Sparkles, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtFechaCorta, fmtPeso, fmtSigno } from "@/lib/format";
import { hoy, rango, sumarDias } from "@/lib/model/dates";
import { resumenPorMes, seriePesoDiaria } from "@/lib/model/analytics";
import { habitosModelo } from "@/lib/model/config";
import { perfilEnFecha } from "@/lib/model/profile-history";
import type { Estado } from "@/lib/model/types";

type Vista = "cronologia" | "comparar";

export function ProgressStudio({ estado }: { estado: Estado }) {
  const [vista, setVista] = React.useState<Vista>("cronologia");
  const fechaHoy = hoy();
  const dias = React.useMemo(() => {
    const desde = sumarDias(fechaHoy, -13);
    const pesos = new Map(seriePesoDiaria(estado, desde, fechaHoy).map(p => [p.fecha, p]));
    return rango(desde, fechaHoy).reverse().map(fecha => {
      const dia = estado.dias[fecha];
      const activos = habitosModelo(perfilEnFecha(estado, fecha));
      const hechos = activos.filter(h => dia?.habitos?.[h.clave]).length;
      return { fecha, dia, hechos, total: activos.length, peso: pesos.get(fecha) };
    });
  }, [estado, fechaHoy]);
  const meses = React.useMemo(() => resumenPorMes(estado), [estado]);
  const [mesA, setMesA] = React.useState(meses[0]?.clave ?? "");
  const [mesB, setMesB] = React.useState(meses[1]?.clave ?? meses[0]?.clave ?? "");
  const a = meses.find(m => m.clave === mesA) ?? meses[0];
  const b = meses.find(m => m.clave === mesB) ?? meses[1] ?? meses[0];

  if (!dias.some(d => d.peso) && meses.length === 0) return null;
  return <section aria-labelledby="historia-corporal">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="historia-corporal" className="font-display text-xl font-bold">Historia corporal</h2><p className="mt-1 text-sm text-muted-foreground">Peso, hábitos y contexto en la misma línea temporal.</p></div>
      <div className="inline-flex rounded-xl bg-secondary p-1" role="tablist" aria-label="Vista de historia corporal">
        {(["cronologia", "comparar"] as const).map(opcion => <button key={opcion} type="button" role="tab" aria-selected={vista === opcion} onClick={() => setVista(opcion)} className={cn("min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors", vista === opcion ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{opcion === "cronologia" ? "14 días" : "Comparar meses"}</button>)}
      </div>
    </div>
    <Card className="overflow-hidden p-0">
      {vista === "cronologia" ? <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto p-3 [scrollbar-width:none] sm:grid sm:grid-cols-7 sm:overflow-visible sm:p-4">
        {dias.map(({ fecha, dia, hechos, total, peso }) => {
          const ratio = total ? hechos / total : 0;
          const tone = ratio >= 1 ? "border-primary/30 bg-primary/8" : ratio >= .5 ? "border-warning-border bg-warning-wash/45" : "border-destructive/15 bg-destructive/4";
          return <article key={fecha} className={cn("w-[8.5rem] shrink-0 snap-start rounded-xl border p-3 sm:w-auto", tone)}>
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{fecha === fechaHoy ? "Hoy" : fmtFechaCorta(fecha)}</p>{dia?.notas && <span className="size-1.5 rounded-full bg-body" title="Con contexto" />}</div>
            <p className="mt-3 font-display text-xl font-bold tabular">{peso ? fmtPeso(peso.real ?? peso.estimado) : "—"}<span className="ml-0.5 text-[0.65rem] font-medium text-muted-foreground">kg</span></p>
            <p className="mt-0.5 text-[0.65rem] font-medium text-muted-foreground">{peso?.real != null ? "Báscula" : peso ? "Modelo" : "Sin base"}</p>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[0.68rem]"><span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3 text-primary" />{hechos}/{total}</span><span className="inline-flex items-center gap-1"><UtensilsCrossed className="size-3 text-energy" />{dia?.comidas?.length ?? 0}</span></div>
          </article>;
        })}
      </div> : meses.length > 0 && a && b ? <div>
        <div className="grid gap-2 border-b border-border bg-secondary/25 p-3 sm:grid-cols-2 sm:p-4">
          <MonthSelect label="Primer período" value={a.clave} onChange={setMesA} months={meses} />
          <MonthSelect label="Comparar con" value={b.clave} onChange={setMesB} months={meses} />
        </div>
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <CompareMetric icon={CheckCircle2} label="Constancia" a={`${a.adherenciaMedia}%`} b={`${b.adherenciaMedia}%`} delta={`${fmtSigno(a.adherenciaMedia - b.adherenciaMedia, 0)} pts`} />
          <CompareMetric icon={UtensilsCrossed} label="Comidas registradas" a={String(a.comidasRegistradas)} b={String(b.comidasRegistradas)} delta={`${fmtSigno(a.comidasRegistradas - b.comidasRegistradas, 0)}`} />
          <CompareMetric icon={Scale} label="Cambio medido" a={a.cambioPeso == null ? "—" : `${fmtSigno(a.cambioPeso, 1)} kg`} b={b.cambioPeso == null ? "—" : `${fmtSigno(b.cambioPeso, 1)} kg`} delta="Báscula" />
        </div>
      </div> : <div className="p-5 text-sm text-muted-foreground"><Sparkles className="mb-2 size-5 text-body" />Registra datos en dos meses para desbloquear la comparación.</div>}
    </Card>
  </section>;
}

function MonthSelect({ label, value, onChange, months }: { label: string; value: string; onChange: (value: string) => void; months: ReturnType<typeof resumenPorMes> }) {
  return <label className="text-xs font-semibold text-muted-foreground">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{months.map(month => <option key={month.clave} value={month.clave}>{month.etiqueta}</option>)}</select></label>;
}

function CompareMetric({ icon: Icon, label, a, b, delta }: { icon: typeof Scale; label: string; a: string; b: string; delta: string }) {
  return <div className="px-4 py-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="size-3.5 text-primary" />{label}<span className="ml-auto rounded-md bg-secondary px-1.5 py-0.5 text-[0.62rem]">{delta}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><p className="font-display text-xl font-bold tabular">{a}</p><p className="border-l border-border pl-3 font-display text-xl font-bold tabular text-muted-foreground">{b}</p></div></div>;
}
