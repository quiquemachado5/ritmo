import { describe, expect, it } from "vitest";
import { evaluateNutrition } from "../evaluation";
import { REFERENCE_MEALS } from "../reference-meals";
import type { AnalisisNutricional } from "../types";

describe("evaluateNutrition", () => {
  it("calcula MAE, MAPE y cumplimiento de tolerancia", () => {
    const meal = REFERENCE_MEALS[0];
    const result: AnalisisNutricional = {
      resumen: meal.texto,
      items: [],
      fuente: "gemini",
      confianza: "alta",
      kcal: meal.referencia.kcal + 50,
      proteinas: meal.referencia.proteinas,
      carbohidratos: meal.referencia.carbohidratos,
      grasas: meal.referencia.grasas,
    };
    const metrics = evaluateNutrition([{ meal, result }]);
    expect(metrics.mae.kcal).toBe(50);
    expect(metrics.mape.kcal).toBeCloseTo(8.4, 1);
    expect(metrics.dentroToleranciaPct).toBe(100);
  });
});
