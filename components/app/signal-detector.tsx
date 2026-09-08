import { CalendarRange, Droplets, MoonStar, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SenalRitmo } from "@/lib/model/insights";

const iconos = { "alcohol-peso": Droplets, "sueno-deporte": MoonStar, "dia-semana": CalendarRange, recuperacion: RotateCcw };
const tonos = {
  weight: "bg-weight-wash text-weight-ink",
  habit: "bg-habit-wash text-habit-ink",
  water: "bg-water-wash text-water-ink",
  warning: "bg-warning-wash text-warning-ink",
};

export function SignalDetector({ senales }: { senales: SenalRitmo[] }) {
  if (!senales.length) return <p className="px-4 py-4 text-sm leading-relaxed text-muted-foreground sm:px-5">Aún faltan repeticiones comparables. Las señales aparecen cuando existe evidencia suficiente, no por una coincidencia aislada.</p>;
  return (
    <div className="divide-y divide-border">
      {senales.map((senal) => {
        const Icono = iconos[senal.id as keyof typeof iconos] ?? CalendarRange;
        return (
          <article key={senal.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:px-5">
            <span className={cn("grid size-10 place-items-center rounded-xl", tonos[senal.tono])}><Icono className="size-4" /></span>
            <div className="min-w-0"><h3 className="text-sm font-semibold">{senal.titulo}</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{senal.descripcion}</p><p className="mt-2 text-[0.66rem] text-muted-foreground">{senal.evidencia} · confianza {senal.confianza}</p></div>
            <p className="self-start font-display text-xl font-bold tabular sm:text-right">{senal.metrica}</p>
          </article>
        );
      })}
      <p className="px-4 py-3 text-[0.66rem] leading-relaxed text-muted-foreground sm:px-5">Son asociaciones de tu historial, no relaciones de causa y efecto. RITMO descarta señales con muestras insuficientes.</p>
    </div>
  );
}
