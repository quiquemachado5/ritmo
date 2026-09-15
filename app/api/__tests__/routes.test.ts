import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import versions from "@/config/versions.json";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const { getUser, rpc, createClient, gemini, edamam, claimNutrition } = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), createClient: vi.fn(), gemini: vi.fn(), edamam: vi.fn(), claimNutrition: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/nutrition/gemini", () => ({ analizarConGemini: gemini }));
vi.mock("@/lib/nutrition/edamam", () => ({ analizarConEdamam: edamam }));
vi.mock("@/lib/nutrition/budget", () => ({ claimNutrition, finishNutrition: vi.fn() }));
vi.mock("@/lib/observability", () => ({ registrarDiagnostico: vi.fn() }));

import { GET as health } from "../health/route";
import { POST as nutrition } from "../nutricion/route";
import { POST as diagnostic } from "../diagnostico/route";

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://ritmo.test/api/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", origin: "https://ritmo.test", ...headers },
    body: JSON.stringify(body),
  });
}
const event = { evento: "sync", estado: "warning", build: "test", ruta: "hoy", navegador: "safari" };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  vi.stubEnv("NEXT_PUBLIC_RITMO_BUILD_ID", "fixture-build");
  createClient.mockResolvedValue({ auth: { getUser }, rpc });
  getUser.mockResolvedValue({ data: { user: { id: "synthetic-user" } }, error: null });
  rpc.mockImplementation(async (name) => ({ error: null, data: name === "ritmo_public_config"
    ? { features: { nutrition_engine: true } }
    : name === "ritmo_public_runtime_status" ? { databaseVersion: versions.databaseMigration, nutritionEngine: true } : null }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("estado público verificable", () => {
  it("confirma esquema y estado del motor con la versión del build", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", build: "fixture-build", database: "ready", nutrition: "ready" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("conserva una pausa intencional sin presentarla como fallo de infraestructura", async () => {
    rpc.mockResolvedValue({ error: null, data: { databaseVersion: versions.databaseMigration, nutritionEngine: false } });
    const response = await health();
    expect(response.status).toBe(200);
    expect((await response.json()).nutrition).toBe("paused");
  });

  it.each([
    [{ error: { code: "NETWORK" }, data: null }, "unavailable", "unknown"],
    [{ error: null, data: null }, "unavailable", "unknown"],
    [{ error: null, data: { databaseVersion: "outdated", nutritionEngine: false } }, "migration-required", "paused"],
    [{ error: null, data: { databaseVersion: versions.databaseMigration } }, "ready", "unknown"],
  ])("no declara saludable una respuesta incompleta o fallida: %j", async (result, database, nutrition) => {
    rpc.mockResolvedValue(result);
    const response = await health();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "degraded", database, nutrition });
  });

  it("no expone información interna al fallar el servicio", async () => {
    createClient.mockRejectedValue(new Error("sensitive-internal-error"));
    const response = await health();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive-internal-error");
  });
});

describe("API nutricional protegida", () => {
  it("rechaza orígenes externos antes de consultar servicios", async () => {
    expect((await nutrition(request("nutricion", { texto: "100 g de pan" }, { origin: "https://outside.test" }))).status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("exige JSON real y sesión validada", async () => {
    expect((await nutrition(request("nutricion", { texto: "pan" }, { "Content-Type": "application/json-evil" }))).status).toBe(415);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await nutrition(request("nutricion", { texto: "pan" }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { error: null, data: { features: { nutrition_engine: false } } },
    { error: { code: "NETWORK" }, data: null },
    { error: null, data: { features: {} } },
  ])("respeta la pausa aunque el control no esté disponible: %j", async (result) => {
    rpc.mockResolvedValue(result);
    expect((await nutrition(request("nutricion", { texto: "100 g de pan" }))).status).toBe(503);
    expect(gemini).not.toHaveBeenCalled();
    expect(edamam).not.toHaveBeenCalled();
  });

  it("limita el cuerpo leído y valida el texto", async () => {
    expect((await nutrition(request("nutricion", { texto: "x".repeat(24_001) }))).status).toBe(413);
    expect((await nutrition(request("nutricion", { texto: " " }))).status).toBe(400);
    expect((await nutrition(request("nutricion", null))).status).toBe(400);
  });

  it("responde en local y mantiene bloqueado todo proveedor externo", async () => {
    const response = await nutrition(request("nutricion", { texto: "100 g de pan" }));
    expect(response.status).toBe(200);
    expect((await response.json()).fuente).toBe("offline");
    expect(response.headers.get("cache-control")).toContain("no-store");
    await nutrition(request("nutricion", { texto: "plato desconocido" }));
    expect(gemini).not.toHaveBeenCalled();
    expect(edamam).not.toHaveBeenCalled();
    expect(claimNutrition).not.toHaveBeenCalled();
  });

  it("frena ráfagas por usuario e indica cuándo volver a intentarlo", async () => {
    for (let i = 0; i < 30; i++) expect((await nutrition(request("nutricion", { texto: "100 g de pan" }))).status).toBe(200);
    const limited = await nutrition(request("nutricion", { texto: "100 g de pan" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    getUser.mockResolvedValue({ data: { user: { id: "another-synthetic-user" } }, error: null });
    expect((await nutrition(request("nutricion", { texto: "100 g de pan" }))).status).toBe(200);
  });
});

describe("diagnóstico privado y fiable", () => {
  it("solo envía las categorías permitidas, sin campos libres", async () => {
    const response = await diagnostic(request("diagnostico", { ...event, email: "private@example.test", detalle: "private-weight" }));
    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("ritmo_record_health_event", {
      p_event: "sync", p_state: "warning", p_build: "test", p_route: "hoy", p_browser: "safari",
    });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private");
  });

  it("rechaza tipos que se convierten engañosamente a una categoría", async () => {
    expect((await diagnostic(request("diagnostico", { ...event, evento: ["sync"] }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exige origen propio, JSON y sesión", async () => {
    expect((await diagnostic(request("diagnostico", event, { origin: "" }))).status).toBe(403);
    expect((await diagnostic(request("diagnostico", event, { "Content-Type": "text/plain" }))).status).toBe(415);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await diagnostic(request("diagnostico", event))).status).toBe(401);
  });

  it("distingue un cuerpo excesivo de un servicio que falla", async () => {
    expect((await diagnostic(request("diagnostico", { ...event, detalle: "x".repeat(512) }))).status).toBe(413);
    rpc.mockResolvedValue({ error: { code: "NETWORK" }, data: null });
    const failed = await diagnostic(request("diagnostico", event));
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toContain("no-store");
  });

  it("guarda métricas reales acotadas sin identidad ni contenido personal", async () => {
    const response = await diagnostic(request("diagnostico", {
      evento: "performance", metrica: "LCP", valor: 1842.125, valoracion: "good",
      ruta: "progreso", dispositivo: "mobile", navegacion: "navigate", build: "test",
      email: "private@example.test", texto: "cena privada",
    }));
    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("ritmo_record_web_vital", {
      p_metric: "LCP", p_value: 1842.125, p_rating: "good", p_route: "progreso",
      p_device: "mobile", p_navigation_type: "navigate", p_build: "test",
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("private");
  });

  it("propaga el límite distribuido del servidor", async () => {
    rpc.mockResolvedValue({ error: null, data: false });
    const limited = await diagnostic(request("diagnostico", event));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
