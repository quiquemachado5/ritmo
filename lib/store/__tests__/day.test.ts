import { describe, expect, it } from "vitest";
import { recalcularKcalComidas, sumaKcalComidas } from "../day";
import type { Comida, Dia } from "@/lib/model/types";

function comida(id: string, kcal: number): Comida {
  return { id, tipo: "comida", texto: id, kcal, proteinas: 0, carbohidratos: 0, grasas: 0 };
}

describe("consistencia de calorías por comidas", () => {
  it("suma todas las comidas registradas", () => {
    expect(sumaKcalComidas([comida("a", 320), comida("b", 481)])).toBe(801);
  });

  it("elimina el total antiguo al borrar la última comida", () => {
    const dia: Dia = { fecha: "2026-09-01", habitos: {}, comidas: [], kcalConsumidas: 740 };
    expect(recalcularKcalComidas(dia, true)).toEqual({ fecha: "2026-09-01", habitos: {} });
  });

  it("no toca un total manual en una actualización ajena a comidas", () => {
    const dia: Dia = { fecha: "2026-09-01", habitos: {}, kcalConsumidas: 740 };
    expect(recalcularKcalComidas(dia, false).kcalConsumidas).toBe(740);
  });
});
