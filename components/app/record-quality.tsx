import { Database, ShieldCheck } from "lucide-react";
import type { Comida } from "@/lib/model/types";
import { cn } from "@/lib/utils";

export type RecordQualityLevel = "alta" | "media" | "baja" | "sin-datos";

const STYLE: Record<RecordQualityLevel, { bar: string; icon: string; label: string }> = {
  alta: { bar: "bg-weight", icon: "bg-weight-wash text-weight-ink", label: "Alta" },
  media: { bar: "bg-habit", icon: "bg-habit-wash text-habit-ink", label: "Media" },
  baja: { bar: "bg-warning", icon: "bg-warning-wash text-warning-ink", label: "Baja" },
  "sin-datos": { bar: "bg-muted-foreground/30", icon: "bg-secondary text-muted-foreground", label: "Sin datos" },
};

export function qualityForDay(comidas: Comida[], habitosHechos: number, totalHabitos: number): { level: RecordQualityLevel; detail: string } {
  const aproximadas = comidas.filter((comida) => comida.estimado || comida.fuente === "offline").length;
  const señales = (comidas.length > 0 ? 1 : 0) + (habitosHechos > 0 ? 1 : 0);
  if (señales === 0) return { level: "sin-datos", detail: "Añade una comida o marca un hábito para iniciar la lectura." };
  if (señales === 2 && habitosHechos >= Math.ceil(totalHabitos * 0.66) && aproximadas === 0) return { level: "alta", detail: `${habitosHechos}/${totalHabitos} hábitos · ${comidas.length} comida${comidas.length === 1 ? "" : "s"} revisada${comidas.length === 1 ? "" : "s"}.` };
  if (señales === 2 || (comidas.length > 0 && aproximadas < comidas.length)) return { level: "media", detail: `${habitosHechos}/${totalHabitos} hábitos · ${comidas.length} comida${comidas.length === 1 ? "" : "s"}; revisa las cantidades estimadas.` };
  return { level: "baja", detail: comidas.length > 0 ? "Hay comida registrada, pero faltan hábitos o cantidades por confirmar." : "Los hábitos orientan el día; registrar comidas afinará kcal y macros." };
}

export function RecordQuality({ level, detail, className }: { level: RecordQualityLevel; detail: string; className?: string }) {
  const style = STYLE[level];
  const active = level === "alta" ? 4 : level === "media" ? 3 : level === "baja" ? 2 : 0;
  const Icon = level === "alta" ? ShieldCheck : Database;
  return (
    <div className={cn("flex min-w-0 items-center gap-3 border-t border-border pt-3", className)} aria-label={`Calidad del registro: ${style.label}. ${detail}`}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", style.icon)}><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-foreground">Calidad del registro</p><span className="text-[0.65rem] font-semibold text-muted-foreground">{style.label}</span></div>
        <div className="mt-1.5 flex gap-1" aria-hidden="true">{[1, 2, 3, 4].map((part) => <span key={part} className={cn("h-1 flex-1 rounded-full", part <= active ? style.bar : "bg-secondary")} />)}</div>
        <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
