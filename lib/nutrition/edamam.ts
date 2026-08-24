/**
 * Edamam Nutrition Analysis API
 * API profesional para análisis de nutrición en lenguaje natural.
 * https://www.edamam.com/nutrition-analysis-api
 */

import type { AnalisisNutricional, ItemNutricional } from "./types";

export interface EdamamFood {
  foodId: string;
  label: string;
  nutrients: {
    ENERC_KCAL?: number;
    PROCNT?: number;
    CHOCDF?: number;
    FAT?: number;
  };
  category?: string;
  categoryLabel?: string;
}

export interface EdamamResponse {
  uri: string;
  yield: number;
  ingredients: EdamamFood[];
  totalNutrients?: Record<string, { quantity: number; unit: string }>;
  totalDaily?: Record<string, { quantity: number; unit: string }>;
}

const APP_ID = process.env.EDAMAM_APP_ID || "";
const APP_KEY = process.env.EDAMAM_APP_KEY || "";

export async function analizarConEdamam(texto: string): Promise<AnalisisNutricional | null> {
  if (!APP_ID || !APP_KEY) {
    console.warn("Edamam no configurado (EDAMAM_APP_ID/APP_KEY no definidas)");
    return null;
  }

  try {
    const respuesta = await fetch("https://api.edamam.com/api/nutrition-details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: texto,
        ingr: [texto], // Edamam espera un array de ingredientes
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        console.error("Edamam: credenciales inválidas");
        return null;
      }
      if (respuesta.status === 429) {
        console.warn("Edamam: límite de requests alcanzado");
        return null;
      }
      throw new Error(`Edamam error: ${respuesta.status}`);
    }

    const datos = (await respuesta.json()) as EdamamResponse;
    const items = datos.ingredients
      .map((ing): ItemNutricional => ({
        nombre: ing.label || "Alimento",
        kcal: Math.round(ing.nutrients.ENERC_KCAL || 0),
        proteinas: Math.round(ing.nutrients.PROCNT || 0),
        carbohidratos: Math.round(ing.nutrients.CHOCDF || 0),
        grasas: Math.round(ing.nutrients.FAT || 0),
      }))
      .filter((it) => it.kcal > 0);

    if (items.length === 0) return null;

    const total = items.reduce(
      (a, it) => ({
        kcal: a.kcal + it.kcal,
        proteinas: a.proteinas + it.proteinas,
        carbohidratos: a.carbohidratos + it.carbohidratos,
        grasas: a.grasas + it.grasas,
      }),
      { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
    );

    return {
      resumen: texto,
      items,
      ...total,
      fuente: "edamam",
    };
  } catch (e) {
    console.error("Error al analizar con Edamam", e);
    return null;
  }
}
