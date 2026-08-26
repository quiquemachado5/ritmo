import type { AnalisisNutricional, ItemNutricional } from "./types";

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_NUTRITION_MODEL || "gemini-3.6-flash";

type GeminiItem = Partial<Record<"nombre" | "kcal" | "proteinas" | "carbohidratos" | "grasas", unknown>>;
type GeminiPayload = Partial<Record<"items" | "kcal" | "proteinas" | "carbohidratos" | "grasas", unknown>>;

function numero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function extraerJSON(texto: string): GeminiPayload | null {
  const limpio = texto.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    const dato = JSON.parse(limpio) as GeminiPayload;
    return dato && typeof dato === "object" ? dato : null;
  } catch {
    return null;
  }
}

/**
 * Analiza una comida mediante Gemini en el servidor. La clave nunca llega al
 * navegador; ante una respuesta incompleta, el llamador conserva sus fallbacks.
 */
export async function analizarConGemini(texto: string): Promise<AnalisisNutricional | null> {
  if (!API_KEY) return null;

  const respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: [
          "Eres un analista nutricional prudente para una app española de registro.",
          "Descompón la comida descrita en todos sus ingredientes y estima energía y macronutrientes.",
          "Respeta estrictamente los gramos y mililitros indicados. Cuenta siempre aceites, mantequilla, alioli, salsas, queso, frutos secos y aliños; no los omitas.",
          "Distingue peso crudo de peso cocido cuando el texto lo especifique. Interpreta aceite en ml como aceite realmente consumido.",
          "No inventes marcas, gramos ni ingredientes: cuando la cantidad sea ambigua, usa una ración habitual conservadora y deja esa incertidumbre dentro del valor del ingrediente.",
          "Responde solo JSON válido con esta forma exacta:",
          '{"items":[{"nombre":"string","kcal":0,"proteinas":0,"carbohidratos":0,"grasas":0}]}',
          "Todas las cifras deben ser números no negativos, en gramos salvo kcal. Revisa que las kcal sean coherentes con los macros antes de responder. No des consejos médicos ni texto adicional.",
        ].join(" ") }],
      },
      contents: [{ role: "user", parts: [{ text: `Comida: ${texto}` }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: 1024,
        // En Gemini 3, la nutrición estructurada no necesita razonamiento
        // extendido: reservamos los tokens para el JSON final y reducimos la
        // latencia de cada registro.
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!respuesta.ok) {
    console.warn(`Gemini nutrición: ${respuesta.status}`);
    return null;
  }

  const datos = await respuesta.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const textoJSON = datos.candidates?.[0]?.content?.parts?.map((parte) => parte.text || "").join("") || "";
  const payload = extraerJSON(textoJSON);
  if (!payload || !Array.isArray(payload.items)) return null;

  const items = payload.items
    .filter((item): item is GeminiItem => item != null && typeof item === "object")
    .map((item): ItemNutricional => ({
      nombre: typeof item.nombre === "string" && item.nombre.trim() ? item.nombre.trim() : "Alimento",
      kcal: numero(item.kcal),
      proteinas: numero(item.proteinas),
      carbohidratos: numero(item.carbohidratos),
      grasas: numero(item.grasas),
    }))
    .filter((item) => item.kcal > 0);

  if (items.length === 0) return null;
  const total = items.reduce(
    (acumulado, item) => ({
      kcal: acumulado.kcal + item.kcal,
      proteinas: acumulado.proteinas + item.proteinas,
      carbohidratos: acumulado.carbohidratos + item.carbohidratos,
      grasas: acumulado.grasas + item.grasas,
    }),
    { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  );

  return { resumen: texto, items, ...total, fuente: "gemini" };
}
