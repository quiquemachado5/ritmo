import { describe, expect, it } from "vitest";
import { calidadIngredientes } from "../ingredient-quality";
import type { ItemNutricional } from "../types";

function item(nombre: string, kcal: number, exacto: boolean): ItemNutricional {
  return {
    nombre,
    kcal,
    proteinas: 0,
    carbohidratos: 0,
    grasas: 0,
    gramos: 100,
    cantidadEstimada: !exacto,
    tipoCantidad: exacto ? "masa_declarada" : "porcion_supuesta",
  };
}

describe("calidad por ingrediente", () => {
  it("pondera la incertidumbre por impacto energético", () => {
    const calidad = calidadIngredientes([
      item("Pechuga de pollo", 240, true),
      item("Lechuga", 15, false),
      item("Aceite de oliva", 90, false),
    ]);
    expect(calidad.porcentajeAproximado).toBe(30);
    expect(calidad.nivel).toBe("media");
    expect(calidad.prioridades[0]).toMatchObject({ nombre: "Aceite de oliva", kcal: 90 });
  });

  it("considera alta una comida con todas las masas declaradas", () => {
    expect(calidadIngredientes([item("Salmón", 375, true)]).nivel).toBe("alta");
  });

  it("señala como baja una comida dominada por porciones supuestas", () => {
    const calidad = calidadIngredientes([item("Hamburguesa", 300, false), item("Tomate", 20, true)]);
    expect(calidad.nivel).toBe("baja");
    expect(calidad.porcentajeAproximado).toBe(94);
  });
});
