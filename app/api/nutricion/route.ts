import { NextResponse } from "next/server";
import { estimarOffline } from "@/lib/nutrition/offline";
import type { AnalisisNutricional } from "@/lib/nutrition/types";
import { analizarConEdamam } from "@/lib/nutrition/edamam";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* Simple rate limiting: max 30 requests per minute per IP */
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recentRequests = timestamps.filter((t) => now - t < 60000);

  if (recentRequests.length >= 30) {
    return true;
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return false;
}

export async function POST(request: Request) {
  try {
    /* Rate limiting */
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
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

    /* Parse y validación */
    let texto = "";
    try {
      const body = (await request.json()) as { texto?: unknown };
      if (typeof body.texto !== "string") {
        throw new Error("texto debe ser string");
      }
      texto = body.texto.trim();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo inválido. Envía {\"texto\": \"...\"}" },
        { status: 400 }
      );
    }

    if (!texto) {
      return NextResponse.json({ error: "El texto no puede estar vacío" }, { status: 400 });
    }

    if (texto.length > 600) {
      return NextResponse.json(
        { error: "La descripción es demasiado larga (máximo 600 caracteres)" },
        { status: 400 }
      );
    }

    /* Análisis nutricional */
    let resultado: AnalisisNutricional | null = null;

    try {
      resultado = await analizarConEdamam(texto);
    } catch (error) {
      console.error("Edamam error:", error);
    }

    /* Sanidad check: comida > 4000 kcal probablemente sea un error */
    if (resultado && (resultado.kcal <= 0 || resultado.kcal > 4000)) {
      resultado = null;
    }

    /* Fallback offline */
    if (!resultado) {
      resultado = estimarOffline(texto);
      resultado.aviso = "Análisis sin conexión. Puedes editar los valores.";
    } else {
      resultado.aviso = "Estimado · puedes editarlo";
    }

    return NextResponse.json(resultado, {
      headers: {
        "Cache-Control": "no-cache, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("API nutricion error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
