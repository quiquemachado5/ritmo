interface WindowState { start: number; count: number }

const windows = new Map<string, WindowState>();

/** Límite defensivo por instancia; complementa, no sustituye, cuotas de BD. */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = windows.get(key);
  if (!current || now - current.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 2_000) {
      for (const [storedKey, value] of windows) if (now - value.start >= windowMs) windows.delete(storedKey);
    }
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}

export function resetRateLimitsForTests() { windows.clear(); }
