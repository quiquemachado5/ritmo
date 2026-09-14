import { describe, expect, it } from "vitest";
import { aclaracionComida } from "../clarification";

describe("aclaraciones nutricionales de alto impacto", () => {
  it("pregunta si el peso de cereales o legumbres es crudo o cocinado", () => {
    expect(aclaracionComida("150 g de arroz con pollo")?.pregunta).toContain("crudo");
    expect(aclaracionComida("150 g de arroz cocido con pollo")).toBeNull();
  });

  it("prioriza aclarar una grasa sin cantidad", () => {
    expect(aclaracionComida("150 g de arroz con pollo y aceite")?.pregunta).toContain("aceite");
  });
});
