import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("respaldo de modelos Gemini", () => {
  it("prueba 3.5 Flash cuando 3.7 está saturado", async () => {
    vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
    vi.stubEnv("GEMINI_NUTRITION_MODEL", "");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          items: [{ nombre: "Arroz", cantidad: "100 g", cantidadEstimada: false, kcal: 130, proteinas: 3, carbohidratos: 28, grasas: 0.3 }],
          confianza: "alta",
          observaciones: [],
        }) }] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { analizarConGemini } = await import("../gemini");
    const resultado = await analizarConGemini("100 g de arroz");

    expect(resultado?.fuente).toBe("gemini");
    expect(resultado?.kcal).toBe(130);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-3.7-flash");
    expect(String(fetchMock.mock.calls[1][0])).toContain("gemini-3.5-flash");
  });
});
