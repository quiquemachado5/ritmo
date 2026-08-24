import { NextResponse } from "next/server";
import { estimarOffline } from "@/lib/nutrition/offline";
import type { AnalisisNutricional } from "@/lib/nutrition/types";
import { analizarConEdamam } from "@/lib/nutrition/edamam";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // RITMO requiere sesión autenticada en Supabase
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let texto = "";
  try {
    const body = (await request.json()) as { texto?: string };
    texto = String(body.texto ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!texto) return NextResponse.json({ error: "Falta el texto de la comida" }, { status: 400 });
  if (texto.length > 600) texto = texto.slice(0, 600);

  // Flujo: Edamam → Offline fallback
  let resultado: AnalisisNutricional | null = null;

  // Intentar primero Edamam (API profesional con bases de datos reales)
  resultado = await analizarConEdamam(texto);

  // Si Edamam no funciona (sin credenciales, límite alcanzado, error), usar offline
  if (!resultado) {
    resultado = estimarOffline(texto);
    resultado.aviso = "Análisis sin conexión. Puedes editar los valores.";
  } else {
    // Edamam funcionó, pero siempre indicar que es estimado y editable
    resultado.aviso = "Estimado · puedes editarlo";
  }

  return NextResponse.json(resultado);
}
