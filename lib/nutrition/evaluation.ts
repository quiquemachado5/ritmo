import type { AnalisisNutricional } from "./types";
import type { ReferenceMeal } from "./reference-meals";

type NutrientKey = "kcal" | "proteinas" | "carbohidratos" | "grasas";

export interface NutritionEvaluation {
  casos: number;
  mae: Record<NutrientKey, number>;
  mape: Record<NutrientKey, number>;
  dentroToleranciaPct: number;
}

const NUTRIENTS: NutrientKey[] = ["kcal", "proteinas", "carbohidratos", "grasas"];
const round = (value: number) => Math.round(value * 10) / 10;

/** Métricas agregadas y reproducibles para comparar modelos o prompts. */
export function evaluateNutrition(
  cases: Array<{ meal: ReferenceMeal; result: AnalisisNutricional }>,
): NutritionEvaluation {
  if (!cases.length) {
    return {
      casos: 0,
      mae: { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
      mape: { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
      dentroToleranciaPct: 0,
    };
  }

  const absolute = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
  const relative = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
  let within = 0;

  for (const { meal, result } of cases) {
    let caseWithin = true;
    for (const nutrient of NUTRIENTS) {
      const expected = meal.referencia[nutrient];
      const error = Math.abs(result[nutrient] - expected);
      absolute[nutrient] += error;
      relative[nutrient] += error / Math.max(1, expected);
      if ((error / Math.max(1, expected)) * 100 > meal.toleranciaPct) caseWithin = false;
    }
    if (caseWithin) within++;
  }

  return {
    casos: cases.length,
    mae: Object.fromEntries(NUTRIENTS.map((key) => [key, round(absolute[key] / cases.length)])) as NutritionEvaluation["mae"],
    mape: Object.fromEntries(NUTRIENTS.map((key) => [key, round((relative[key] / cases.length) * 100)])) as NutritionEvaluation["mape"],
    dentroToleranciaPct: round((within / cases.length) * 100),
  };
}
