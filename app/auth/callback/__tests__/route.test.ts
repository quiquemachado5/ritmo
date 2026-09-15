import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, createClient } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "../route";

describe("retorno seguro de autenticación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession } });
  });

  it("canjea PKCE y vuelve al destino con cabeceras privadas", async () => {
    const response = await GET(new Request("https://ritmo.test/auth/callback?code=synthetic-code&sb_flow_id=synthetic-flow&next=%2Frecuperar-contrasena"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("synthetic-code", { flowId: "synthetic-flow" });
    expect(response.headers.get("location")).toBe("https://ritmo.test/recuperar-contrasena");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it.each(["https://outside.test", "//outside.test", "/\\outside.test", "/\n/outside.test"])("bloquea destino externo: %j", async (next) => {
    const response = await GET(new Request(`https://ritmo.test/auth/callback?code=fixture&next=${encodeURIComponent(next)}`));
    expect(response.headers.get("location")).toBe("https://ritmo.test/");
  });

  it("vuelve al acceso sin filtrar un código rechazado", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    const response = await GET(new Request("https://ritmo.test/auth/callback?code=expired-fixture"));
    expect(response.headers.get("location")).toBe("https://ritmo.test/login");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("tolera una caída del proveedor y la ausencia de código", async () => {
    createClient.mockRejectedValue(new Error("unavailable"));
    expect((await GET(new Request("https://ritmo.test/auth/callback?code=fixture"))).headers.get("location")).toBe("https://ritmo.test/login");
    createClient.mockClear();
    expect((await GET(new Request("https://ritmo.test/auth/callback"))).headers.get("location")).toBe("https://ritmo.test/login");
    expect(createClient).not.toHaveBeenCalled();
  });
});
