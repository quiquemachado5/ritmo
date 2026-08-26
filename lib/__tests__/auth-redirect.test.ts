import { describe, expect, it } from "vitest";
import { rutaInternaSegura } from "../auth-redirect";

describe("rutaInternaSegura", () => {
  it("conserva únicamente destinos internos", () => {
    expect(rutaInternaSegura("/progreso")).toBe("/progreso");
    expect(rutaInternaSegura("/nutricion?dia=hoy")).toBe("/nutricion?dia=hoy");
  });

  it("descarta destinos externos o ambiguos", () => {
    expect(rutaInternaSegura("https://example.com")).toBe("/");
    expect(rutaInternaSegura("//example.com")).toBe("/");
    expect(rutaInternaSegura(null)).toBe("/");
  });
});
