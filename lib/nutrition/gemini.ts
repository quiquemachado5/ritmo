import type { AnalisisNutricional, ItemNutricional } from "./types";

const API_KEY = process.env.GEMINI_API_KEY || "";
// 3.5 Flash ofrece ahora mismo la mejor combinación de disponibilidad, latencia
// y salida estructurada para la cuota gratuita usada por RITMO.
const MODEL = process.env.GEMINI_NUTRITION_MODEL || "gemini-3.5-flash";

type GeminiItem = Partial<Record<
  "nombre" | "cantidad" | "cantidadEstimada" | "kcal" | "proteinas" | "carbohidratos" | "grasas",
  unknown
>>;
type GeminiPayload = Partial<Record<"items" | "confianza" | "observaciones", unknown>>;

const ESQUEMA_RESPUESTA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "Un elemento por ingrediente; solo agrupa repeticiones exactas sumando sus cantidades.",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre específico del ingrediente." },
          cantidad: { type: "string", description: "Cantidad usada, con unidad y equivalencia aproximada en gramos o ml." },
          cantidadEstimada: { type: "boolean", description: "Verdadero si el usuario no indicó una cantidad exacta." },
          kcal: { type: "number" },
          proteinas: { type: "number" },
          carbohidratos: { type: "number" },
          grasas: { type: "number" },
        },
        required: ["nombre", "cantidad", "cantidadEstimada", "kcal", "proteinas", "carbohidratos", "grasas"],
      },
    },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    observaciones: {
      type: "array",
      items: { type: "string" },
      description: "Solo supuestos relevantes sobre cantidades ambiguas.",
    },
  },
  required: ["items", "confianza", "observaciones"],
} as const;

function numero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
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
          "Eres el analista nutricional de RITMO para descripciones en español. Tu prioridad es NO omitir ingredientes.",
          "Primero separa mentalmente la frase completa ingrediente por ingrediente, aunque sea larga, no tenga comas o repita conectores como 'con' e 'y'. Después calcula cada fila.",
          "Respeta exactamente gramos, mililitros, unidades, filetes, latas, cucharadas (cda) y cucharaditas. La cantidad se asocia únicamente al ingrediente más cercano.",
          "Cuenta cada aparición de AOVE, aceite, mantequilla, alioli, salsa, queso, frutos secos y aliño. Si el mismo aceite aparece dos veces, suma ambas cantidades y deja claro el total.",
          "Una cucharada de AOVE son 15 ml (aprox. 13,5 g y 119 kcal). No confundas una cucharada con una cucharadita.",
          "Distingue peso crudo de cocido. Si no se especifica, usa el estado habitual del plato descrito.",
          "Si falta una cantidad, usa una ración española razonable. Para 'filete de pollo a la plancha' sin peso, usa 130 g ya cocinados por filete; dos filetes son 260 g. Marca cantidadEstimada=true y explica el supuesto brevemente.",
          "No inventes ingredientes, marcas ni preparaciones. Especias, sal y vinagre sin azúcar pueden contar como 0 kcal, pero no deben ocultar ingredientes energéticos cercanos.",
          "Las kcal y los macronutrientes pertenecen a la cantidad indicada, no a 100 g. Comprueba cada fila y el conjunto con 4 kcal/g de proteína y carbohidrato y 9 kcal/g de grasa, admitiendo fibra y redondeos.",
          "Devuelve exclusivamente el JSON que impone el esquema. No añadas consejos ni texto fuera del JSON.",
        ].join(" ") }],
      },
      contents: [{ role: "user", parts: [{ text: `Analiza esta comida completa sin saltarte ningún ingrediente:\n${texto}` }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: ESQUEMA_RESPUESTA,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    console.warn(`Gemini nutrición: ${respuesta.status} ${respuesta.statusText}${detalle ? ` · ${detalle.slice(0, 320)}` : ""}`);
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
      cantidad: typeof item.cantidad === "string" && item.cantidad.trim() ? item.cantidad.trim() : undefined,
      cantidadEstimada: item.cantidadEstimada === true,
      kcal: numero(item.kcal),
      proteinas: numero(item.proteinas),
      carbohidratos: numero(item.carbohidratos),
      grasas: numero(item.grasas),
    }))
    .map((item) => {
      const kcalMacros = item.proteinas * 4 + item.carbohidratos * 4 + item.grasas * 9;
      if (kcalMacros > 25 && (item.kcal <= 0 || Math.abs(item.kcal - kcalMacros) / kcalMacros > 0.38)) {
        return { ...item, kcal: Math.round(kcalMacros) };
      }
      return item;
    })
    .filter((item) => item.kcal > 0 || item.proteinas > 0 || item.carbohidratos > 0 || item.grasas > 0);

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

  if (total.kcal <= 0 || total.kcal > 6_000) return null;

  let confianza: NonNullable<AnalisisNutricional["confianza"]> = payload.confianza === "alta" || payload.confianza === "media" || payload.confianza === "baja"
    ? payload.confianza
    : "media";
  const proporcionEstimada = items.filter((item) => item.cantidadEstimada).length / items.length;
  if (proporcionEstimada >= 0.7) confianza = "baja";
  else if (proporcionEstimada >= 0.35 && confianza === "alta") confianza = "media";
  const observaciones = Array.isArray(payload.observaciones)
    ? payload.observaciones.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
    : [];

  return {
    resumen: texto,
    items,
    kcal: Math.round(total.kcal),
    proteinas: Math.round(total.proteinas),
    carbohidratos: Math.round(total.carbohidratos),
    grasas: Math.round(total.grasas),
    fuente: "gemini",
    confianza,
    observaciones,
  };
}
