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
});
