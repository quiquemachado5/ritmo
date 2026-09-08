import { describe, expect, it } from "vitest";
import { qualityForDay } from "../record-quality";
import type { Comida } from "../model/types";

const comida = (estimado = false): Comida => ({
  id: "c", tipo: "comida", texto: "100 g de arroz", kcal: 130,
  proteinas: 3, carbohidratos: 28, grasas: 0.3, estimado,
});

describe("calidad accionable del registro", () => {
  it("indica el dato concreto que desbloquea la siguiente mejora", () => {
    expect(qualityForDay([], 0, 6).detail).toContain("primer hábito");
    expect(qualityForDay([comida(true)], 3, 6).detail).toContain("confirma cantidades");
    expect(qualityForDay([comida(false)], 6, 6).detail).toContain("siguiente pesaje");
  });
});
