import { beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimitsForTests } from "../rate-limit";

describe("rate limit", () => {
  beforeEach(resetRateLimitsForTests);
  it("limita por clave y vuelve a abrir una ventana vencida", () => {
    expect(consumeRateLimit("a", 2, 1_000, 0)).toBe(true);
    expect(consumeRateLimit("a", 2, 1_000, 100)).toBe(true);
    expect(consumeRateLimit("a", 2, 1_000, 200)).toBe(false);
    expect(consumeRateLimit("b", 2, 1_000, 200)).toBe(true);
    expect(consumeRateLimit("a", 2, 1_000, 1_000)).toBe(true);
  });

  it("acota la memoria sin borrar ventanas activas de otra duración", () => {
    expect(consumeRateLimit("larga", 1, 10_000, 0)).toBe(true);
    for (let i = 0; i < 1_999; i++) expect(consumeRateLimit(`corta:${i}`, 1, 1_000, 0)).toBe(true);
    expect(consumeRateLimit("sin-espacio", 1, 1_000, 100)).toBe(false);
    expect(consumeRateLimit("recuperada", 1, 1_000, 1_000)).toBe(true);
    expect(consumeRateLimit("larga", 1, 10_000, 1_000)).toBe(false);
    expect(consumeRateLimit("larga", 1, 10_000, 10_000)).toBe(true);
  });
});
