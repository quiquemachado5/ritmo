import { afterEach, describe, expect, it, vi } from "vitest";
import { analizarLocal } from "../local";
import { REFERENCE_MEALS } from "../reference-meals";
import { evaluateNutrition } from "../evaluation";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
describe("nutrición sin facturación", () => {
  it("funciona sin red y bloquea proveedores aunque existan claves antiguas", async () => {
    const fetch = vi.fn(() => { throw new Error("No debería salir del dispositivo"); });
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("NUTRITION_AI_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "clave-sintetica-no-valida");
    vi.stubEnv("EDAMAM_APP_ID", "fixture");
    vi.stubEnv("EDAMAM_APP_KEY", "fixture");
    const { analizarComida } = await import("../client");
    const { analizarConGemini } = await import("../gemini");
    const { analizarConEdamam } = await import("../edamam");
    const { claimNutrition } = await import("../budget");
    expect((await analizarComida("100 g de pan")).fuente).toBe("offline");
    expect(await analizarConGemini("100 g de pan")).toBeNull();
    expect(await analizarConEdamam("100 g de pan")).toBeNull();
    expect(await claimNutrition("fixture", "a".repeat(64))).toEqual({ status: "disabled" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("recuerda una corrección para igual ingrediente y cantidad, no para otra porción", () => {
    const correccion = { clave: "pan", nombre: "pan", cantidad: "100 g", kcal: 240, proteinas: 8, carbohidratos: 43, grasas: 4, actualizada: 1 };
    expect(analizarLocal("100 g de pan", [correccion]).kcal).toBe(240);
    expect(analizarLocal("50 g de pan", [correccion]).kcal).not.toBe(240);
    expect(analizarLocal("100 g de pan", [correccion]).observaciones?.[0]).toContain("una corrección");
  });
  it("no inventa un resultado completo si no reconoce el alimento", () => {
    const resultado = analizarLocal("Un plato desconocido");
    expect(resultado.items).toHaveLength(0);
    expect(resultado.aviso).toContain("No se reconoció");
    expect(() => analizarLocal("x".repeat(2501))).toThrow();
  });
  it("evalúa todos los platos de referencia sin consumir una API", () => {
    const casos = REFERENCE_MEALS.map(meal => ({ meal, result: analizarLocal(meal.texto) }));
    for (const { result } of casos) {
      expect(result.fuente).toBe("offline");
      expect(result.kcal).toBeGreaterThan(0);
      expect(Number.isFinite(result.kcal)).toBe(true);
      expect(result.kcal).toBe(result.items.reduce((n, i) => n + i.kcal, 0));
    }
    const metricas = evaluateNutrition(casos);
    // Informe de regresión, no certificación nutricional ni equivalencia a Gemini.
    console.info("Evaluación local frente a referencias aproximadas:", JSON.stringify(metricas));
    expect(metricas.casos).toBe(REFERENCE_MEALS.length);
  });
});
