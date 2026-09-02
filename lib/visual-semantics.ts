/** Escala cromática única para constancia: 0/6 rojo, 6/6 verde. */
export const HABIT_SCALE_CLASSES = [
  "bg-destructive/48 ring-1 ring-destructive/16",
  "bg-energy/52 ring-1 ring-energy/16",
  "bg-warning/58 ring-1 ring-warning/18",
  "bg-habit/58 ring-1 ring-habit/18",
  "bg-primary/48 ring-1 ring-primary/16",
  "bg-primary/72 ring-1 ring-primary/22",
  "bg-primary ring-1 ring-primary/32",
] as const;

export function habitScaleIndex(completados: number, total: number): number {
  const max = HABIT_SCALE_CLASSES.length - 1;
  return Math.max(0, Math.min(max, Math.round((completados / Math.max(1, total)) * max)));
}

export function habitScaleClass(completados: number, total: number): string {
  return HABIT_SCALE_CLASSES[habitScaleIndex(completados, total)];
}

