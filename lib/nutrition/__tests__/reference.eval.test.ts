import { describe, expect, it } from "vitest";
import { analizarConGemini } from "../gemini";
import { evaluateNutrition } from "../evaluation";
import { REFERENCE_MEALS } from "../reference-meals";

const live = process.env.RUN_GEMINI_EVAL === "1" && Boolean(process.env.GEMINI_API_KEY);

(live ? describe : describe.skip)("benchmark real de Gemini", () => {
  it("mide el error contra platos complejos de referencia", async () => {
    const cases = [];
    const unavailable: string[] = [];
    const delay = Number(process.env.GEMINI_EVAL_DELAY_MS || 7_000);
    for (const meal of REFERENCE_MEALS) {
      const result = await analizarConGemini(meal.texto);
      if (result) cases.push({ meal, result });
      else unavailable.push(meal.id);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const metrics = evaluateNutrition(cases);
    console.table({
      "casos evaluados": `${metrics.casos}/${REFERENCE_MEALS.length}`,
      "sin respuesta": unavailable.join(", ") || "ninguno",
      "MAE kcal": metrics.mae.kcal,
      "MAPE kcal %": metrics.mape.kcal,
      "MAE proteína g": metrics.mae.proteinas,
      "MAE carbohidratos g": metrics.mae.carbohidratos,
      "MAE grasas g": metrics.mae.grasas,
      "casos dentro tolerancia %": metrics.dentroToleranciaPct,
    });
    expect(metrics.casos, "Gemini no produjo suficientes casos para un benchmark representativo").toBeGreaterThanOrEqual(Math.ceil(REFERENCE_MEALS.length * 0.75));
    expect(metrics.mape.kcal).toBeLessThanOrEqual(25);
  }, 300_000);
});
