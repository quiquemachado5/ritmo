import type { NutritionEvaluation } from "./evaluation";

export const NUTRITION_QUALITY_BUDGET = {
  minimumCases: 72,
  maxKcalMape: 8,
  maxKcalP90: 90,
  maxAbsoluteKcalBias: 50,
  minimumWithinTolerancePct: 65,
} as const;

export function nutritionQualityFailures(metrics: NutritionEvaluation): string[] {
  const failures: string[] = [];
  if (metrics.casos < NUTRITION_QUALITY_BUDGET.minimumCases) failures.push(`Solo hay ${metrics.casos} casos; se necesitan ${NUTRITION_QUALITY_BUDGET.minimumCases}.`);
  if (metrics.mape.kcal > NUTRITION_QUALITY_BUDGET.maxKcalMape) failures.push(`MAPE kcal ${metrics.mape.kcal}% > ${NUTRITION_QUALITY_BUDGET.maxKcalMape}%.`);
  if (metrics.p90.kcal > NUTRITION_QUALITY_BUDGET.maxKcalP90) failures.push(`P90 kcal ${metrics.p90.kcal} > ${NUTRITION_QUALITY_BUDGET.maxKcalP90}.`);
  if (Math.abs(metrics.sesgo.kcal) > NUTRITION_QUALITY_BUDGET.maxAbsoluteKcalBias) failures.push(`Sesgo kcal ${metrics.sesgo.kcal} fuera de ±${NUTRITION_QUALITY_BUDGET.maxAbsoluteKcalBias}.`);
  if (metrics.dentroToleranciaPct < NUTRITION_QUALITY_BUDGET.minimumWithinTolerancePct) failures.push(`Solo ${metrics.dentroToleranciaPct}% dentro de tolerancia.`);
  return failures;
}
