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

/** Wordmark aprobado de RITMO: se muestra como la imagen raster original. */
export function RitmoWordmark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/ritmo-wordmark-transparent.png"
      alt="RITMO"
      className={cn("h-9 w-auto object-contain dark:brightness-0 dark:invert", className)}
    />
  );
}

/** Logotipo de RITMO: el wordmark aprobado es la única marca visible. */
export function RitmoLogo({
  className,
  compact = false,
  wordmarkClassName,
}: {
  className?: string;
  compact?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex", className)}>
      {!compact && <RitmoWordmark className={wordmarkClassName} />}
    </span>
  );
}
