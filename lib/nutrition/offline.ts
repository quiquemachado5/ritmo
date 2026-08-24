/* ============================================================================
   Estimador de nutrición OFFLINE — respaldo cuando no hay clave de IA.

   Base compacta de alimentos frecuentes con macros por unidad o por 100 g.
   No pretende ser exhaustiva; da una estimación razonable y siempre marcada
   como aproximada. Valores por 100 g salvo que `unidad` indique una pieza.
   ========================================================================= */

import type { AnalisisNutricional, ItemNutricional } from "./types";

interface Alimento {
  claves: string[];
  /** kcal, proteínas, carbohidratos, grasas por porción de referencia. */
  kcal: number;
  p: number;
  c: number;
  g: number;
  /** "u" = por unidad/pieza; "100g" = por 100 g; "ud-media" tazas/vasos. */
  base: "u" | "100g";
  gramosPorUnidad?: number;
}

const DB: Alimento[] = [
  { claves: ["huevo", "huevos"], kcal: 78, p: 6.3, c: 0.6, g: 5.3, base: "u" },
  { claves: ["tostada", "tostadas", "pan", "rebanada"], kcal: 80, p: 2.7, c: 15, g: 1, base: "u" },
  { claves: ["cafe con leche", "café con leche", "cafe", "café"], kcal: 60, p: 3, c: 6, g: 2.3, base: "u" },
  { claves: ["leche", "vaso de leche"], kcal: 122, p: 6.4, c: 9.6, g: 6.4, base: "u", gramosPorUnidad: 200 },
  { claves: ["platano", "plátano", "banana"], kcal: 105, p: 1.3, c: 27, g: 0.4, base: "u" },
  { claves: ["manzana"], kcal: 95, p: 0.5, c: 25, g: 0.3, base: "u" },
  { claves: ["naranja"], kcal: 62, p: 1.2, c: 15, g: 0.2, base: "u" },
  { claves: ["yogur", "yogurt"], kcal: 100, p: 5.5, c: 12, g: 3, base: "u" },
  { claves: ["pollo", "pechuga", "pechuga de pollo"], kcal: 165, p: 31, c: 0, g: 3.6, base: "100g" },
  { claves: ["ternera", "carne", "filete"], kcal: 217, p: 26, c: 0, g: 12, base: "100g" },
  { claves: ["cerdo", "lomo"], kcal: 242, p: 27, c: 0, g: 14, base: "100g" },
  { claves: ["salmon", "salmón"], kcal: 208, p: 20, c: 0, g: 13, base: "100g" },
  { claves: ["atun", "atún"], kcal: 130, p: 28, c: 0, g: 1, base: "100g" },
  { claves: ["merluza", "pescado blanco", "pescado"], kcal: 90, p: 18, c: 0, g: 2, base: "100g" },
  { claves: ["arroz", "arroz blanco"], kcal: 130, p: 2.7, c: 28, g: 0.3, base: "100g" },
  { claves: ["pasta", "espagueti", "macarrones"], kcal: 158, p: 5.8, c: 31, g: 0.9, base: "100g" },
  { claves: ["patata", "patatas", "papa"], kcal: 87, p: 2, c: 20, g: 0.1, base: "100g" },
  { claves: ["lentejas", "legumbres", "garbanzos", "alubias"], kcal: 116, p: 9, c: 20, g: 0.4, base: "100g" },
  { claves: ["ensalada", "lechuga", "verdura", "verduras"], kcal: 35, p: 2, c: 6, g: 0.4, base: "100g" },
  { claves: ["tomate"], kcal: 22, p: 1.1, c: 4.8, g: 0.2, base: "u" },
  { claves: ["aguacate"], kcal: 240, p: 3, c: 12, g: 22, base: "u" },
  { claves: ["queso"], kcal: 100, p: 6.5, c: 0.4, g: 8, base: "u", gramosPorUnidad: 30 },
  { claves: ["jamon", "jamón"], kcal: 145, p: 25, c: 1, g: 5, base: "100g" },
  { claves: ["aceite", "aceite de oliva"], kcal: 90, p: 0, c: 0, g: 10, base: "u" },
  { claves: ["almendras", "frutos secos", "nueces"], kcal: 174, p: 6, c: 6, g: 15, base: "u", gramosPorUnidad: 30 },
  { claves: ["avena", "copos de avena"], kcal: 150, p: 5, c: 27, g: 3, base: "u", gramosPorUnidad: 40 },
  { claves: ["cerveza", "caña"], kcal: 110, p: 1, c: 9, g: 0, base: "u", gramosPorUnidad: 330 },
  { claves: ["vino", "copa de vino"], kcal: 125, p: 0, c: 4, g: 0, base: "u" },
  { claves: ["chocolate", "onza"], kcal: 55, p: 0.7, c: 6, g: 3, base: "u" },
  { claves: ["galletas", "galleta"], kcal: 50, p: 0.7, c: 7, g: 2, base: "u" },
  { claves: ["bocadillo", "sandwich", "sándwich"], kcal: 350, p: 15, c: 40, g: 12, base: "u" },
  { claves: ["pizza", "porcion de pizza", "porción de pizza"], kcal: 285, p: 12, c: 36, g: 10, base: "u" },
  { claves: ["hamburguesa"], kcal: 450, p: 25, c: 35, g: 24, base: "u" },
];

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, media: 0.5, medio: 0.5,
};

function detectarCantidad(fragmento: string): number {
  const numero = fragmento.match(/(\d+(?:[.,]\d+)?)/);
  if (numero) return parseFloat(numero[1].replace(",", "."));
  for (const [palabra, valor] of Object.entries(NUMEROS)) {
    if (new RegExp(`\\b${palabra}\\b`).test(fragmento)) return valor;
  }
  return 1;
}

function detectarGramos(fragmento: string): number | null {
  const g = fragmento.match(/(\d+)\s*(g|gr|gramos)\b/);
  if (g) return parseFloat(g[1]);
  return null;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFC").trim();
}

/** Estima kcal y macros a partir de texto libre, sin IA externa. */
export function estimarOffline(texto: string): AnalisisNutricional {
  const limpio = normalizar(texto)
    .replace(/^(desayuno|comida|cena|snack|merienda|almuerzo)\s*:?/i, "")
    .trim();
  const fragmentos = limpio.split(/,|\by\b|\+|\n|\./).map((f) => f.trim()).filter(Boolean);

  const items: ItemNutricional[] = [];
  for (const frag of fragmentos) {
    const alimento = DB.find((a) => a.claves.some((k) => frag.includes(k)));
    if (!alimento) continue;
    const gramos = detectarGramos(frag);
    let factor: number;
    if (alimento.base === "100g") {
      factor = (gramos ?? 100) / 100;
    } else {
      const unidades = detectarCantidad(frag);
      factor = gramos && alimento.gramosPorUnidad ? gramos / alimento.gramosPorUnidad : unidades;
    }
    items.push({
      nombre: frag.charAt(0).toUpperCase() + frag.slice(1),
      kcal: Math.round(alimento.kcal * factor),
      proteinas: Math.round(alimento.p * factor),
      carbohidratos: Math.round(alimento.c * factor),
      grasas: Math.round(alimento.g * factor),
    });
  }

  const total = items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + it.kcal,
      proteinas: acc.proteinas + it.proteinas,
      carbohidratos: acc.carbohidratos + it.carbohidratos,
      grasas: acc.grasas + it.grasas,
    }),
    { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  );

  return {
    resumen: texto.trim(),
    ...total,
    items,
    fuente: "offline",
    aviso: items.length === 0
      ? "No se reconocieron alimentos. Añade la clave ANTHROPIC_API_KEY para el análisis inteligente."
      : "Estimación aproximada sin IA. Añade ANTHROPIC_API_KEY para mayor precisión.",
  };
}
