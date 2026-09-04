import { expect, it } from "vitest";
import { readBoundedJson, origenPermitido } from "../http";
it("valida el dominio público detrás del proxy sin abrir orígenes arbitrarios", () => {
  expect(origenPermitido(new Request("http://internal/api", { headers: { origin: "https://ritmo.test" } }), "https://ritmo.test")).toBe(true);
  expect(origenPermitido(new Request("http://internal/api", { headers: { origin: "https://evil.test" } }), "https://ritmo.test")).toBe(false);
});
it("limita los bytes reales del cuerpo, no solo el Content-Length", async () => {
  await expect(readBoundedJson(new Request("https://example.test", { method: "POST", body: JSON.stringify({ texto: "á".repeat(1000) }) }), 100)).rejects.toThrow("payload_too_large");
  await expect(readBoundedJson(new Request("https://example.test", { method: "POST", body: '{"ok":true}' }), 100)).resolves.toEqual({ ok: true });
});
