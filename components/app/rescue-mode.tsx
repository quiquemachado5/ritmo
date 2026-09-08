"use client";

import { ArrowRight, Check, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RescateRitmo } from "@/lib/model/insights";

export function RescueMode({ rescate, onCompletar, onVerTodo }: { rescate: RescateRitmo; onCompletar: () => void; onVerTodo: () => void }) {
  return (
    <section aria-labelledby="rescate-titulo" className="mx-auto flex w-full max-w-3xl flex-1 items-start py-4 sm:items-center sm:py-[clamp(1rem,8vh,6rem)]">
      <Card className="rescue-surface relative w-full overflow-hidden border-primary/18 p-5 sm:p-8">
        <div className="relative z-10 max-w-xl">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md"><LifeBuoy className="size-5" /></span>
          <h2 id="rescate-titulo" className="mt-6 max-w-lg font-display text-3xl font-bold leading-tight text-balance sm:text-5xl">Hoy no toca remontarlo todo.</h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">Tus últimos {rescate.dias} días estuvieron al {rescate.constancia}% de constancia. RITMO aparta el ruido y propone una sola acción.</p>
          <div className="mt-7 border-y border-primary/15 py-5">
            <p className="text-xs font-semibold text-muted-foreground">La misión de hoy</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">{rescate.habitoEtiqueta}</p>
          </div>
          <div className="mt-4 flex items-stretch gap-1.5">
            <Button onClick={onCompletar} className="min-h-12 min-w-0 flex-1 gap-2 px-3"><Check className="size-4" /> Marcar como hecho</Button>
            <Button variant="ghost" onClick={onVerTodo} aria-label="Ver mi panel completo" className="min-h-12 shrink-0 gap-1 px-2.5 text-muted-foreground">Panel <ArrowRight className="size-4" /></Button>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">El modo rescate no modifica el modelo ni inventa datos. Solo reduce la interfaz hasta que decidas volver.</p>
        </div>
      </Card>
    </section>
  );
}
