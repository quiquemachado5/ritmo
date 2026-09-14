import { Calculator, CircleHelp, Scale, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataSourceKind = "measured" | "calculated" | "estimated" | "unknown";

const SOURCE_META = {
  measured: { label: "Medido", detail: "Dato introducido o leído de una medición real", icon: Scale, className: "border-weight/25 bg-weight-wash text-weight-ink" },
  calculated: { label: "Calculado", detail: "Resultado matemático a partir de datos registrados", icon: Calculator, className: "border-habit/25 bg-habit-wash text-habit-ink" },
  estimated: { label: "Estimado", detail: "Aproximación del modelo; puede cambiar al añadir datos", icon: Sparkles, className: "border-energy/25 bg-energy-wash text-energy-ink" },
  unknown: { label: "Sin datos", detail: "Todavía no hay información suficiente", icon: CircleHelp, className: "border-border bg-secondary text-muted-foreground" },
} satisfies Record<DataSourceKind, { label: string; detail: string; icon: typeof Scale; className: string }>;

export function DataSourceBadge({ source, detail, compact = false, className }: { source: DataSourceKind; detail?: string; compact?: boolean; className?: string }) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <span title={detail ?? meta.detail} className={cn("inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[0.66rem] font-semibold", meta.className, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {compact ? meta.label.toLocaleLowerCase("es-ES") : meta.label}
    </span>
  );
}

export function DataSourceLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Origen de los datos">
      <DataSourceBadge source="measured" compact />
      <DataSourceBadge source="calculated" compact />
      <DataSourceBadge source="estimated" compact />
    </div>
  );
}
