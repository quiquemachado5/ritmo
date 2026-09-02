import { describe, expect, it } from "vitest";
import { normalizarNombreIngrediente, recalcularAnalisis } from "../corrections";
import type { AnalisisNutricional } from "../types";

describe("correcciones nutricionales", () => {
  it("normaliza nombres para aprender la misma referencia", () => {
    expect(normalizarNombreIngrediente("  Pechuga   de PÁVO ")).toBe("pechuga de pavo");
  });

  it("recalcula totales al corregir un ingrediente", () => {
    const base: AnalisisNutricional = {
      resumen: "pollo y arroz",
      kcal: 300,
      proteinas: 20,
      carbohidratos: 30,
      grasas: 5,
      fuente: "gemini",
      items: [],
    };
    const resultado = recalcularAnalisis(base, [
      { nombre: "Pollo", cantidad: "150 g", kcal: 248, proteinas: 46.5, carbohidratos: 0, grasas: 5.4 },
      { nombre: "Arroz", cantidad: "100 g", kcal: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3 },
    ]);
    expect(resultado).toMatchObject({ kcal: 378, proteinas: 49, carbohidratos: 28, grasas: 6 });
  });
});
