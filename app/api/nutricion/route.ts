import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { AnalisisNutricional, CorreccionNutricional } from "@/lib/nutrition/types";
import { analizarConEdamam } from "@/lib/nutrition/edamam";
import { analizarConGemini } from "@/lib/nutrition/gemini";
import { createClient } from "@/lib/supabase/server";
import { registrarDiagnostico } from "@/lib/observability";
import { claimNutrition, finishNutrition } from "@/lib/nutrition/budget";
import { readBoundedJson, origenPermitido } from "@/lib/http";
import { EXTERNAL_NUTRITION_ENABLED } from "@/lib/nutrition/policy";
import { analizarLocal } from "@/lib/nutrition/local";

export const runtime = "nodejs";
export const maxDuration = 60;
const running = new Map<string, Promise<AnalisisNutricional>>();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: {
  "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  ...(status === 429 ? { "Retry-After": "60" } : {}),
} });
function correccionesValidas(valor: unknown): CorreccionNutricional[] {
  if (!Array.isArray(valor)) return [];
  const numero = (dato: unknown, max: number) => {
    const n = Number(dato);
    return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : 0;
  };
  return valor.slice(0, 25).flatMap((dato) => {
    if (!dato || typeof dato !== "object") return [];
    const item = dato as Record<string, unknown>;
    const nombre = typeof item.nombre === "string" ? item.nombre.trim().slice(0, 80) : "";
    if (!nombre) return [];
    return [{
      clave: typeof item.clave === "string" ? item.clave.slice(0, 100) : nombre.toLocaleLowerCase("es-ES"),
      nombre,
      cantidad: typeof item.cantidad === "string" ? item.cantidad.trim().slice(0, 80) : undefined,
      cantidadEstimada: false,
      kcal: numero(item.kcal, 4_000),
      proteinas: numero(item.proteinas, 500),
      carbohidratos: numero(item.carbohidratos, 800),
      grasas: numero(item.grasas, 500),
      actualizada: numero(item.actualizada, Number.MAX_SAFE_INTEGER),
    } satisfies CorreccionNutricional];
  });
}


async function resolver(texto: string, correcciones: CorreccionNutricional[], userId: string, hash: string, local: AnalisisNutricional): Promise<AnalisisNutricional> {
  const claim = await claimNutrition(userId, hash);
  if (claim.status === "cached") return claim.result;
  if (claim.status === "busy") throw new Error("busy");
  let resultado: AnalisisNutricional | null = null;
  if (claim.status === "go") {
    try { resultado = await analizarConGemini(texto, correcciones); }
    catch { registrarDiagnostico("nutrition", "warning", "Gemini no disponible"); }
    if (!resultado) {
      try { resultado = await analizarConEdamam(texto); }
      catch { registrarDiagnostico("nutrition", "warning", "respaldo no disponible"); }
    }
  }
  if (resultado && (!Number.isFinite(resultado.kcal) || resultado.kcal <= 0 || resultado.kcal > 6000)) resultado = null;
  if (!resultado) {
    resultado = local;
    resultado.aviso = claim.status === "limited"
      ? "Se ha alcanzado la cuota de análisis online. Estimación local: revisa las cantidades."
      : "Análisis online no disponible. Estimación local orientativa: revisa ingredientes y cantidades.";
    registrarDiagnostico("nutrition", "warning", "estimación local");
  } else {
    resultado.aviso = "Estimación, no medición. Comprueba las cantidades señaladas antes de guardar.";
    registrarDiagnostico("nutrition", "ok", "análisis completado");
  }
  if (claim.status === "go") {
    try { await finishNutrition(userId, hash, claim.lease, resultado); }
    catch { registrarDiagnostico("nutrition", "warning", "caché no disponible"); }
  }
  return resultado;
}

export async function POST(request: Request) {
  try {
    if (!origenPermitido(request)) return json({ error: "Origen no permitido." }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return json({ error: "Envía el contenido como JSON." }, 415);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Inicia sesión de nuevo para analizar." }, 401);
    let body: { texto?: unknown; correcciones?: unknown };
    try { body = await readBoundedJson(request, 24000) as typeof body; }
    catch (error) { return json({ error: "La solicitud no es válida o supera el tamaño permitido." }, error instanceof Error && error.message === "payload_too_large" ? 413 : 400); }
    if (!body || typeof body.texto !== "string" || !body.texto.trim() || body.texto.length > 2500) return json({ error: "Describe la comida en un máximo de 2.500 caracteres." }, 400);
    const texto = body.texto.trim();
    const correcciones = correccionesValidas(body.correcciones);
    const local = analizarLocal(texto, correcciones);
    // Los ingredientes conocidos nunca dependen de una respuesta variable de IA.
    // Solo consultamos proveedores cuando queda texto alimentario sin interpretar.
    if (!local.noReconocidos?.length || !EXTERNAL_NUTRITION_ENABLED) return json(local);
    const hash = createHash("sha256").update("nutrition-v5").update(process.env.NEXT_PUBLIC_RITMO_BUILD_ID || "dev").update(process.env.GEMINI_NUTRITION_MODEL || "default").update(texto.toLowerCase().replace(/\s+/g, " ")).update(JSON.stringify(correcciones)).digest("hex");
    const key = user.id + ":" + hash;
    let task = running.get(key);
    if (!task) {
      task = resolver(texto, correcciones, user.id, hash, local).finally(() => running.delete(key));
      running.set(key, task);
    }
    return json(await task);
  } catch (error) {
    if (error instanceof Error && error.message === "busy") return json({ error: "Este plato ya se está analizando. Espera unos segundos y vuelve a intentarlo." }, 429);
    registrarDiagnostico("nutrition", "error", "análisis fallido");
    return json({ error: "No se pudo analizar. Tu descripción se conserva; inténtalo de nuevo." }, 500);
  }
}
