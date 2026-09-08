"use client";

import * as React from "react";
import { GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EscenarioRitmo } from "@/lib/model/insights";

export function Counterfactual({ escenarios, actual }: { escenarios: EscenarioRitmo[]; actual: number }) {
  const limite = Math.max(0, escenarios.length - 1);
  const [cumplidos, setCumplidos] = React.useState(Math.min(actual, limite));
  const escenario = escenarios[cumplidos];
  if (!escenario) return null;
  const pct = limite ? cumplidos / limite : 0;
  const tono = pct >= .83 ? "text-weight" : pct >= .5 ? "text-habit" : pct > 0 ? "text-warning" : "text-energy";
  return (
    <section aria-labelledby="escenarios-titulo">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-body-wash text-body-ink"><GitCompareArrows className="size-4" /></span>
        <div><h2 id="escenarios-titulo" className="font-display text-xl font-bold">¿Qué pasa si mantengo este ritmo?</h2><p className="mt-1 text-sm text-muted-foreground">Mueve los hábitos; el modelo conserva tu perfil y recalcula tres horizontes.</p></div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-body-border bg-card shadow-sm">
        <div className="counterfactual-surface p-4 sm:p-6">
          <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold text-muted-foreground">Ritmo simulado</p><p className={cn("mt-1 font-display text-3xl font-bold tabular", tono)}>{cumplidos}/{escenario.total} <span className="text-sm font-medium text-muted-foreground">hábitos</span></p></div><p className={cn("text-sm font-semibold tabular", escenario.balanceDiario <= 0 ? "text-weight" : "text-energy")}>{escenario.balanceDiario > 0 ? "+" : ""}{escenario.balanceDiario} kcal/día</p></div>
          <input aria-label="Hábitos cumplidos en el escenario" type="range" min={0} max={limite} step={1} value={cumplidos} onChange={(event) => setCumplidos(Number(event.target.value))} className="scenario-range mt-5 w-full" />
          <div className="mt-2 flex justify-between text-[0.65rem] text-muted-foreground"><span>0/{escenario.total}</span><span>{escenario.total}/{escenario.total}</span></div>
        </div>
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[["7 días", escenario.peso7], ["4 semanas", escenario.peso28], ["3 meses", escenario.peso90]].map(([etiqueta, peso]) => <div key={String(etiqueta)} className="px-4 py-4 sm:px-5"><p className="text-xs text-muted-foreground">{etiqueta}</p><p className="mt-1 font-display text-2xl font-bold tabular">{Number(peso).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span className="ml-1 text-xs font-medium text-muted-foreground">kg</span></p></div>)}
        </div>
        <p className="border-t border-border px-4 py-3 text-[0.66rem] leading-relaxed text-muted-foreground sm:px-6">Escenario orientativo, no promesa: supone que repites ese nivel cada día. La báscula real siempre vuelve a anclar el modelo.</p>
      </div>
    </section>
  );
}
