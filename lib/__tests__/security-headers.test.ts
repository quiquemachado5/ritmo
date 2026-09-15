import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../../next.config";
import { contentSecurityPolicy } from "../security-policy";

afterEach(() => vi.unstubAllEnvs());

async function cabeceras(url: string) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  const reglas = await config.headers!();
  return new Headers(reglas[0].headers.map(({ key, value }): [string, string] => [key, value]));
}

describe("cabeceras de la compilación de producción", () => {
  it("mantiene HTTPS obligatorio y política de scripts en dominios públicos", async () => {
    const headers = await cabeceras("https://ritmo.example");
    const policy = contentSecurityPolicy("nonce-prueba", { development: false, appUrl: "https://ritmo.example", supabaseUrl: "https://example.supabase.co" });
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("'nonce-nonce-prueba' 'strict-dynamic'");
    expect(headers.get("strict-transport-security")).toContain("max-age=31536000");
  });
  it.each(["http://127.0.0.1:3101", "http://localhost:3101", "http://[::1]:3101"])("permite probar %s sin inventar TLS", async url => {
    const headers = await cabeceras(url);
    const policy = contentSecurityPolicy("local", { development: false, appUrl: url, supabaseUrl: "https://example.supabase.co" });
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(headers.has("strict-transport-security")).toBe(false);
  });
  it("no aplica la excepción de loopback a un dominio público HTTP", async () => {
    await cabeceras("http://ritmo.example");
    const policy = contentSecurityPolicy("publico", { development: false, appUrl: "http://ritmo.example", supabaseUrl: "https://example.supabase.co" });
    expect(policy).toContain("upgrade-insecure-requests");
  });
});
