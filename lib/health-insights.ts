import { sumarDias } from "./model/dates";
import type { Estado } from "./model/types";

export interface HealthDayPoint {
  date: string;
  steps: number | null;
  sleepMinutes: number | null;
  workoutMinutes: number | null;
}

export interface HealthWindow {
  days: number;
  points: HealthDayPoint[];
  coveredDays: number;
  steps: { days: number; average: number | null; total: number };
  sleep: { days: number; averageMinutes: number | null };
  workout: { days: number; totalMinutes: number; averageMinutes: number | null };
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

/** Ventana descriptiva de métricas importadas; no completa días ausentes. */
export function healthWindow(estado: Estado, days: number, until: string): HealthWindow {
  const safeDays = Math.max(1, Math.min(365, Math.round(days)));
  const points = Array.from({ length: safeDays }, (_, index) => {
    const date = sumarDias(until, index - safeDays + 1);
    const day = estado.dias[date];
    return {
      date,
      steps: day?.pasos == null ? null : day.pasos,
      sleepMinutes: day?.suenoMinutos == null ? null : day.suenoMinutos,
      workoutMinutes: day?.entrenamientoMinutos == null ? null : day.entrenamientoMinutos,
    };
  });
  const steps = points.flatMap((point) => point.steps == null ? [] : [point.steps]);
  const sleep = points.flatMap((point) => point.sleepMinutes == null ? [] : [point.sleepMinutes]);
  const workout = points.flatMap((point) => point.workoutMinutes == null ? [] : [point.workoutMinutes]);
  return {
    days: safeDays,
    points,
    coveredDays: points.filter((point) => point.steps != null || point.sleepMinutes != null || point.workoutMinutes != null).length,
    steps: { days: steps.length, average: average(steps), total: steps.reduce((sum, value) => sum + value, 0) },
    sleep: { days: sleep.length, averageMinutes: average(sleep) },
    workout: { days: workout.length, totalMinutes: workout.reduce((sum, value) => sum + value, 0), averageMinutes: average(workout) },
  };
}
