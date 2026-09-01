import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "../validation";

describe("indicador de contraseña", () => {
  it("nunca supera el ancho completo", () => {
    expect(getPasswordStrength("MuySegura123!").percent).toBe(100);
  });

  it("usa colores semánticos del sistema de diseño", () => {
    expect(getPasswordStrength("abc").color).toBe("bg-destructive");
    expect(getPasswordStrength("MuySegura123!").color).toBe("bg-weight");
  });
});
