import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function IntegratedFlow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div data-slot="integrated-flow" className={cn("ritmo-integrated-flow relative flex flex-col gap-8 before:absolute before:bottom-5 before:left-[1.12rem] before:top-5 before:hidden before:w-px before:bg-border/80 sm:gap-10 sm:before:block", className)}>{children}</div>;
}

export function FlowChapter({ title, description, icon: Icon, tone = "primary", children, className }: {
  title: string;
  description: React.ReactNode;
  icon: LucideIcon;
  tone?: "primary" | "energy" | "habit" | "body" | "weight";
  children: React.ReactNode;
  className?: string;
}) {
  const tonos = {
    primary: "border-primary/25 bg-primary text-primary-foreground",
    energy: "border-energy-border bg-energy text-energy-foreground",
    habit: "border-habit-border bg-habit text-habit-foreground",
    body: "border-body-border bg-body text-body-foreground",
    weight: "border-weight-border bg-weight text-weight-foreground",
  } as const;
  return <section data-slot="flow-chapter" className={cn("ritmo-flow-chapter relative sm:pl-12", className)}>
    <span className={cn("absolute left-0 top-0 z-10 grid size-9 place-items-center rounded-xl border-4 border-background shadow-sm", tonos[tone])} aria-hidden="true"><Icon className="size-4" /></span>
    <header data-slot="flow-header" className="mb-4 min-w-0 pl-12 pt-0.5 sm:pl-0"><h2 className="font-display text-xl font-bold tracking-tight">{title}</h2><p data-slot="flow-description" className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p></header>
    <div data-slot="flow-content" className="flex min-w-0 flex-col gap-4">{children}</div>
  </section>;
}

/** Cabecera común de las herramientas de RITMO. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header data-slot="page-header" className={cn("ritmo-page-header page-header flex flex-col gap-4 border-b border-border/75 pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[1.7rem] font-bold leading-tight tracking-tight text-balance sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex w-full shrink-0 items-center sm:w-auto sm:justify-end">{action}</div>}
    </header>
  );
}

/* Etiqueta de sección en versalitas — el "show, don't tell" de RITMO. */
export function SectionLabel({
  children,
  className,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div data-slot="section-header" className={cn("ritmo-section-label mb-3 flex min-w-0 items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h2 className="shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.11em] text-muted-foreground">
          {children}
        </h2>
        <span className="hidden h-px min-w-5 flex-1 bg-border/70 sm:block" aria-hidden="true" />
      </div>
      {action}
    </div>
  );
}

/* Micro-etiqueta sobre una cifra. */
export function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </span>
  );
}

/* Métrica: micro-etiqueta encima, cifra grande tabular debajo. */
export function Metric({
  label,
  value,
  unit,
  hint,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: "weight" | "habit" | "energy" | "body" | "water" | "warning" | "default";
  className?: string;
}) {
  const color =
    tone && tone !== "default" ? { color: `var(--${tone})` } : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <MicroLabel>{label}</MicroLabel>
      <div className="flex items-baseline gap-1">
        <span className="ritmo-metric-value font-display text-2xl font-bold leading-none tabular" style={color}>
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/* Anillo de progreso SVG. */
export function Ring({
  value,
  max,
  size = 128,
  stroke = 12,
  colorVar = "--weight",
  trackVar = "--secondary",
  segments,
  children,
  className,
  ariaLabel,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  colorVar?: string;
  trackVar?: string;
  segments?: Array<{ value: number; max: number; colorVar: string }>;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const dash = c * pct;
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="ritmo-ring-visual -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`var(${trackVar})`} strokeWidth={stroke} />
        {segments?.length ? (() => {
          let offset = 0;
          return segments.map((segment, index) => {
            const length = Math.max(0, Math.min(c, c * Math.min(1, segment.value / Math.max(1, segment.max)) - 2));
            const circle = <circle key={segment.colorVar + index} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`var(${segment.colorVar})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${length} ${c - length}`} strokeDashoffset={-offset} className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out" />;
            offset += length + 2;
            return circle;
          });
        })() : <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* Barra de macro/energía con etiqueta y valor. */
export function MacroBar({
  label,
  value,
  max,
  unit = "g",
  colorVar = "--weight",
  className,
}: {
  label: string;
  value: number;
  max?: number | null;
  unit?: string;
  colorVar?: string;
  className?: string;
}) {
  const pct = max && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="tabular text-muted-foreground">
          <span className="font-semibold text-foreground" style={{ color: `var(${colorVar})` }}>
            {Math.round(value)}
          </span>
          {max ? ` / ${Math.round(max)}` : ""} {unit}
        </span>
      </div>
      <div className="ritmo-progress-track h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="ritmo-progress-fill h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: `var(${colorVar})` }}
        />
      </div>
    </div>
  );
}

/* Chip de estado/procedencia (estimado, imputado, medido…). */
export function Chip({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "weight" | "habit" | "energy" | "body" | "water" | "warning";
  className?: string;
}) {
  const styles: Record<string, string> = {
    muted: "bg-secondary text-secondary-foreground",
    weight: "bg-weight-wash text-weight-ink",
    habit: "bg-habit-wash text-habit-ink",
    energy: "bg-energy-wash text-energy-ink",
    body: "bg-body-wash text-body-ink",
    water: "bg-water-wash text-water-ink",
    warning: "bg-warning-wash text-warning-ink",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
        styles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* Estado vacío coherente. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  unlocks,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  unlocks?: string[];
}) {
  return (
    <div className="ritmo-empty-state flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center sm:px-6 sm:py-10">
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {children && <p className="max-w-xs text-sm text-muted-foreground">{children}</p>}
      {unlocks && unlocks.length > 0 && (
        <div className="mt-1 w-full max-w-md rounded-xl bg-secondary/55 p-3 text-left">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Qué desbloquea</p>
          <ul className="mt-2 grid gap-1.5 text-xs text-foreground sm:grid-cols-2">
            {unlocks.map((item) => <li key={item} className="flex items-start gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}
          </ul>
        </div>
      )}
      {action}
    </div>
  );
}
