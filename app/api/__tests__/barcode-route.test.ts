import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const { createClient, getUser } = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "../nutricion/codigo/route";

function request(code: unknown, origin = "https://ritmo.test") {
  return new Request("https://ritmo.test/api/nutricion/codigo", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify({ code }),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetRateLimitsForTests();
  createClient.mockResolvedValue({ auth: { getUser } });
  getUser.mockResolvedValue({ data: { user: { id: "barcode-user" } }, error: null });
});

describe("API de códigos de barras", () => {
  it("valida origen, sesión y formato antes de consultar al proveedor", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request("3017620422003", "https://outside.test"))).status).toBe(403);
    expect((await POST(request("abc"))).status).toBe(400);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request("3017620422003"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve un producto acotado y se identifica ante Open Food Facts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ product: {
      code: "8412345678901", product_name: "Yogur natural", brands: "Ejemplo", serving_quantity: 125,
      nutriments: { "energy-kcal_100g": 62, proteins_100g: 4.1, carbohydrates_100g: 4.7, fat_100g: 3 },
    } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request("8412345678901"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ product: { name: "Yogur natural", servingGrams: 125, per100g: { kcal: 62 } } });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v3.2/product/8412345678901.json"), expect.objectContaining({
      headers: expect.objectContaining({ "User-Agent": expect.stringContaining("RITMO/1.0") }),
    }));
  });

  it("distingue un producto ausente de una ficha nutricional incompleta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json({ product: { code: "8422222222222", product_name: "Sin tabla", nutriments: {} } })));
    expect((await POST(request("8433333333333"))).status).toBe(404);
    expect((await POST(request("8422222222222"))).status).toBe(404);
  });
});
