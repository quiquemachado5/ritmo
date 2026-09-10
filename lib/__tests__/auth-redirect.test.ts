import { describe, expect, it } from "vitest";
import { rutaInternaSegura, urlRecuperacionConCallback } from "../auth-redirect";

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

describe("recuperación de contraseña", () => {
  it("pasa siempre por el callback que crea la sesión PKCE", () => {
    expect(urlRecuperacionConCallback("https://ritmo.test")).toBe("https://ritmo.test/auth/callback?next=%2Frecuperar-contrasena");
  });
});
