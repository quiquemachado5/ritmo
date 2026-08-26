import { cn } from "@/lib/utils";

/**
 * Isotipo de RITMO — la R sólida del wordmark, reducida para los contextos
 * compactos. Conserva el mismo contragolpe y pierna diagonal de la marca.
 */
export function RitmoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M5 4h10.1c6.1 0 10.2 3.1 10.2 8.2 0 3.9-2.4 6.6-6.4 7.7L26.4 28h-7.5L13 20.6h-1V28H5V4Zm7 6v5.2h3c2.3 0 3.6-1 3.6-2.6S17.3 10 15 10h-3Z" />
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

/** Wordmark geométrico: la M sólida incorpora la cadencia curvada de RITMO. */
export function RitmoWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 142 32"
      fill="currentColor"
      aria-label="RITMO"
      role="img"
      className={cn("h-5 w-auto text-foreground", className)}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M2 3h11.1c6.8 0 11.3 3.4 11.3 8.9 0 4.1-2.5 7-6.6 8.2L25.3 29h-8L11.5 20h-1.4v9H2V3Zm8.1 6.2v5.6h3.1c2.2 0 3.6-1.1 3.6-2.8s-1.4-2.8-3.6-2.8h-3.1Z" />
      <rect x="29" y="3" width="7.8" height="26" />
      <path d="M41 3h22v6.4h-7.1V29h-7.8V9.4H41V3Z" />
      <path d="M68 29V3h8v10.3c2.4 4.7 4.5 8.1 7.1 10.3 1.1.9 2.3 1.4 3.8 1.4s2.7-.5 3.8-1.4c2.6-2.2 4.7-5.6 7.1-10.3V3h8v26h-8V18.3c-1.8 2.6-3.5 4.9-5.5 6.5-1.7 1.5-3.5 2.2-5.5 2.2s-3.8-.7-5.5-2.2c-2-1.6-3.7-3.9-5.5-6.5V29h-7.8Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M122.8 3c8.6 0 15.2 5.5 15.2 13s-6.6 13-15.2 13-15.2-5.5-15.2-13 6.6-13 15.2-13Zm0 7c-4 0-6.8 2.5-6.8 6s2.8 6 6.8 6 6.8-2.5 6.8-6-2.8-6-6.8-6Z" />
    </svg>
  );
}

/** Logotipo de RITMO: la versión sólo-wordmark se reserva para el lateral. */
export function RitmoLogo({
  className,
  compact = false,
  wordmarkOnly = false,
  wordmarkClassName,
}: {
  className?: string;
  compact?: boolean;
  wordmarkOnly?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {!wordmarkOnly && <RitmoBadge />}
      {!compact && (
        <RitmoWordmark className={wordmarkClassName} />
      )}
    </span>
  );
}
