import { describe, expect, it } from "vitest";
import { analizarLocal } from "../local";
import { evaluateNutrition } from "../evaluation";
import { NUTRITION_REFERENCE_SUITE } from "../reference-suite";
import { nutritionQualityFailures } from "../quality-gate";

describe("puerta de calidad nutricional", () => {
  it("impide publicar una regresión del motor local", () => {
    const metrics = evaluateNutrition(NUTRITION_REFERENCE_SUITE.map((meal) => ({ meal, result: analizarLocal(meal.texto) })));
    expect(metrics.casos).toBe(72);
    expect(nutritionQualityFailures(metrics), JSON.stringify(metrics)).toEqual([]);
  });
});
