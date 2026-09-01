/**
 * Diagnóstico mínimo y privado de RITMO.
 * No guarda correo, comida, peso ni ningún identificador: sólo eventos técnicos
 * recientes para poder entender un fallo de autenticación, sincronización o IA.
 */

export type EventoDiagnostico = "auth" | "sync" | "nutrition" | "import" | "ui";
export type EstadoDiagnostico = "ok" | "warning" | "error";

export interface Diagnostico {
  at: string;
  evento: EventoDiagnostico;
  estado: EstadoDiagnostico;
  detalle?: string;
}

const KEY = "ritmo:diagnostico";
const LIMITE = 40;

function limpio(detalle?: unknown): string | undefined {
  if (typeof detalle !== "string") return undefined;
  return detalle.replace(/[\r\n]+/g, " ").slice(0, 120) || undefined;
}

export function registrarDiagnostico(evento: EventoDiagnostico, estado: EstadoDiagnostico, detalle?: unknown): void {
  const dato: Diagnostico = { at: new Date().toISOString(), evento, estado, detalle: limpio(detalle) };
  // En Vercel queda disponible como log estructurado; en cliente se conserva
  // una pequeña traza local, sin salir del dispositivo.
  if (typeof window === "undefined") {
    console[estado === "error" ? "error" : "info"]("[ritmo]", JSON.stringify(dato));
    return;
  }
  try {
    const prev = leerDiagnostico();
    localStorage.setItem(KEY, JSON.stringify([...prev, dato].slice(-LIMITE)));
  } catch {
    // La observabilidad nunca debe interferir con el registro de salud.
  }
}

export function leerDiagnostico(): Diagnostico[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const datos = raw ? JSON.parse(raw) : [];
    return Array.isArray(datos) ? datos.filter((d): d is Diagnostico => d && typeof d.at === "string" && typeof d.evento === "string" && typeof d.estado === "string") : [];
  } catch {
    return [];
  }
}

export function limpiarDiagnostico(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
