import { createClient } from "@/lib/supabase/server";
import { readBoundedJson, origenPermitido } from "@/lib/http";
import { consumeRateLimit } from "@/lib/rate-limit";

const RUTAS = new Set(["hoy", "progreso", "nutricion", "habitos", "ajustes", "login", "registro", "onboarding", "minimo", "calendario", "cuerpo", "offline", "auth", "otra"]);
const NAVEGADORES = new Set(["chrome", "safari", "firefox", "edge", "otro"]);

export async function POST(request: Request) {
  if (!request.headers.get("origin") || !origenPermitido(request)) return new Response(null, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  if (!consumeRateLimit(`diagnostico:${user.id}`, 20, 60_000)) {
    return new Response(null, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  }
  try {
    const dato = await readBoundedJson(request, 512) as Record<string, unknown>;
    if (!dato || !["auth", "sync", "nutrition", "import", "ui"].includes(String(dato.evento)) || !["warning", "error"].includes(String(dato.estado))) return new Response(null, { status: 400 });
    const build = typeof dato.build === "string" && /^[a-zA-Z0-9.-]{1,20}$/.test(dato.build) ? dato.build : "unknown";
    const ruta = RUTAS.has(String(dato.ruta)) ? String(dato.ruta) : "otra";
    const navegador = NAVEGADORES.has(String(dato.navegador)) ? String(dato.navegador) : "otro";
    // Sin correo, identificador de cuenta, payload, URL ni descripción de comida.
    console.warn("[ritmo-client]", JSON.stringify({ evento: dato.evento, estado: dato.estado, build, ruta, navegador }));
    await supabase.rpc("ritmo_record_health_event", { p_event: dato.evento, p_state: dato.estado, p_build: build, p_route: ruta, p_browser: navegador });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 400 }); }
}
