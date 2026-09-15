"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { habitosModelo } from "@/lib/model/config";
import { capitalizar, fmtFechaLarga, fmtPeso } from "@/lib/format";
import { hoy } from "@/lib/model/dates";
import { useActiveDay } from "./active-day-provider";

export function ActiveDayContext() {
  const { estado, dia } = useRitmo();
  const { fecha } = useActiveDay();
  const registro = dia(fecha);
  const habitos = habitosModelo(estado.perfil);
  const cumplidos = habitos.filter((habito) => registro.habitos?.[habito.clave]).length;
  const comidas = registro.comidas?.length ?? 0;
  const peso = registro.peso ?? estado.composicion.find((item) => item.fecha === fecha)?.peso;

  return (
    <aside className="flex flex-col gap-2 rounded-xl border border-border/75 bg-secondary/30 px-3 py-2.5 sm:flex-row sm:items-center" aria-label="Día activo compartido">
      <div className="flex min-w-0 items-center gap-2.5 sm:mr-auto">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-primary ring-1 ring-border/70"><CalendarDays className="size-4" /></span>
        <div className="min-w-0"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Día en contexto</p><p className="truncate text-sm font-semibold">{fecha === hoy() ? "Hoy" : capitalizar(fmtFechaLarga(fecha))}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center text-xs sm:flex sm:min-w-[17rem]">
        <span className="bg-card px-2 py-1.5"><strong className="tabular">{cumplidos}/{habitos.length}</strong><span className="ml-1 text-muted-foreground">hábitos</span></span>
        <span className="bg-card px-2 py-1.5"><strong className="tabular">{comidas}</strong><span className="ml-1 text-muted-foreground">comidas</span></span>
        <span className="bg-card px-2 py-1.5"><strong className="tabular">{peso == null ? "—" : fmtPeso(peso)}</strong><span className="ml-1 text-muted-foreground">kg</span></span>
      </div>
      <Link href={`/calendario?fecha=${fecha}`} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/8">Abrir día <ChevronRight className="size-3.5" /></Link>
    </aside>
  );
}
