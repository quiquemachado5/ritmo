interface WindowState { expiresAt: number; count: number }

const windows = new Map<string, WindowState>();
const MAX_WINDOWS = 2_000;

/** Límite defensivo por instancia; complementa, no sustituye, cuotas de BD. */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = windows.get(key);
  if (!current || now >= current.expiresAt) {
    windows.delete(key);
    if (windows.size >= MAX_WINDOWS) {
      for (const [storedKey, value] of windows) if (now >= value.expiresAt) windows.delete(storedKey);
    }
    if (windows.size >= MAX_WINDOWS) return false;
    windows.set(key, { expiresAt: now + windowMs, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}

export function resetRateLimitsForTests() { windows.clear(); }
