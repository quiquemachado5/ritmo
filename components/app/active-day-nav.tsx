"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capitalizar, fmtFechaLarga } from "@/lib/format";
import { hoy, sumarDias } from "@/lib/model/dates";
import { cn } from "@/lib/utils";
import { useActiveDay } from "./active-day-provider";

export function ActiveDayNav({ className }: { className?: string }) {
  const { fecha, seleccionarFecha, volverAHoy } = useActiveDay();
  const esHoy = fecha === hoy();

  return (
    <div className={cn("flex w-full items-center justify-between rounded-xl border border-border bg-card p-1 shadow-sm sm:w-auto sm:min-w-48", className)}>
      <Button variant="ghost" size="icon" onClick={() => seleccionarFecha(sumarDias(fecha, -1))} aria-label="Día anterior">
        <ChevronLeft className="size-5" />
      </Button>
      <button type="button" onClick={volverAHoy} className="min-w-0 flex-1 px-2 text-center text-sm font-medium sm:min-w-28 sm:flex-none">
        {esHoy ? "Hoy" : capitalizar(fmtFechaLarga(fecha))}
      </button>
      <Button variant="ghost" size="icon" onClick={() => seleccionarFecha(sumarDias(fecha, 1))} disabled={esHoy} aria-label="Día siguiente">
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
