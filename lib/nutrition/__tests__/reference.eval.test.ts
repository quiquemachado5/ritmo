import { describe, expect, it } from "vitest";
import { analizarConGemini } from "../gemini";
import { evaluateNutrition } from "../evaluation";
import { REFERENCE_MEALS } from "../reference-meals";
import { EXTERNAL_NUTRITION_ENABLED } from "../policy";

const live = process.env.RUN_GEMINI_EVAL === "1";
if (live && !EXTERNAL_NUTRITION_ENABLED) throw new Error("Los proveedores externos están bloqueados por la configuración sin facturación de RITMO. Usa test:nutrition:local.");
if (live && !process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY es obligatoria para ejecutar el benchmark real; no se omite silenciosamente.");

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
    expect(metrics.casos, "Todos los platos deben responder; una caída del servicio también es un fallo").toBe(REFERENCE_MEALS.length);
    expect(metrics.mape.kcal).toBeLessThanOrEqual(25);
    expect(metrics.mape.proteinas).toBeLessThanOrEqual(30);
    expect(metrics.mape.carbohidratos).toBeLessThanOrEqual(35);
    expect(metrics.mape.grasas).toBeLessThanOrEqual(30);
    // Detecta resultados numéricamente válidos pero inútiles para el usuario.
    for (const { meal, result } of cases) {
      expect(Math.abs(result.kcal - meal.referencia.kcal) / meal.referencia.kcal, meal.id).toBeLessThanOrEqual(0.5);
      expect(result.items.length, meal.id).toBeGreaterThan(0);
    }
  }, 480_000);
});
