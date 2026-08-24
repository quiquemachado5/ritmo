import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { estimarOffline } from "@/lib/nutrition/offline";
import type { AnalisisNutricional, ItemNutricional } from "@/lib/nutrition/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODELO = process.env.RITMO_NUTRITION_MODEL || "claude-opus-5";

const SISTEMA = `Eres un nutricionista que estima el contenido nutricional de comidas descritas en lenguaje natural (español de España).

Dada la descripción de una comida, identifica cada alimento, estima su cantidad con porciones realistas cuando no se indiquen, y calcula kcal y macronutrientes.

Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin texto antes ni después, sin markdown, con esta forma exacta:
{
  "resumen": "descripción breve y limpia de la comida",
  "items": [
    { "nombre": "alimento y cantidad", "kcal": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0 }
  ]
}

Reglas:
- kcal en kilocalorías; proteinas, carbohidratos y grasas en gramos, todos números enteros.
- Sé realista con las porciones típicas españolas (una tostada ≈ 30 g, un café con leche ≈ 200 ml, un plato de pasta ≈ 80 g en seco, etc.).
- Si la descripción no contiene comida reconocible, devuelve "items": [].
- No incluyas totales: se calculan aparte.`;

function extraerJSON(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio === -1 || fin === -1) throw new Error("Sin JSON en la respuesta");
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

function sanear(items: unknown): ItemNutricional[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      const o = it as Record<string, unknown>;
      return {
        nombre: String(o.nombre ?? "").slice(0, 120),
        kcal: Math.max(0, Math.round(Number(o.kcal) || 0)),
        proteinas: Math.max(0, Math.round(Number(o.proteinas) || 0)),
        carbohidratos: Math.max(0, Math.round(Number(o.carbohidratos) || 0)),
        grasas: Math.max(0, Math.round(Number(o.grasas) || 0)),
      };
    })
    .filter((it) => it.nombre);
}

function totalizar(resumen: string, items: ItemNutricional[], fuente: AnalisisNutricional["fuente"]): AnalisisNutricional {
  const total = items.reduce(
    (a, it) => ({
      kcal: a.kcal + it.kcal,
      proteinas: a.proteinas + it.proteinas,
      carbohidratos: a.carbohidratos + it.carbohidratos,
      grasas: a.grasas + it.grasas,
    }),
    { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  );
  return { resumen, items, ...total, fuente };
}

export async function POST(request: Request) {
  // En modo nube exigimos sesión: la clave de IA es del servidor.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let texto = "";
  try {
    const body = (await request.json()) as { texto?: string };
    texto = String(body.texto ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!texto) return NextResponse.json({ error: "Falta el texto de la comida" }, { status: 400 });
  if (texto.length > 600) texto = texto.slice(0, 600);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(estimarOffline(texto));
  }

  try {
    const client = new Anthropic({ apiKey });
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 1200,
      output_config: { effort: "low" },
      system: SISTEMA,
      messages: [{ role: "user", content: texto }],
    });

    const bloque = respuesta.content.find((b) => b.type === "text");
    if (!bloque || bloque.type !== "text") throw new Error("Respuesta vacía");

    const datos = extraerJSON(bloque.text) as { resumen?: string; items?: unknown };
    const items = sanear(datos.items);
    const resultado = totalizar(datos.resumen?.trim() || texto, items, "claude");
    if (items.length === 0) resultado.aviso = "No se reconocieron alimentos en la descripción.";
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("Fallo en el análisis de nutrición con Claude", e);
    // Degradación elegante: al menos devolvemos la estimación offline.
    const offline = estimarOffline(texto);
    offline.aviso = "El análisis con IA no está disponible ahora; estimación aproximada.";
    return NextResponse.json(offline);
  }
}
