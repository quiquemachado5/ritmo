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
let usuario: string | null = null;
const enviados = new Map<string, number>();
const metricasEnviadas = new Set<string>();
export function configurarDiagnosticoUsuario(userId: string | null) { usuario = userId; enviados.clear(); metricasEnviadas.clear(); }
export function diagnosticoCompartido(userId: string | null): boolean {
  try { return Boolean(userId && localStorage.getItem(`ritmo:diagnostico-consent:${userId}`) === "true"); } catch { return false; }
}
export function permitirDiagnostico(userId: string | null, enabled: boolean) {
  if (!userId) return;
  try { localStorage.setItem(`ritmo:diagnostico-consent:${userId}`, String(enabled)); } catch {}
}

function limpio(detalle?: unknown): string | undefined {
  if (typeof detalle !== "string") return undefined;
  return detalle.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[correo]").replace(/(?:https?:\/\/|Bearer\s+)[^\s]+/gi, "[oculto]").replace(/[A-Za-z0-9_-]{32,}/g, "[oculto]").replace(/[\r\n]+/g, " ").slice(0, 120) || undefined;
}

const RUTAS = ["progreso", "nutricion", "habitos", "ajustes", "login", "registro", "onboarding", "minimo", "calendario", "cuerpo", "offline"];
export function rutaDiagnostica(pathname: string): string {
  if (pathname === "/") return "hoy";
  const segmento = pathname.split("/").filter(Boolean)[0] || "hoy";
  return RUTAS.includes(segmento) ? segmento : segmento === "auth" ? "auth" : "otra";
}
export function navegadorDiagnostico(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return "edge";
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent)) return "safari";
  return "otro";
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
  // El detalle libre nunca sale del dispositivo. Agrupamos por tipo y versión.
  const key = `${evento}:${estado}`;
  if (estado !== "ok" && diagnosticoCompartido(usuario) && Date.now() - (enviados.get(key) ?? 0) > 60000) {
    enviados.set(key, Date.now());
    void fetch("/api/diagnostico", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento,
        estado,
        build: process.env.NEXT_PUBLIC_RITMO_BUILD_ID || "dev",
        ruta: rutaDiagnostica(window.location.pathname),
        navegador: navegadorDiagnostico(window.navigator.userAgent),
      }),
      keepalive: true,
    }).catch(() => {});
  }
}

type MetricaWeb = {
  id?: string;
  name: string;
  value: number;
  rating?: "good" | "needs-improvement" | "poor";
  navigationType?: string;
};

/** Métricas reales de carga sin URL completa, identidad, texto ni contenido de
 * salud. Solo salen del dispositivo cuando la persona activó el diagnóstico. */
export function registrarRendimiento(metric: MetricaWeb): void {
  if (typeof window === "undefined" || !usuario || !diagnosticoCompartido(usuario)) return;
  if (!["CLS", "FCP", "INP", "LCP", "TTFB"].includes(metric.name) || !Number.isFinite(metric.value) || metric.value < 0) return;
  const key = `${metric.id || metric.name}:${rutaDiagnostica(window.location.pathname)}`;
  if (metricasEnviadas.has(key)) return;
  metricasEnviadas.add(key);
  const width = window.innerWidth;
  void fetch("/api/diagnostico", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evento: "performance",
      metrica: metric.name,
      valor: Math.round(metric.value * 1000) / 1000,
      valoracion: metric.rating || "needs-improvement",
      navegacion: (metric.navigationType || "other").slice(0, 24),
      ruta: rutaDiagnostica(window.location.pathname),
      dispositivo: width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop",
      build: process.env.NEXT_PUBLIC_RITMO_BUILD_ID || "dev",
    }),
    keepalive: true,
  }).catch(() => {});
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
