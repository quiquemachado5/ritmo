import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { estimarOffline } from "@/lib/nutrition/offline";
import type { AnalisisNutricional, CorreccionNutricional } from "@/lib/nutrition/types";
import { analizarConEdamam } from "@/lib/nutrition/edamam";
import { analizarConGemini } from "@/lib/nutrition/gemini";
import { createClient } from "@/lib/supabase/server";
import { registrarDiagnostico } from "@/lib/observability";

export const runtime = "nodejs";

interface RateBucket { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateBucket>();
const nutritionCache = new Map<string, { resultado: AnalisisNutricional; expira: number }>();
const CACHE_MS = 10 * 60 * 1000;
const MAX_CACHE = 200;

function isRateLimited(key: string, limite: number): boolean {
  const now = Date.now();
  const actual = rateLimitMap.get(key);
  if (!actual || actual.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
  } else {
    actual.count++;
    if (actual.count > limite) return true;
  }
  if (rateLimitMap.size > 2_000) {
    for (const [bucketKey, bucket] of rateLimitMap) {
      if (bucket.resetAt <= now) rateLimitMap.delete(bucketKey);
    }
  }
  return false;
}

function claveCache(userId: string, texto: string): string {
  return createHash("sha256").update(userId).update("\0").update(texto).digest("hex");
}

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

export async function POST(request: Request) {
  try {
    /* Rate limiting */
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(`ip:${ip}`, 60)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta más tarde." },
        { status: 429 }
      );
    }

    /* Auth */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (isRateLimited(`user:${user.id}`, 30)) {
      return NextResponse.json(
        { error: "Has alcanzado el límite temporal de análisis. Prueba de nuevo en un minuto." },
        { status: 429 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "El contenido debe enviarse como JSON." }, { status: 415 });
    }

    /* Parse y validación */
    let texto = "";
    let correcciones: CorreccionNutricional[] = [];
    try {
      const body = (await request.json()) as { texto?: unknown; correcciones?: unknown };
      if (typeof body.texto !== "string") {
        throw new Error("texto debe ser string");
      }
      texto = body.texto.trim();
      correcciones = correccionesValidas(body.correcciones);
    } catch {
      return NextResponse.json(
        { error: "Cuerpo inválido. Envía {\"texto\": \"...\"}" },
        { status: 400 }
      );
    }

    if (!texto) {
      return NextResponse.json({ error: "El texto no puede estar vacío" }, { status: 400 });
    }

    if (texto.length > 2_500) {
      return NextResponse.json(
        { error: "La descripción es demasiado larga (máximo 2.500 caracteres)" },
        { status: 400 }
      );
    }

    /* Análisis nutricional. Reutilizamos una estimación reciente de la misma
     * descripción para no quemar cuota gratuita de Gemini al recalcular. */
    const normalizado = texto.toLocaleLowerCase("es-ES").replace(/\s+/g, " ");
    const cacheKey = claveCache(user.id, `${normalizado}\0${JSON.stringify(correcciones)}`);
    const guardado = nutritionCache.get(cacheKey);
    let resultado: AnalisisNutricional | null = guardado && guardado.expira > Date.now()
      ? structuredClone(guardado.resultado)
      : null;
    if (guardado && guardado.expira <= Date.now()) nutritionCache.delete(cacheKey);

    if (!resultado) {
      try {
        resultado = await analizarConGemini(texto, correcciones);
      } catch (error) {
        console.error("Gemini nutrición error:", error);
        registrarDiagnostico("nutrition", "warning", "Gemini no respondió; se usa respaldo");
      }

      if (!resultado) {
        try {
          resultado = await analizarConEdamam(texto);
        } catch (error) {
          console.error("Edamam error:", error);
          registrarDiagnostico("nutrition", "warning", "respaldo nutricional no disponible");
        }
      }
    }

    /* Admite platos largos o registros de una comida compartida; un resultado
     * fuera de este margen sí suele señalar una cantidad mal interpretada. */
    if (resultado && (resultado.kcal <= 0 || resultado.kcal > 6_000)) {
      resultado = null;
    }

    if (resultado && resultado.fuente !== "offline") {
      if (nutritionCache.size >= MAX_CACHE) {
        const primera = nutritionCache.keys().next().value;
        if (primera) nutritionCache.delete(primera);
      }
      nutritionCache.set(cacheKey, { resultado: structuredClone(resultado), expira: Date.now() + CACHE_MS });
    }

    /* Fallback offline */
    if (!resultado) {
      resultado = estimarOffline(texto);
      registrarDiagnostico("nutrition", "warning", "estimación local");
      resultado.aviso = "Estimación local aproximada. Puedes editar los valores.";
    } else {
      resultado.aviso = resultado.fuente === "gemini"
        ? `Gemini · confianza ${resultado.confianza ?? "media"}. Revisa solo las cantidades marcadas como estimadas.`
        : "Estimado · puedes editarlo";
    }

    if (resultado.fuente === "gemini") registrarDiagnostico("nutrition", "ok", "Gemini respondió");

    return NextResponse.json(resultado, {
      headers: {
        "Cache-Control": "no-cache, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("API nutricion error:", error);
    registrarDiagnostico("nutrition", "error", "error interno de nutrición");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
