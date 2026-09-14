import { describe, expect, it } from "vitest";
import { detectarAnomaliasComida, detectarAnomaliasMedicion } from "../record-anomalies";

describe("detección de registros atípicos", () => {
  it("avisa de kcal incoherentes y cantidades desproporcionadas", () => {
    const avisos = detectarAnomaliasComida({
      kcal: 4_200,
      proteinas: 20,
      carbohidratos: 20,
      grasas: 10,
      items: [{ nombre: "aceite", cantidad: "4 l", kcal: 3_000, proteinas: 0, carbohidratos: 0, grasas: 330 }],
    });

    expect(avisos.map((aviso) => aviso.code)).toEqual(expect.arrayContaining(["meal-kcal-high", "meal-macros-mismatch", "ingredient-quantity-aceite"]));
  });

  it("no molesta con una comida normal", () => {
    expect(detectarAnomaliasComida({ kcal: 620, proteinas: 42, carbohidratos: 58, grasas: 24 })).toEqual([]);
  });

  it("detecta ingredientes duplicados y grasas de cocinado improbables", () => {
    const aceite = { nombre: "AOVE", cantidad: "20 g", kcal: 180, proteinas: 0, carbohidratos: 0, grasas: 20 };
    const avisos = detectarAnomaliasComida({ kcal: 360, proteinas: 0, carbohidratos: 0, grasas: 40, items: [aceite, aceite] });
    expect(avisos.map((aviso) => aviso.code)).toEqual(expect.arrayContaining(["ingredient-duplicate-aove", "cooking-fat-high"]));
  });

  it("detecta un salto de peso improbable en pocos días", () => {
    const avisos = detectarAnomaliasMedicion({
      measurement: { fecha: "2026-09-02", peso: 101 },
      reference: { fecha: "2026-08-31", peso: 95.3 },
    });

    expect(avisos.some((aviso) => aviso.code === "weight-jump")).toBe(true);
  });

  it("acepta variaciones ordinarias", () => {
    expect(detectarAnomaliasMedicion({
      measurement: { fecha: "2026-09-02", peso: 95.1, grasaPct: 23, aguaPct: 54 },
      reference: { fecha: "2026-08-31", peso: 95.3 },
    })).toEqual([]);
  });
});
