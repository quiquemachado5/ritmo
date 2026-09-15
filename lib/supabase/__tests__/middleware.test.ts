import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser, createServerClient } = vi.hoisted(() => ({ getUser: vi.fn(), createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("../env", () => ({ SUPABASE_URL: "https://supabase.test", SUPABASE_ANON_KEY: "public-fixture" }));

import { updateSession } from "../middleware";

const cacheHeaders = { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", "Pragma": "no-cache", "Expires": "0" };

function authenticate(user: { id: string } | null, refresh = false) {
  createServerClient.mockImplementation((_url, _key, options) => {
    getUser.mockImplementation(async () => {
      if (refresh) options.cookies.setAll([{ name: "session-fixture", value: user ? "renewed" : "", options: { path: "/", maxAge: user ? 3600 : 0 } }], cacheHeaders);
      return { data: { user }, error: null };
    });
    return { auth: { getUser } };
  });
}

describe("protección de sesión en el proxy", () => {
  beforeEach(() => { vi.clearAllMocks(); authenticate(null); });

  it("conserva la ruta completa al pedir autenticación", async () => {
    const response = await updateSession(new NextRequest("https://ritmo.test/progreso?periodo=30"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect([...destination.searchParams.keys()]).toEqual(["next"]);
    expect(destination.searchParams.get("next")).toBe("/progreso?periodo=30");
  });

  it("devuelve 401 JSON a una API sin sesión", async () => {
    const response = await updateSession(new NextRequest("https://ritmo.test/api/nutricion"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("propaga las cabeceras anti-caché al renovar una sesión", async () => {
    authenticate({ id: "fixture" }, true);
    const response = await updateSession(new NextRequest("https://ritmo.test/progreso"));
    expect(response.cookies.get("session-fixture")?.value).toBe("renewed");
    for (const [name, value] of Object.entries(cacheHeaders)) expect(response.headers.get(name)).toBe(value);
  });

  it.each(["/progreso", "/api/nutricion"])("conserva la eliminación de cookies al denegar %s", async (path) => {
    authenticate(null, true);
    const response = await updateSession(new NextRequest(`https://ritmo.test${path}`));
    expect(response.cookies.get("session-fixture")?.maxAge).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("conserva cookies renovadas y el destino válido de un usuario autenticado", async () => {
    authenticate({ id: "fixture" }, true);
    const response = await updateSession(new NextRequest("https://ritmo.test/login?next=%2Fprogreso%3Fperiodo%3D30"));
    expect(response.headers.get("location")).toBe("https://ritmo.test/progreso?periodo=30");
    expect(response.cookies.get("session-fixture")?.value).toBe("renewed");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("bloquea retornos externos también cuando ya existe sesión", async () => {
    authenticate({ id: "fixture" });
    const response = await updateSession(new NextRequest("https://ritmo.test/login?next=%2F%5Cevil.test"));
    expect(response.headers.get("location")).toBe("https://ritmo.test/");
  });

  it.each(["/login", "/registro?next=/login", "/login/"])("evita bucles si el destino es %s", async (path) => {
    authenticate({ id: "fixture" });
    const response = await updateSession(new NextRequest(`https://ritmo.test/login?next=${encodeURIComponent(path)}`));
    expect(response.headers.get("location")).toBe("https://ritmo.test/");
  });

  it.each(["/api/health", "/offline", "/privacidad", "/sw.js"])("no consulta identidad para %s", async (path) => {
    await updateSession(new NextRequest(`https://ritmo.test${path}`));
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
