import { createClient } from "@/lib/supabase/server";
import { readBoundedJson, origenPermitido } from "@/lib/http";
import { consumeRateLimit } from "@/lib/rate-limit";

const RUTAS = new Set(["hoy", "progreso", "nutricion", "habitos", "ajustes", "login", "registro", "onboarding", "minimo", "calendario", "cuerpo", "offline", "auth", "otra"]);
const NAVEGADORES = new Set(["chrome", "safari", "firefox", "edge", "otro"]);
const response = (status: number) => new Response(null, { status, headers: {
  "Cache-Control": "private, no-store",
  ...(status === 429 ? { "Retry-After": "60" } : {}),
} });

export async function POST(request: Request) {
  if (!request.headers.get("origin") || !origenPermitido(request)) return response(403);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return response(415);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response(401);
    if (!consumeRateLimit(`diagnostico:${user.id}`, 20, 60_000)) return response(429);
    let dato: Record<string, unknown>;
    try { dato = await readBoundedJson(request, 512) as Record<string, unknown>; }
    catch (error) { return response(error instanceof Error && error.message === "payload_too_large" ? 413 : 400); }
    if (dato?.evento === "performance") {
      const metric = typeof dato.metrica === "string" && ["CLS", "FCP", "INP", "LCP", "TTFB"].includes(dato.metrica) ? dato.metrica : null;
      const value = typeof dato.valor === "number" && Number.isFinite(dato.valor) && dato.valor >= 0 && dato.valor <= 600000 ? dato.valor : null;
      const rating = typeof dato.valoracion === "string" && ["good", "needs-improvement", "poor"].includes(dato.valoracion) ? dato.valoracion : null;
      const device = typeof dato.dispositivo === "string" && ["mobile", "tablet", "desktop"].includes(dato.dispositivo) ? dato.dispositivo : null;
      const navigation = typeof dato.navegacion === "string" && /^[a-z-]{1,24}$/.test(dato.navegacion) ? dato.navegacion : "other";
      if (!metric || value === null || !rating || !device) return response(400);
      const build = typeof dato.build === "string" && /^[a-zA-Z0-9.-]{1,20}$/.test(dato.build) ? dato.build : "unknown";
      const ruta = RUTAS.has(String(dato.ruta)) ? String(dato.ruta) : "otra";
      const { data, error } = await supabase.rpc("ritmo_record_web_vital", {
        p_metric: metric, p_value: value, p_rating: rating, p_route: ruta,
        p_device: device, p_navigation_type: navigation, p_build: build,
      });
      return response(error ? 503 : data === false ? 429 : 204);
    }
    if (!dato || typeof dato.evento !== "string" || typeof dato.estado !== "string" || !["auth", "sync", "nutrition", "import", "ui"].includes(dato.evento) || !["warning", "error"].includes(dato.estado)) return response(400);
    const build = typeof dato.build === "string" && /^[a-zA-Z0-9.-]{1,20}$/.test(dato.build) ? dato.build : "unknown";
    const ruta = RUTAS.has(String(dato.ruta)) ? String(dato.ruta) : "otra";
    const navegador = NAVEGADORES.has(String(dato.navegador)) ? String(dato.navegador) : "otro";
    // Sin correo, identificador de cuenta, payload, URL ni descripción de comida.
    console.warn("[ritmo-client]", JSON.stringify({ evento: dato.evento, estado: dato.estado, build, ruta, navegador }));
    const { data, error } = await supabase.rpc("ritmo_record_health_event", { p_event: dato.evento, p_state: dato.estado, p_build: build, p_route: ruta, p_browser: navegador });
    return response(error ? 503 : data === false ? 429 : 204);
  } catch { return response(503); }
}
