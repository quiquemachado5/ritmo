"use client";

import * as React from "react";
import { Activity, BrainCircuit, CalendarClock, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { mapaAsociacionesHabitos, memoriaEventosContexto } from "@/lib/model/personal-patterns";
import type { Estado } from "@/lib/model/types";

export function PersonalPatterns({ estado }: { estado: Estado }) {
  const asociaciones = React.useMemo(() => mapaAsociacionesHabitos(estado), [estado]);
  const eventos = React.useMemo(() => memoriaEventosContexto(estado), [estado]);
  if (asociaciones.length === 0 && eventos.length === 0) return null;

  const limite = Math.max(0.1, ...asociaciones.map((item) => Math.abs(item.efectoKg)));
  return (
    <section aria-labelledby="patrones-personales">
      <div className="mb-3">
        <h2 id="patrones-personales" className="font-display text-xl font-bold">Tu patrón personal</h2>
        <p className="mt-1 text-sm text-muted-foreground">Asociaciones aprendidas de tus pesajes consecutivos. Orientan; no demuestran causa.</p>
      </div>
      <Card className="overflow-hidden p-0">
        {asociaciones.length > 0 && (
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2"><BrainCircuit className="size-4 text-primary" /><h3 className="text-sm font-semibold">Hábitos que más coinciden con la báscula</h3></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {asociaciones.map((item) => {
                const favorable = item.efectoKg <= 0;
                return <div key={item.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-2.5">
                  <div className="min-w-0"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{item.etiqueta}</p><span className={cn("text-xs font-bold tabular", favorable ? "text-weight" : "text-energy")}>{item.efectoKg > 0 ? "+" : ""}{item.efectoKg.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><span className={cn("block h-full rounded-full", favorable ? "bg-weight" : "bg-energy")} style={{ width: `${Math.max(12, Math.abs(item.efectoKg) / limite * 100)}%` }} /></div><p className="mt-1.5 text-[0.65rem] text-muted-foreground">{item.cumplidos + item.noCumplidos} pares comparables · confianza {item.confianza}</p></div>
                  <Activity className={cn("size-4", favorable ? "text-weight" : "text-energy")} />
                </div>;
              })}
            </div>
          </div>
        )}
        {eventos.length > 0 && (
          <div className="border-t border-border bg-body-wash/20 p-4 sm:p-5">
            <div className="flex items-center gap-2"><CalendarClock className="size-4 text-body" /><h3 className="text-sm font-semibold">Memoria de eventos</h3></div>
            <div className="mt-3 flex snap-x gap-2 overflow-x-auto [scrollbar-width:none] sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {eventos.map((evento) => <article key={evento.id} className="min-w-[10.5rem] snap-start rounded-xl border border-body-border bg-card px-3 py-3">
                <div className="flex items-start justify-between gap-2"><Scale className="size-4 text-body" /><Chip tone={evento.personalizada ? "body" : "muted"}>{evento.personalizada ? evento.confianza : "aprendiendo"}</Chip></div>
                <p className="mt-3 text-sm font-semibold">{evento.etiqueta}</p>
                <p className={cn("mt-0.5 font-display text-xl font-bold tabular", evento.efectoKg > 0 ? "text-body" : "text-weight")}>{evento.efectoKg > 0 ? "+" : ""}{evento.efectoKg.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg</p>
                <p className="mt-1 text-[0.65rem] leading-relaxed text-muted-foreground">al día siguiente · {evento.muestras} casos propios</p>
              </article>)}
            </div>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">RITMO usa estas señales solo como oscilación temporal de líquidos. Nunca las convierte en grasa ni modifica tu balance calórico.</p>
          </div>
        )}
      </Card>
    </section>
  );
}
