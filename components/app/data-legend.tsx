import { cn } from "@/lib/utils";
import { HABIT_SCALE_CLASSES } from "@/lib/visual-semantics";

export interface LegendItem {
  label: string;
  colorVar: "--weight" | "--energy" | "--habit" | "--body" | "--water" | "--warning";
  style?: "line" | "dashed" | "dotted" | "wash" | "bar";
}

/** Leyenda compartida por todas las visualizaciones de RITMO. */
export function DataLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground", className)} aria-label="Leyenda del gráfico">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <LegendMark item={item} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function LegendMark({ item }: { item: LegendItem }) {
  if (item.style === "wash") return <span className="h-3 w-5 rounded-sm ring-1" style={{ background: `color-mix(in srgb, var(${item.colorVar}) 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${item.colorVar}) 32%, transparent)` }} />;
  if (item.style === "bar") return <span className="h-3 w-2 rounded-[3px]" style={{ backgroundColor: `var(${item.colorVar})` }} />;
  const border = item.style === "dashed" ? "border-dashed" : item.style === "dotted" ? "border-dotted" : "border-solid";
  return <span className={cn("h-0 w-5 border-b-2", border)} style={{ borderColor: `var(${item.colorVar})` }} />;
}

export function HabitScaleLegend({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)} aria-label="Escala de constancia, de cero a todos los hábitos">
      <span>{compact ? "0" : "0 hábitos"}</span>
      {HABIT_SCALE_CLASSES.map((color, index) => <span key={index} className={cn("size-3.5 rounded-[4px]", color)} />)}
      <span>{compact ? "Todos" : "todos"}</span>
    </div>
  );
}

