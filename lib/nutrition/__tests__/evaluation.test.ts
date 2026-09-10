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
      kcal: meal.referencia.kcal + 20,
      proteinas: meal.referencia.proteinas,
      carbohidratos: meal.referencia.carbohidratos,
      grasas: meal.referencia.grasas,
    };
    const metrics = evaluateNutrition([{ meal, result }]);
    expect(metrics.mae.kcal).toBe(20);
    expect(metrics.mape.kcal).toBeCloseTo(3.6, 1);
    expect(metrics.p90.kcal).toBe(20);
    expect(metrics.sesgo.kcal).toBe(20);
    expect(metrics.dentroToleranciaPct).toBe(100);
  });

  it("distingue sesgo sistemático de error absoluto", () => {
    const meal = REFERENCE_MEALS[0];
    const resultado = (kcal: number): AnalisisNutricional => ({
      resumen: meal.texto, items: [], fuente: "offline", confianza: "media", kcal,
      proteinas: meal.referencia.proteinas, carbohidratos: meal.referencia.carbohidratos, grasas: meal.referencia.grasas,
    });
    const metrics = evaluateNutrition([
      { meal, result: resultado(meal.referencia.kcal + 100) },
      { meal, result: resultado(meal.referencia.kcal - 100) },
    ]);
    expect(metrics.mae.kcal).toBe(100);
    expect(metrics.sesgo.kcal).toBe(0);
    expect(metrics.p90.kcal).toBe(100);
  });
});
