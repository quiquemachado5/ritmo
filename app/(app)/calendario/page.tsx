"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { energiaDe } from "@/lib/model/analytics";
import { nivelDia } from "@/lib/model/metrics";
import { TOTAL_HABITOS, HABITOS } from "@/lib/model/config";
import { claveMes, DIAS_SEMANA, diaSemanaLunes, hoy, limitesMes, sumarDias, sumarMeses } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionLabel, Chip } from "@/components/app/primitives";
import { fmtPeso, fmtKcal, fmtFechaLarga, fmtMes, capitalizar, fmtSigno, fmtFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";

const NIVEL = ["bg-transparent", "bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary"];

export default function CalendarioPage() {
  const { estado, dia } = useRitmo();
  const { abrir } = useQuickLog();
  const hoyISO = hoy();
  const [mes, setMes] = React.useState(claveMes(hoyISO));
  const [sel, setSel] = React.useState(hoyISO);

  const { desde, dias } = limitesMes(mes);
  const offset = diaSemanaLunes(desde);
  const celdas: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: dias }, (_, i) => sumarDias(desde, i)),
  ];

  const d = dia(sel);
  const energiaSel = energiaDe(estado, sel);
  const habHechos = HABITOS.filter((h) => d.habitos?.[h.clave]).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Calendario</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setMes((m) => sumarMeses(m, -1))} aria-label="Mes anterior">
            <ChevronLeft className="size-5" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{capitalizar(fmtMes(`${mes}-01`))}</span>
          <Button variant="ghost" size="icon" onClick={() => setMes((m) => sumarMeses(m, 1))} aria-label="Mes siguiente">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>

      <Card className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {DIAS_SEMANA.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((fecha, i) => {
            if (!fecha) return <span key={i} />;
            const dd = dia(fecha);
            const nivel = nivelDia(dd.habitos, TOTAL_HABITOS);
            const futuro = fecha > hoyISO;
            const e = energiaDe(estado, fecha);
            const esHoy = fecha === hoyISO;
            const activo = fecha === sel;
            const cumplidos = HABITOS.filter((h) => dd.habitos?.[h.clave]).length;
            const hechos = HABITOS.filter((h) => dd.habitos?.[h.clave]).map((h) => h.etiqueta);
            const resumenDia = futuro
              ? undefined
              : [
                  `${fmtFechaCorta(fecha)} · ${cumplidos}/${TOTAL_HABITOS} hábitos`,
                  hechos.length ? hechos.join(", ") : "sin hábitos marcados",
                  dd.peso != null ? `Peso: ${dd.peso} kg` : null,
                  e.imputado ? "Día sin registro (imputado)" : null,
                ]
                  .filter(Boolean)
                  .join("\n");
            return (
              <button
                key={fecha}
                onClick={() => setSel(fecha)}
                disabled={futuro}
                title={resumenDia}
                aria-label={resumenDia}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-all",
                  futuro ? "text-muted-foreground/30" : "hover:ring-2 hover:ring-primary/30",
                  nivel > 0 ? NIVEL[nivel] : "bg-secondary/50",
                  nivel >= 3 ? "text-primary-foreground" : "text-foreground",
                  activo && "ring-2 ring-primary",
                  esHoy && "font-bold",
                )}
              >
                <span className="tabular">{Number(fecha.slice(-2))}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {dd.peso != null && <span className="size-1.5 rounded-full bg-weight" />}
                  {e.imputado && <span className="size-1.5 rounded-full bg-warning" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-weight" /> pesaje</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-warning" /> imputado</span>
        </div>
      </Card>

      {/* Resumen del día seleccionado */}
      <section>
        <SectionLabel action={<Button size="sm" variant="secondary" className="h-7 gap-1.5" onClick={() => abrir(undefined, sel)}><Plus className="size-3.5" /> Registrar</Button>}>
          {sel === hoyISO ? "Hoy" : capitalizar(fmtFechaLarga(sel))}
        </SectionLabel>
        <Card className="flex flex-col gap-3 p-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Hábitos</p>
              <p className="font-display text-xl font-bold tabular">{habHechos}<span className="text-sm font-normal text-muted-foreground">/{TOTAL_HABITOS}</span></p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Peso</p>
              <p className="font-display text-xl font-bold tabular text-weight">{d.peso != null ? fmtPeso(d.peso) : "—"}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Balance</p>
              <p className={cn("font-display text-xl font-bold tabular", energiaSel.balance > 0 ? "text-energy" : "text-weight")}>
                {energiaSel.sinRegistro && !energiaSel.imputado ? "—" : fmtSigno(energiaSel.balance, 0)}
              </p>
            </div>
          </div>
          {d.comidas && d.comidas.length > 0 && (
            <div className="border-t border-border pt-3 text-sm text-muted-foreground">
              {d.comidas.length} comida{d.comidas.length > 1 ? "s" : ""} · {fmtKcal(d.kcalConsumidas ?? 0)} kcal
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {HABITOS.filter((h) => d.habitos?.[h.clave]).map((h) => (
              <Chip key={h.clave} tone="habit">{h.etiqueta}</Chip>
            ))}
            {energiaSel.imputado && <Chip tone="warning">día imputado</Chip>}
          </div>
        </Card>
      </section>
    </div>
  );
}
