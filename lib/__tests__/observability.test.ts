import { describe, expect, it } from "vitest";
import { navegadorDiagnostico, rutaDiagnostica } from "../observability";

describe("observabilidad privada", () => {
  it("reduce rutas a secciones sin enviar detalles", () => {
    expect(rutaDiagnostica("/progreso/detalle/privado")).toBe("progreso");
    expect(rutaDiagnostica("/")).toBe("hoy");
    expect(rutaDiagnostica("/cualquier-identificador-secreto")).toBe("otra");
  });
  it("clasifica el navegador sin conservar su versión ni user-agent", () => {
    expect(navegadorDiagnostico("Mozilla Chrome/126.0 Safari/537.36")).toBe("chrome");
    expect(navegadorDiagnostico("Mozilla Version/17.0 Safari/605.1.15")).toBe("safari");
    expect(navegadorDiagnostico("dato inesperado")).toBe("otro");
  });
});
