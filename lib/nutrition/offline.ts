/* ============================================================================
   Estimador de nutrición OFFLINE.

   Todos los alimentos se guardan con macros POR 100 g (canónico). El parser
   convierte lo que escribe el usuario —gramos, mililitros, lonchas, cucharadas,
   piezas— a gramos, y de ahí a kcal. Esto evita el fallo clásico de multiplicar
   "50 gr de pan" por 50 unidades.
   ========================================================================= */

import type { AnalisisNutricional, ItemNutricional } from "./types";

interface Alimento {
  claves: string[];
  /** Macros por 100 g. */
  kcal: number;
  p: number;
  c: number;
  g: number;
  /** Gramos de una porción típica cuando se dice "1 X" sin unidad. */
  porcion: number;
  /** Gramos de unidades nombradas concretas ("loncha", "cucharada"…). */
  unidades?: Record<string, number>;
  /** Si es líquido, 1 ml ≈ 1 g. */
  liquido?: boolean;
}

/* Gramos por unidad genérica, usados si el alimento no define la suya. */
const UNIDADES_GENERICAS: Record<string, number> = {
  cucharada: 15,
  cda: 15,
  cucharadita: 5,
  cdta: 5,
  loncha: 25,
  lonchas: 25,
  rebanada: 30,
  rodaja: 25,
  filete: 120,
  puñado: 30,
  punado: 30,
  vaso: 200,
  taza: 240,
  plato: 250,
  racion: 150,
  porcion: 100,
  lata: 80,
  bote: 200,
  pieza: 100,
  unidad: 100,
};

const DB: Alimento[] = [
  /* --- Panadería y cereales --- */
  { claves: ["pan de molde", "pan molde"], kcal: 265, p: 9, c: 49, g: 3.2, porcion: 30, unidades: { rebanada: 30 } },
  { claves: ["pan integral"], kcal: 247, p: 9, c: 41, g: 3.4, porcion: 50, unidades: { rebanada: 30 } },
  { claves: ["pan", "barra de pan", "tostada", "tostadas", "rebanada de pan", "picos", "biscote"], kcal: 265, p: 9, c: 49, g: 3.2, porcion: 50, unidades: { rebanada: 30, tostada: 30 } },
  { claves: ["avena", "copos de avena"], kcal: 379, p: 13, c: 68, g: 7, porcion: 40 },
  { claves: ["cereales"], kcal: 380, p: 7, c: 82, g: 3, porcion: 40 },
  { claves: ["arroz"], kcal: 130, p: 2.7, c: 28, g: 0.3, porcion: 180, unidades: { plato: 200 } },
  { claves: ["pasta", "espagueti", "espaguetis", "macarrones", "fideos"], kcal: 158, p: 5.8, c: 31, g: 0.9, porcion: 180, unidades: { plato: 200 } },
  { claves: ["quinoa"], kcal: 120, p: 4.4, c: 21, g: 1.9, porcion: 150 },
  { claves: ["tortilla de patatas", "tortilla de patata"], kcal: 170, p: 6, c: 14, g: 10, porcion: 150, unidades: { porcion: 150, pincho: 120 } },

  /* --- Grasas --- */
  { claves: ["aceite de oliva", "aove", "aceite"], kcal: 884, p: 0, c: 0, g: 100, porcion: 10, unidades: { cucharada: 10, cda: 10, chorro: 8, chorrito: 5 }, liquido: true },
  { claves: ["mantequilla"], kcal: 717, p: 0.9, c: 0.1, g: 81, porcion: 10, unidades: { cucharada: 12 } },
  { claves: ["aguacate"], kcal: 160, p: 2, c: 9, g: 15, porcion: 150 },
  { claves: ["almendras"], kcal: 579, p: 21, c: 22, g: 50, porcion: 30, unidades: { punado: 25, puñado: 25 } },
  { claves: ["nueces"], kcal: 654, p: 15, c: 14, g: 65, porcion: 30, unidades: { punado: 25, puñado: 25, unidad: 5 } },
  { claves: ["frutos secos"], kcal: 600, p: 18, c: 18, g: 55, porcion: 30, unidades: { punado: 25, puñado: 25 } },
  { claves: ["cacahuetes", "crema de cacahuete"], kcal: 588, p: 26, c: 16, g: 49, porcion: 30, unidades: { cucharada: 16 } },

  /* --- Carnes y fiambres --- */
  { claves: ["pavo", "fiambre de pavo", "pechuga de pavo"], kcal: 104, p: 18, c: 2, g: 2.5, porcion: 50, unidades: { loncha: 20, lonchas: 20 } },
  { claves: ["jamon york", "jamón york", "jamon cocido", "jamón cocido"], kcal: 120, p: 18, c: 1.5, g: 4.5, porcion: 50, unidades: { loncha: 20 } },
  { claves: ["jamon serrano", "jamón serrano", "jamon iberico", "jamón ibérico", "jamon", "jamón"], kcal: 241, p: 31, c: 0.3, g: 13, porcion: 40, unidades: { loncha: 15 } },
  { claves: ["pollo", "pechuga de pollo", "pechuga"], kcal: 165, p: 31, c: 0, g: 3.6, porcion: 150, unidades: { filete: 130 } },
  { claves: ["ternera", "filete de ternera", "carne picada", "carne"], kcal: 217, p: 26, c: 0, g: 12, porcion: 150, unidades: { filete: 140 } },
  { claves: ["cerdo", "lomo", "solomillo"], kcal: 242, p: 27, c: 0, g: 14, porcion: 150, unidades: { filete: 130 } },
  { claves: ["chorizo", "salchichon", "salchichón", "embutido"], kcal: 455, p: 24, c: 2, g: 38, porcion: 30, unidades: { loncha: 10 } },
  { claves: ["bacon", "panceta"], kcal: 541, p: 37, c: 1.4, g: 42, porcion: 30, unidades: { loncha: 15 } },

  /* --- Pescados --- */
  { claves: ["salmon", "salmón"], kcal: 208, p: 20, c: 0, g: 13, porcion: 150, unidades: { filete: 140 } },
  { claves: ["atun", "atún"], kcal: 130, p: 28, c: 0, g: 1, porcion: 100, unidades: { lata: 56 } },
  { claves: ["merluza", "pescado blanco", "bacalao", "pescado"], kcal: 90, p: 18, c: 0, g: 2, porcion: 150, unidades: { filete: 140 } },
  { claves: ["gambas", "langostinos", "marisco"], kcal: 99, p: 24, c: 0.2, g: 0.3, porcion: 120 },
  { claves: ["boquerones", "sardinas", "anchoas"], kcal: 208, p: 25, c: 0, g: 11, porcion: 100 },

  /* --- Huevos y lácteos --- */
  { claves: ["huevo", "huevos"], kcal: 155, p: 13, c: 1.1, g: 11, porcion: 55, unidades: { unidad: 55 } },
  { claves: ["clara de huevo", "claras"], kcal: 52, p: 11, c: 0.7, g: 0.2, porcion: 33 },
  { claves: ["cafe con leche", "café con leche"], kcal: 45, p: 2.4, c: 3.6, g: 2.2, porcion: 150, unidades: { taza: 150, vaso: 200 }, liquido: true },
  { claves: ["cafe solo", "café solo", "cafe", "café", "expreso", "espresso"], kcal: 2, p: 0.2, c: 0, g: 0, porcion: 50, unidades: { taza: 50 }, liquido: true },
  { claves: ["leche desnatada"], kcal: 35, p: 3.4, c: 5, g: 0.1, porcion: 200, liquido: true },
  { claves: ["leche"], kcal: 61, p: 3.2, c: 4.8, g: 3.2, porcion: 200, unidades: { vaso: 200, taza: 240 }, liquido: true },
  { claves: ["yogur griego", "yogurt griego"], kcal: 97, p: 9, c: 4, g: 5, porcion: 125 },
  { claves: ["yogur", "yogurt"], kcal: 61, p: 3.5, c: 4.7, g: 3.3, porcion: 125, unidades: { unidad: 125 } },
  { claves: ["queso fresco", "requeson", "requesón", "burgos"], kcal: 98, p: 11, c: 3.4, g: 4.3, porcion: 80 },
  { claves: ["queso curado", "queso manchego"], kcal: 390, p: 25, c: 1.5, g: 32, porcion: 30, unidades: { loncha: 20, cuna: 30 } },
  { claves: ["queso"], kcal: 350, p: 23, c: 2, g: 28, porcion: 30, unidades: { loncha: 20 } },

  /* --- Verduras, legumbres y fruta --- */
  { claves: ["ensalada", "lechuga", "verdura", "verduras", "espinacas", "brocoli", "brócoli"], kcal: 35, p: 2, c: 6, g: 0.4, porcion: 150, unidades: { plato: 200 } },
  { claves: ["tomate"], kcal: 18, p: 0.9, c: 3.9, g: 0.2, porcion: 120 },
  { claves: ["patata", "patatas", "papa"], kcal: 87, p: 2, c: 20, g: 0.1, porcion: 200 },
  { claves: ["lentejas", "garbanzos", "alubias", "legumbres", "judias"], kcal: 116, p: 9, c: 20, g: 0.4, porcion: 200, unidades: { plato: 250 } },
  { claves: ["platano", "plátano", "banana"], kcal: 89, p: 1.1, c: 23, g: 0.3, porcion: 120 },
  { claves: ["manzana"], kcal: 52, p: 0.3, c: 14, g: 0.2, porcion: 180 },
  { claves: ["naranja", "mandarina"], kcal: 47, p: 0.9, c: 12, g: 0.1, porcion: 150 },
  { claves: ["fresas", "frutos rojos", "arandanos", "arándanos"], kcal: 33, p: 0.7, c: 8, g: 0.3, porcion: 150 },
  { claves: ["sandia", "sandía", "melon", "melón"], kcal: 30, p: 0.6, c: 8, g: 0.2, porcion: 200 },
  { claves: ["fruta"], kcal: 55, p: 0.8, c: 13, g: 0.2, porcion: 150 },

  /* --- Platos y ultraprocesados --- */
  { claves: ["bocadillo", "sandwich", "sándwich", "bocata"], kcal: 250, p: 11, c: 30, g: 9, porcion: 180 },
  { claves: ["pizza"], kcal: 266, p: 11, c: 33, g: 10, porcion: 120, unidades: { porcion: 110, entera: 450 } },
  { claves: ["hamburguesa"], kcal: 260, p: 15, c: 22, g: 12, porcion: 220 },
  { claves: ["patatas fritas", "fritas"], kcal: 312, p: 3.4, c: 41, g: 15, porcion: 130 },
  { claves: ["chocolate", "onza"], kcal: 546, p: 5, c: 61, g: 31, porcion: 25, unidades: { onza: 10, tableta: 100 } },
  { claves: ["galletas", "galleta"], kcal: 480, p: 7, c: 68, g: 20, porcion: 30, unidades: { unidad: 8 } },
  { claves: ["bolleria", "bollería", "croissant", "donut", "magdalena"], kcal: 420, p: 7, c: 48, g: 22, porcion: 60 },
  { claves: ["helado"], kcal: 207, p: 3.5, c: 24, g: 11, porcion: 100 },
  { claves: ["azucar", "azúcar"], kcal: 400, p: 0, c: 100, g: 0, porcion: 8, unidades: { cucharada: 12, cucharadita: 5, sobre: 8 } },
  { claves: ["miel"], kcal: 304, p: 0.3, c: 82, g: 0, porcion: 20, unidades: { cucharada: 21 } },
  { claves: ["mermelada"], kcal: 250, p: 0.4, c: 60, g: 0.1, porcion: 20, unidades: { cucharada: 20 } },

  /* --- Bebidas --- */
  { claves: ["cerveza", "caña", "cana", "tercio"], kcal: 43, p: 0.5, c: 3.6, g: 0, porcion: 330, unidades: { cana: 200, caña: 200, tercio: 330, jarra: 500 }, liquido: true },
  { claves: ["vino", "copa de vino", "tinto"], kcal: 83, p: 0.1, c: 2.6, g: 0, porcion: 150, unidades: { copa: 150 }, liquido: true },
  { claves: ["refresco", "coca cola", "cocacola"], kcal: 42, p: 0, c: 10.6, g: 0, porcion: 330, unidades: { lata: 330 }, liquido: true },
  { claves: ["zumo", "jugo"], kcal: 45, p: 0.5, c: 10, g: 0.1, porcion: 200, liquido: true },
  { claves: ["batido de proteinas", "batido de proteínas", "proteina", "proteína", "whey"], kcal: 380, p: 78, c: 8, g: 5, porcion: 30, unidades: { cacito: 30, scoop: 30 } },
];

/* Índice de claves ordenado por longitud descendente: "café con leche" gana a "café". */
const CLAVES: Array<{ clave: string; alimento: Alimento }> = DB.flatMap((alimento) =>
  alimento.claves.map((clave) => ({ clave: sinTildes(clave), alimento })),
).sort((a, b) => b.clave.length - a.clave.length);

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, media: 0.5, medio: 0.5,
};

function sinTildes(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function aNumero(bruto: string): number | null {
  const n = parseFloat(bruto.replace(",", "."));
  if (Number.isFinite(n)) return n;
  return NUMEROS[bruto] ?? null;
}

/** Patrón de cantidad: cifra o palabra ("2", "1,5", "media"). */
const CANTIDAD = "(\\d+(?:[.,]\\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|media|medio)";

/**
 * Traduce el contexto de un alimento a gramos.
 * Prioridad: masa explícita → volumen (si líquido) → unidad nombrada → cuenta simple.
 */
function gramosDe(contexto: string, alimento: Alimento): number {
  // 1. Masa explícita: "50 gr", "1,5 kg"
  const masa = contexto.match(new RegExp(`${CANTIDAD}\\s*(kg|kilos?|g|gr|grs|gramos?)\\b`));
  if (masa) {
    const n = aNumero(masa[1]);
    if (n !== null) return /^k/.test(masa[2]) ? n * 1000 : n;
  }

  // 2. Volumen para líquidos: "200 ml", "1 l"
  if (alimento.liquido) {
    const vol = contexto.match(new RegExp(`${CANTIDAD}\\s*(l|litros?|ml|cl)\\b`));
    if (vol) {
      const n = aNumero(vol[1]);
      if (n !== null) {
        if (/^l/.test(vol[2])) return n * 1000;
        if (vol[2] === "cl") return n * 10;
        return n;
      }
    }
  }

  // 3. Unidad nombrada: "2 lonchas", "1 cda", "media taza"
  const tabla = { ...UNIDADES_GENERICAS, ...(alimento.unidades ?? {}) };
  for (const [nombre, gramos] of Object.entries(tabla)) {
    const base = sinTildes(nombre).replace(/s$/, "");
    const re = new RegExp(`(?:${CANTIDAD}\\s+)?\\b${base}s?\\b`);
    const m = contexto.match(re);
    if (m) {
      const n = m[1] ? aNumero(m[1]) : 1;
      return (n ?? 1) * gramos;
    }
  }

  // 4. Cuenta simple: "2 huevos" → 2 porciones
  const cuenta = contexto.match(new RegExp(`${CANTIDAD}(?!\\s*(?:kg|kilos?|g|gr|grs|gramos?|l|litros?|ml|cl)\\b)`));
  const n = cuenta ? aNumero(cuenta[1]) : 1;
  return (n ?? 1) * alimento.porcion;
}

interface Coincidencia {
  alimento: Alimento;
  inicio: number;
  fin: number;
}

/** Localiza alimentos en el texto sin solaparse, preferiendo la clave más larga. */
function localizar(texto: string): Coincidencia[] {
  const encontradas: Coincidencia[] = [];
  const ocupado = new Array(texto.length).fill(false);

  for (const { clave, alimento } of CLAVES) {
    let desde = 0;
    for (;;) {
      const i = texto.indexOf(clave, desde);
      if (i === -1) break;
      let fin = i + clave.length;
      // Admite el plural: "cañas", "lentejas", "huevos" → clave en singular.
      for (const sufijoPlural of ["es", "s"]) {
        const tras = fin + sufijoPlural.length;
        if (texto.startsWith(sufijoPlural, fin) && (tras === texto.length || !/[a-z0-9]/.test(texto[tras]))) {
          fin = tras;
          break;
        }
      }
      const limpioIzq = i === 0 || !/[a-z0-9]/.test(texto[i - 1]);
      const limpioDer = fin === texto.length || !/[a-z0-9]/.test(texto[fin]);
      const libre = !ocupado.slice(i, fin).some(Boolean);
      if (limpioIzq && limpioDer && libre) {
        for (let k = i; k < fin; k++) ocupado[k] = true;
        encontradas.push({ alimento, inicio: i, fin });
      }
      desde = fin;
    }
  }

  return encontradas.sort((a, b) => a.inicio - b.inicio);
}

const SEPARADOR = /\s*(?:,|\by\b|\bcon\b|\bmas\b|\+|\n|;)\s*/;

/** Estima kcal y macros a partir de texto libre, sin IA externa. */
export function estimarOffline(texto: string): AnalisisNutricional {
  const limpio = sinTildes(texto)
    .replace(/^(desayuno|comida|cena|snack|merienda|almuerzo)\s*:?/, "")
    .trim();

  const coincidencias = localizar(limpio);
  const items: ItemNutricional[] = [];

  for (let i = 0; i < coincidencias.length; i++) {
    const c = coincidencias[i];
    const finAnterior = i === 0 ? 0 : coincidencias[i - 1].fin;
    const inicioSiguiente = i === coincidencias.length - 1 ? limpio.length : coincidencias[i + 1].inicio;

    // Lo que hay antes del alimento ("2 lonchas de") y lo que va justo después
    // ("de 50 gr"). Ambos se recortan en el conector más cercano al alimento,
    // para no heredar la cantidad del alimento vecino.
    const antes = limpio.slice(finAnterior, c.inicio).split(SEPARADOR);
    const prefijo = antes[antes.length - 1] ?? "";
    const sufijo = limpio.slice(c.fin, inicioSiguiente).split(SEPARADOR)[0] ?? "";
    // La propia palabra entra en el contexto porque a veces ES la unidad
    // ("2 cañas" → caña = 200 ml, no 2 tercios).
    const surface = limpio.slice(c.inicio, c.fin);
    const contexto = `${prefijo} ${surface} ${sufijo}`;

    const gramos = Math.min(2000, Math.max(1, gramosDe(contexto, c.alimento)));
    const f = gramos / 100;

    items.push({
      nombre: `${limpio.slice(c.inicio, c.fin)} · ${Math.round(gramos)} g`,
      kcal: Math.round(c.alimento.kcal * f),
      proteinas: Math.round(c.alimento.p * f),
      carbohidratos: Math.round(c.alimento.c * f),
      grasas: Math.round(c.alimento.g * f),
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
    aviso:
      items.length === 0
        ? "No se reconoció ningún alimento. Escribe las kcal a mano si lo prefieres."
        : "Estimación aproximada · puedes editar cualquier valor.",
  };
}
