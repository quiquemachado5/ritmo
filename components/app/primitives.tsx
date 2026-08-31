import * as React from "react";
import { cn } from "@/lib/utils";

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
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {children}
      </h2>
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
        <span className="font-display text-2xl font-bold leading-none tabular" style={color}>
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
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
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
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {children && <p className="max-w-xs text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}
