import { cn } from "@/lib/utils";

/** Símbolo oficial: la onda continua de la nueva identidad RITMO. */
export function RitmoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <path
        d="M18 76C31 76 38 42 52 42C66 42 72 76 84 76C97 76 103 42 112 42"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icono de aplicación oficial para espacios donde el wordmark no cabe. */
export function RitmoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-[0.6rem] bg-[#1C5B3A] text-[#F6F7F2]",
        className,
      )}
      aria-hidden="true"
    >
      <RitmoMark className="size-7" />
    </span>
  );
}

/** Wordmark oficial, nítido a cualquier escala y adaptado a claro/oscuro. */
export function RitmoWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 364 94"
      role="img"
      aria-label="RITMO"
      className={cn("h-8 w-auto text-[#1C5B3A] dark:text-[#F6F7F2]", className)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="15.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 84V59C8 41 17 31 31 31" />
        <path d="M62 39V84" />
        <path d="M100 9.5C97.5 15.5 96 21 96 29V59C96 74 104 81 122 81C140 81 153 41 169 41C184 41 193 70 205 70C217 70 227 41 242 41C257 41 266 82 279 83" />
        <path d="M96 31H126" />
        <circle cx="62" cy="9.5" r="8.8" fill="currentColor" stroke="none" />
        <circle cx="329" cy="58.5" r="26.5" />
      </g>
      <path d="M273.5 75.3C281 79 286.5 86 294 90C286.5 91.6 279 91 272.8 88.2Z" fill="currentColor" />
    </svg>
  );
}

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
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {compact ? <RitmoBadge /> : <RitmoWordmark className={wordmarkClassName} />}
    </span>
  );
}
