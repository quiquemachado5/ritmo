import { cn } from "@/lib/utils";

/**
 * Isotipo de RITMO — cuatro barras ascendentes con cadencia, a la vez
 * ecualizador (ritmo) y progreso (constancia que crece). Usa currentColor,
 * así que hereda el verde de marca en cualquier contexto.
 */
export function RitmoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <rect x="3" y="19" width="5" height="10" rx="2.5" fill="currentColor" opacity="0.45" />
      <rect x="10.5" y="13" width="5" height="16" rx="2.5" fill="currentColor" opacity="0.7" />
      <rect x="18" y="7" width="5" height="22" rx="2.5" fill="currentColor" />
      <circle cx="27.5" cy="6" r="2.6" fill="currentColor" className="animate-ritmo-pulse" />
    </svg>
  );
}

/** Isotipo dentro de una placa redondeada (para avatares / marca en cabecera). */
export function RitmoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[0.7rem] bg-primary text-primary-foreground shadow-sm",
        "size-9",
        className,
      )}
    >
      <RitmoMark className="size-6" />
    </span>
  );
}

/** Logo completo: isotipo + logotipo. */
export function RitmoLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {!compact && <RitmoBadge />}
      {!compact && (
        <span aria-label="RITMO" className="ritmo-wordmark text-primary">
          <span>R</span><span>I</span><span>T</span><span>M</span><span>O</span>
        </span>
      )}
      {compact && <RitmoMark />}
    </span>
  );
}
