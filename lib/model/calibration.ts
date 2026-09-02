/* ============================================================================
   CALIBRACIÓN HISTÓRICA RITMO

   Tabla robusta ajustada contra el seed septiembre 2025 → julio 2026. Cada
   tramo entre dos pesajes se tradujo a balance kcal/día y se ajustó por nivel
   de hábitos, recortando extremos de agua/glucógeno de tramos muy cortos.
   Signo: positivo = superávit, negativo = déficit.
   ========================================================================= */

import type { Objetivo } from "./types";

export const BALANCE_HABITOS_KCAL = [850, 650, 350, 100, -150, -550, -950] as const;

export function balanceCalibradoPorHabitos(cumplidos: number, total: number): number {
  const max = BALANCE_HABITOS_KCAL.length - 1;
  const ratio = total > 0 ? Math.max(0, Math.min(1, cumplidos / total)) : 0;
  const pos = ratio * max;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return BALANCE_HABITOS_KCAL[bajo];
  const t = pos - bajo;
  return Math.round(BALANCE_HABITOS_KCAL[bajo] * (1 - t) + BALANCE_HABITOS_KCAL[alto] * t);
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}

/**
 * Curva inicial para una persona que todavía no tiene suficientes pesajes.
 *
 * El extremo de máxima adherencia parte de su plan energético real (objetivo
 * de kcal frente a TDEE), limitado para no convertir una estimación de hábitos
 * en déficits fisiológicamente inverosímiles. El resto conserva la forma
 * robusta de la curva histórica de RITMO.
 */
export function balanceBasePorPerfil(
  cumplidos: number,
  total: number,
  opciones: { kcalObjetivo?: number; tdee?: number; objetivo?: Objetivo } = {},
): number {
  const ratio = total > 0 ? limitar(cumplidos / total, 0, 1) : 0;
  const tdee = Number.isFinite(opciones.tdee) ? opciones.tdee as number : 2450;
  const kcalObjetivo = Number.isFinite(opciones.kcalObjetivo) ? opciones.kcalObjetivo as number : 2000;
  const objetivo = opciones.objetivo ?? "perder";
  const balancePlan = kcalObjetivo - tdee;
  const extremoPerfecto = objetivo === "ganar"
    ? limitar(balancePlan, 120, 450)
    : objetivo === "mantener"
      ? limitar(balancePlan, -180, 180)
      : limitar(balancePlan, -950, -250);

  // La tabla histórica aporta la forma (un hábito extra no tiene siempre el
  // mismo efecto); sus extremos se reescalan al plan biológico de la persona.
  const generico = balanceCalibradoPorHabitos(cumplidos, total);
  const progreso = (BALANCE_HABITOS_KCAL[0] - generico)
    / (BALANCE_HABITOS_KCAL[0] - BALANCE_HABITOS_KCAL[6]);
  const superavitSinControl = objetivo === "ganar" ? 700 : 850;
  return Math.round(superavitSinControl + (extremoPerfecto - superavitSinControl) * progreso * Math.sqrt(Math.max(ratio, 0.05)));
}

/**
 * Límite prudente para balances que RITMO infiere, no para kcal completas
 * introducidas por la persona. Evita convertir comida omitida, agua o una
 * recalibración agresiva en pérdidas de tejido inverosímiles de un día a otro.
 */
export function limitarBalanceEstimado(balance: number, pesoKg?: number | null): number {
  const peso = Number.isFinite(pesoKg) && (pesoKg as number) > 30 ? pesoKg as number : 90;
  const deficitDiarioMax = limitar((peso * 0.01 * 7700) / 7, 700, 1100);
  const superavitDiarioMax = limitar((peso * 0.006 * 7700) / 7, 350, 700);
  return Math.round(limitar(balance, -deficitDiarioMax, superavitDiarioMax));
}
