export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) return { valid: false, error: "El correo es requerido." };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Ingresa un correo válido." };
  }

  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password) {
    errors.push("La contraseña es requerida.");
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push("Mínimo 8 caracteres.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Incluye al menos una mayúscula.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Incluye al menos un número.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getPasswordStrength(password: string): {
  score: number;
  percent: number;
  level: "débil" | "regular" | "buena" | "fuerte";
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*]/.test(password)) score++;

  const levels: Array<"débil" | "regular" | "buena" | "fuerte"> = ["débil", "regular", "buena", "fuerte"];
  const colors = ["bg-destructive", "bg-warning", "bg-water", "bg-weight"];

  const level = score <= 2 ? 0 : score <= 4 ? 1 : score <= 5 ? 2 : 3;

  return {
    score,
    percent: Math.round((score / 6) * 100),
    level: levels[level],
    color: colors[level],
  };
}

/** Rate limiting simple (en memoria). */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts = 5;
  private windowMs = 15 * 60 * 1000; // 15 minutos

  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remover intentos fuera de la ventana
    const recent = attempts.filter(time => now - time < this.windowMs);

    if (recent.length >= this.maxAttempts) {
      const oldestAttempt = recent[0];
      const resetIn = this.windowMs - (now - oldestAttempt);
      return { allowed: false, remaining: 0, resetIn };
    }

    recent.push(now);
    this.attempts.set(key, recent);

    return {
      allowed: true,
      remaining: this.maxAttempts - recent.length,
      resetIn: 0,
    };
  }
}

export const loginRateLimiter = new RateLimiter();
