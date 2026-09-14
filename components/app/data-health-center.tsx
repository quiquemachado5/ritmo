"use client";

import * as React from "react";
import { CheckCircle2, DatabaseZap, ShieldCheck, TriangleAlert, Wrench } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { analizarSaludDatos } from "@/lib/data-health";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtFechaCorta } from "@/lib/format";

export function DataHealthCenter() {
  const { estado, repararDatos, sincronizando } = useRitmo();
  const [reparando, setReparando] = React.useState(false);
  const report = React.useMemo(() => analizarSaludDatos(estado), [estado]);
  const limpio = report.issues.length === 0;

  async function reparar() {
    setReparando(true);
    try { await repararDatos(); } finally { setReparando(false); }
  }

  return <div className="overflow-hidden rounded-xl border border-border/80" aria-labelledby="salud-datos-titulo">
    <div className="flex flex-col gap-3 bg-secondary/25 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", limpio ? "bg-weight-wash text-weight-ink" : "bg-warning-wash text-warning-ink")}>
          {limpio ? <CheckCircle2 className="size-4" /> : <DatabaseZap className="size-4" />}
        </span>
        <div className="min-w-0"><p id="salud-datos-titulo" className="text-sm font-semibold">{limpio ? "Historial coherente" : "Salud de tus datos"}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{limpio ? "Fechas, comidas, totales y mediciones encajan entre sí." : `${report.repairable} ${report.repairable === 1 ? "ajuste seguro" : "ajustes seguros"} · ${report.review} ${report.review === 1 ? "decisión tuya" : "decisiones tuyas"}`}</p></div>
      </div>
      {report.repairable > 0 && <Button type="button" variant="secondary" className="min-h-10 w-full rounded-xl sm:w-auto" disabled={reparando || sincronizando} onClick={() => void reparar()}><Wrench className="size-4" />{reparando ? "Reparando…" : `Reparar ${report.repairable}`}</Button>}
    </div>
    {!limpio && <ul className="divide-y divide-border/70 border-t border-border/70">
      {report.issues.slice(0, 5).map((issue, index) => <li key={`${issue.kind}-${issue.fecha}-${index}`} className="flex items-start gap-2.5 px-3.5 py-2.5 text-xs">
        {issue.repairable ? <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />}
        <span className="min-w-0 flex-1 leading-relaxed"><span className="font-semibold text-foreground">{fmtFechaCorta(issue.fecha)}</span><span className="text-muted-foreground"> · {issue.message}</span></span>
        <span className="shrink-0 text-[0.65rem] font-semibold text-muted-foreground">{issue.repairable ? "Automático" : "Revisar"}</span>
      </li>)}
      {report.issues.length > 5 && <li className="px-3.5 py-2 text-xs text-muted-foreground">Y {report.issues.length - 5} incidencias más. Repara las automáticas para aislar lo que necesita tu decisión.</li>}
    </ul>}
  </div>;
}
