/** Escala cromática única para constancia: 0/6 rojo, 6/6 verde. */
export const HABIT_SCALE_CLASSES = [
  "bg-[var(--constancia-0)]",
  "bg-[var(--constancia-1)]",
  "bg-[var(--constancia-2)]",
  "bg-[var(--constancia-3)]",
  "bg-[var(--constancia-4)]",
  "bg-[var(--constancia-5)]",
  "bg-[var(--constancia-6)]",
] as const;

export function habitScaleIndex(completados: number, total: number): number {
  const max = HABIT_SCALE_CLASSES.length - 1;
  return Math.max(0, Math.min(max, Math.round((completados / Math.max(1, total)) * max)));
}

export function habitScaleClass(completados: number, total: number): string {
  return HABIT_SCALE_CLASSES[habitScaleIndex(completados, total)];
}
