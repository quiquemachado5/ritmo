"use client";

import Link from "next/link";
import { ArrowLeft, Check, Scale, UtensilsCrossed } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { habitosModelo } from "@/lib/model/config";
import { hoy } from "@/lib/model/dates";
import { capitalizar, fmtFechaLarga, fmtKcal, fmtPeso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ModoMinimoPage() {
  const { estado, cargando, dia, alternarHabito } = useRitmo();
  const { abrir } = useQuickLog();
  const fecha = hoy();

  if (cargando) return <ModoMinimoCargando />;

  const registro = dia(fecha);
  const habitos = habitosModelo(estado.perfil);
  const completados = habitos.filter((habito) => registro.habitos?.[habito.clave]).length;
  const completo = completados === habitos.length;
  const comidas = registro.comidas ?? [];
  const kcal = comidas.reduce((total, comida) => total + comida.kcal, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Modo mínimo</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{capitalizar(fmtFechaLarga(fecha))} · solo lo esencial</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="shrink-0 rounded-xl">
          <Link href="/"><ArrowLeft className="size-4" /> Hoy</Link>
        </Button>
      </header>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary/35 px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-sm font-semibold">Hábitos</p>
            <p className="text-xs text-muted-foreground">Toca únicamente lo que hayas cumplido</p>
          </div>
          <p className={cn("font-display text-xl font-bold tabular", completo ? "text-weight" : "text-foreground")} aria-live="polite">
            {completados}<span className="text-sm font-medium text-muted-foreground">/{habitos.length}</span>
          </p>
        </div>

        <div className="h-1 bg-secondary" aria-hidden="true">
          <div className="h-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${(completados / Math.max(1, habitos.length)) * 100}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:p-4">
          {habitos.map((habito) => {
            const hecho = registro.habitos?.[habito.clave] === true;
            return (
              <button
                key={habito.clave}
                type="button"
                onClick={() => void alternarHabito(fecha, habito.clave)}
                aria-pressed={hecho}
                className={cn(
                  "flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hecho ? "border-primary/40 bg-primary/8 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2", hecho ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {hecho && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 truncate">{habito.etiqueta}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => abrir("comida", fecha)}
          className="flex min-h-20 min-w-0 items-center gap-3 rounded-xl border border-energy-border bg-energy-wash px-3.5 text-left transition-colors hover:bg-energy-wash/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-energy shadow-sm"><UtensilsCrossed className="size-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-energy-ink">Comida</span>
            <span className="block truncate text-xs tabular text-muted-foreground">{comidas.length ? `${comidas.length} · ${fmtKcal(kcal)} kcal` : "Registrar"}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => abrir("peso", fecha)}
          className="flex min-h-20 min-w-0 items-center gap-3 rounded-xl border border-weight-border bg-weight-wash px-3.5 text-left transition-colors hover:bg-weight-wash/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-weight shadow-sm"><Scale className="size-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-weight-ink">Peso</span>
            <span className="block truncate text-xs tabular text-muted-foreground">{registro.peso != null ? `${fmtPeso(registro.peso)} kg` : "Registrar"}</span>
          </span>
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {completo ? "Día completo. No necesitas hacer nada más." : "Todo lo que marques aquí se guarda en tu historial habitual."}
      </p>
    </div>
  );
}

function ModoMinimoCargando() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4" aria-label="Cargando modo mínimo">
      <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-56" /></div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2.5"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
    </div>
  );
}
