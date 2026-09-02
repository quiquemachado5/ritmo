import { describe, expect, it } from "vitest";
import { descripcionNecesitaAnalisis, normalizarDescripcionComida } from "../prompt-state";

describe("estado del prompt nutricional", () => {
  it("permite guardar cuando la descripción sigue siendo la analizada", () => {
    expect(descripcionNecesitaAnalisis("pollo con arroz", "pollo con arroz", false)).toBe(false);
  });

  it("exige un nuevo análisis después de editar ingredientes o porciones", () => {
    expect(descripcionNecesitaAnalisis("pollo con arroz y 10 ml de AOVE", "pollo con arroz", false)).toBe(true);
    expect(descripcionNecesitaAnalisis("ensalada con atún", "ensalada", true)).toBe(true);
  });

  it("no confunde espacios de formato con un cambio nutricional", () => {
    expect(normalizarDescripcionComida("  pollo   con arroz  ")).toBe("pollo con arroz");
    expect(descripcionNecesitaAnalisis("pollo   con arroz", "pollo con arroz", false)).toBe(false);
  });
});

