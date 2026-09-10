/* ============================================================================
   Estimador de nutrición OFFLINE.

   Todos los alimentos se guardan con macros POR 100 g (canónico). El parser
   convierte lo que escribe el usuario —gramos, mililitros, lonchas, cucharadas,
   piezas— a gramos, y de ahí a kcal. Esto evita el fallo clásico de multiplicar
   "50 gr de pan" por 50 unidades.
   ========================================================================= */

import type { AnalisisNutricional, ItemNutricional } from "./types";
import { REFERENCIAS_VERIFICADAS, referenciaLocal } from "./catalog";

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
  /** Multiplicador de peso al cocinar un cereal o legumbre seca. */
  absorcionAgua?: number;
  /** Fracción de peso perdida al cocinar carne o pescado. */
  mermaAgua?: number;
}

/* Gramos por unidad genérica, usados si el alimento no define la suya. */
const UNIDADES_GENERICAS: Record<string, number> = {
  cucharada: 10,
  cda: 10,
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
  { claves: ["pan de molde integral", "pan de molde", "pan molde"], kcal: 250, p: 10, c: 40, g: 3.3, porcion: 30, unidades: { rebanada: 30 } },
  { claves: ["pan integral"], kcal: 250, p: 8.5, c: 50, g: 1.5, porcion: 50, unidades: { rebanada: 30 } },
  { claves: ["pan", "barra de pan", "tostada", "tostadas", "rebanada de pan", "picos", "biscote"], kcal: 250, p: 8.5, c: 50, g: 1.5, porcion: 50, unidades: { rebanada: 30, tostada: 30 } },
  { claves: ["avena", "copos de avena"], kcal: 370, p: 13.5, c: 58, g: 7, porcion: 40 },
  { claves: ["cereales"], kcal: 380, p: 7, c: 82, g: 3, porcion: 40 },
  { claves: ["arroz integral"], kcal: 350, p: 7.5, c: 74, g: 2.5, porcion: 80, unidades: { plato: 200 }, absorcionAgua: 2.7 },
  { claves: ["arroz", "arroz basmati", "arroz jazmin", "arroz jazmín"], kcal: 355, p: 7, c: 78, g: 0.8, porcion: 80, unidades: { plato: 200 }, absorcionAgua: 2.7 },
  { claves: ["pasta penne rigate", "penne rigate", "pasta penne", "pasta", "espagueti", "espaguetis", "macarrones", "fideos"], kcal: 350, p: 12, c: 71, g: 1.5, porcion: 90, unidades: { plato: 220 }, absorcionAgua: 2.6 },
  { claves: ["quinoa"], kcal: 368, p: 14, c: 64, g: 6, porcion: 70, absorcionAgua: 2.8 },
  { claves: ["lentejas cocidas", "lentejas en conserva", "lentejas de bote"], kcal: 110, p: 7.5, c: 15, g: 1.5, porcion: 200, unidades: { plato: 250 } },
  { claves: ["garbanzos cocidos", "garbanzos en conserva", "garbanzos de bote"], kcal: 120, p: 8, c: 16, g: 2, porcion: 180, unidades: { plato: 220 } },
  { claves: ["lentejas"], kcal: 325, p: 24, c: 50, g: 1.5, porcion: 80, unidades: { plato: 250 }, absorcionAgua: 2.6 },
  { claves: ["garbanzos"], kcal: 340, p: 19, c: 55, g: 5.5, porcion: 80, unidades: { plato: 250 }, absorcionAgua: 2.5 },
  { claves: ["tortilla de patatas", "tortilla de patata"], kcal: 170, p: 6, c: 14, g: 10, porcion: 150, unidades: { porcion: 150, pincho: 120 } },

  /* --- Grasas --- */
  { claves: ["aceite de sesamo", "aceite de sésamo"], kcal: 900, p: 0, c: 0, g: 100, porcion: 10, unidades: { cucharada: 10, cda: 10, cucharadita: 5, cdta: 5, chorro: 3, chorrito: 3, pulverizacion: 3, pulverización: 3 }, liquido: true },
  { claves: ["aceite de oliva", "aove", "aceite"], kcal: 900, p: 0, c: 0, g: 100, porcion: 10, unidades: { cucharada: 10, cda: 10, cucharadita: 5, cdta: 5, chorro: 3, chorrito: 3, pulverizacion: 3, pulverización: 3 }, liquido: true },
  { claves: ["mantequilla"], kcal: 717, p: 0.9, c: 0.1, g: 81, porcion: 10, unidades: { cucharada: 12 } },
  { claves: ["aguacate"], kcal: 160, p: 2, c: 2, g: 15, porcion: 150 },
  { claves: ["anacardos"], kcal: 553, p: 18, c: 30, g: 44, porcion: 30, unidades: { punado: 25, puñado: 25 } },
  { claves: ["almendras", "nueces", "avellanas", "frutos secos"], kcal: 610, p: 20, c: 10, g: 54, porcion: 30, unidades: { punado: 25, puñado: 25, unidad: 5 } },
  { claves: ["crema de almendra", "crema de cacahuete", "cacahuetes"], kcal: 600, p: 26, c: 10, g: 50, porcion: 30, unidades: { cucharada: 16 } },

  /* --- Carnes y fiambres --- */
  { claves: ["pechuga de pavo en lonchas", "pavo en lonchas", "lonchas de pavo", "fiambre de pavo", "jamon de pavo", "jamón de pavo"], kcal: 90, p: 18, c: 1, g: 1.2, porcion: 40, unidades: { loncha: 20, lonchas: 20 } },
  { claves: ["pechuga de pavo", "pavo fresco", "pavo"], kcal: 105, p: 24, c: 0, g: 1, porcion: 150, unidades: { filete: 130 }, mermaAgua: 0.2 },
  { claves: ["jamon york", "jamón york", "jamon cocido", "jamón cocido"], kcal: 120, p: 18, c: 1.5, g: 4.5, porcion: 50, unidades: { loncha: 20 } },
  { claves: ["jamon serrano", "jamón serrano", "jamon iberico", "jamón ibérico", "jamon", "jamón"], kcal: 200, p: 30, c: 0.5, g: 8.5, porcion: 40, unidades: { loncha: 15 } },
  { claves: ["cecina de vaca", "cecina"], kcal: 175, p: 32, c: 0.5, g: 5, porcion: 40, unidades: { loncha: 12 } },
  { claves: ["lomo embuchado"], kcal: 210, p: 38, c: 0.8, g: 6, porcion: 40, unidades: { loncha: 12 } },
  { claves: ["contramuslo de pollo", "contramuslo"], kcal: 145, p: 20, c: 0, g: 7.2, porcion: 150, mermaAgua: 0.2 },
  { claves: ["pechuga de pollo", "pollo", "pechuga"], kcal: 120, p: 22.5, c: 0, g: 2.6, porcion: 150, unidades: { filete: 130 }, mermaAgua: 0.2 },
  { claves: ["carne picada de ternera y cerdo", "carne picada ternera cerdo", "carne picada mixta"], kcal: 210, p: 18, c: 0, g: 15, porcion: 150, mermaAgua: 0.2 },
  { claves: ["carne picada de ternera magra", "carne picada ternera magra", "carne picada de ternera"], kcal: 130, p: 21, c: 0, g: 5, porcion: 150, mermaAgua: 0.2 },
  { claves: ["solomillo de ternera", "filete de ternera", "ternera", "carne"], kcal: 150, p: 20.5, c: 0, g: 7.5, porcion: 150, unidades: { filete: 140 }, mermaAgua: 0.2 },
  { claves: ["cinta de lomo adobada", "lomo adobado"], kcal: 125, p: 20, c: 0.5, g: 5, porcion: 150, unidades: { filete: 100 }, mermaAgua: 0.2 },
  { claves: ["solomillo de cerdo", "solomillo de cerdo iberico", "solomillo de cerdo ibérico"], kcal: 130, p: 22, c: 0, g: 4.5, porcion: 150, unidades: { filete: 130 }, mermaAgua: 0.2 },
  { claves: ["lomo de cerdo magro", "cinta de lomo", "lomo de cerdo", "lomo", "cerdo"], kcal: 145, p: 21, c: 0, g: 6.5, porcion: 150, unidades: { filete: 130, rodaja: 30, rodajas: 30 }, mermaAgua: 0.2 },
  { claves: ["paletilla de cordero", "pierna de cordero", "cordero"], kcal: 220, p: 18, c: 0, g: 16, porcion: 180, mermaAgua: 0.2 },
  { claves: ["chorizo", "salchichon", "salchichón", "fuet", "embutido"], kcal: 420, p: 21, c: 2, g: 36, porcion: 30, unidades: { loncha: 10 } },
  { claves: ["bacon", "panceta"], kcal: 541, p: 37, c: 1.4, g: 42, porcion: 30, unidades: { loncha: 15 } },

  /* --- Pescados --- */
  { claves: ["lomo de salmon", "lomo de salmón", "salmon", "salmón"], kcal: 208, p: 20, c: 0, g: 13.5, porcion: 150, unidades: { filete: 140 }, mermaAgua: 0.18 },
  { claves: ["barritas de merluza", "barrita de merluza", "varitas de merluza", "varita de merluza"], kcal: 190, p: 12, c: 18, g: 8, porcion: 90, unidades: { unidad: 30 } },
  { claves: ["atun al natural", "atún al natural"], kcal: 100, p: 23.5, c: 0, g: 1, porcion: 80, unidades: { lata: 56 } },
  { claves: ["atun en aceite de oliva", "atún en aceite de oliva", "atun en aceite", "atún en aceite"], kcal: 190, p: 24, c: 0, g: 10.5, porcion: 80, unidades: { lata: 56 } },
  { claves: ["atun fresco", "atún fresco", "atun", "atún"], kcal: 130, p: 23, c: 0, g: 4, porcion: 150, unidades: { filete: 140, lata: 56 }, mermaAgua: 0.18 },
  { claves: ["pez espada", "emperador"], kcal: 130, p: 20, c: 0, g: 5.5, porcion: 150, unidades: { filete: 140 }, mermaAgua: 0.18 },
  { claves: ["merluza", "bacalao", "lenguado", "gallo", "pescado blanco", "pescado"], kcal: 75, p: 16.5, c: 0, g: 0.8, porcion: 150, unidades: { filete: 140 }, mermaAgua: 0.18 },
  { claves: ["gambas", "langostinos", "camarones", "marisco"], kcal: 85, p: 18, c: 0.5, g: 1, porcion: 120, mermaAgua: 0.15 },
  { claves: ["pulpo", "calamar", "sepia"], kcal: 80, p: 16, c: 0.7, g: 1.2, porcion: 150, mermaAgua: 0.15 },
  { claves: ["mejillones", "berberechos"], kcal: 75, p: 12, c: 2.5, g: 1.8, porcion: 150 },
  { claves: ["boquerones", "sardinas", "anchoas"], kcal: 150, p: 18, c: 0, g: 8.5, porcion: 100, mermaAgua: 0.15 },

  /* --- Huevos y lácteos --- */
  { claves: ["huevo l", "huevos l", "huevo", "huevos"], kcal: 141.7, p: 12, c: 0.7, g: 10.3, porcion: 60, unidades: { unidad: 60 } },
  { claves: ["clara de huevo", "claras"], kcal: 50, p: 11, c: 0.7, g: 0.2, porcion: 33 },
  { claves: ["cafe con leche", "café con leche"], kcal: 45, p: 2.4, c: 3.6, g: 2.2, porcion: 150, unidades: { taza: 150, vaso: 200 }, liquido: true },
  { claves: ["cafe solo", "café solo", "cafe", "café", "expreso", "espresso"], kcal: 2, p: 0.2, c: 0, g: 0, porcion: 50, unidades: { taza: 50 }, liquido: true },
  { claves: ["leche desnatada"], kcal: 35, p: 3.4, c: 5, g: 0.1, porcion: 200, liquido: true },
  { claves: ["leche semidesnatada", "leche semi"], kcal: 46, p: 3.2, c: 4.7, g: 1.6, porcion: 200, unidades: { vaso: 200, taza: 240 }, liquido: true },
  { claves: ["leche entera", "leche"], kcal: 63, p: 3.2, c: 4.7, g: 3.6, porcion: 200, unidades: { vaso: 200, taza: 240 }, liquido: true },
  { claves: ["queso fresco batido 0", "yogur griego 0", "yogurt griego 0"], kcal: 55, p: 9.5, c: 3.8, g: 0.1, porcion: 150 },
  { claves: ["yogur griego", "yogurt griego"], kcal: 97, p: 9, c: 4, g: 5, porcion: 125 },
  { claves: ["yogur", "yogurt"], kcal: 61, p: 3.5, c: 4.7, g: 3.3, porcion: 125, unidades: { unidad: 125 } },
  { claves: ["queso cottage", "cottage"], kcal: 90, p: 11.5, c: 2.8, g: 3.3, porcion: 100 },
  { claves: ["skyr natural", "skyr"], kcal: 60, p: 11, c: 3.5, g: 0.2, porcion: 150 },
  { claves: ["queso fresco", "requeson", "requesón", "burgos"], kcal: 98, p: 11, c: 3.4, g: 4.3, porcion: 80 },
  { claves: ["queso pecorino", "pecorino"], kcal: 387, p: 28, c: 1, g: 31, porcion: 20 },
  { claves: ["queso parmesano", "parmesano"], kcal: 431, p: 38, c: 4, g: 29, porcion: 15 },
  { claves: ["queso de cabra", "cabra en rulo"], kcal: 364, p: 19, c: 1, g: 31, porcion: 40 },
  { claves: ["queso mozzarella light", "mozzarella light"], kcal: 165, p: 19, c: 1.5, g: 9.5, porcion: 50 },
  { claves: ["queso mozzarella", "mozzarella"], kcal: 280, p: 22, c: 2, g: 21, porcion: 50 },
  { claves: ["queso feta", "feta"], kcal: 260, p: 14, c: 4, g: 21, porcion: 40 },
  { claves: ["queso curado", "queso manchego"], kcal: 420, p: 25, c: 1, g: 35, porcion: 30, unidades: { loncha: 20, cuna: 30 } },
  { claves: ["queso"], kcal: 350, p: 23, c: 2, g: 28, porcion: 30, unidades: { loncha: 20 } },

  /* --- Verduras, legumbres y fruta --- */
  { claves: ["canónigos", "canonigos"], kcal: 20, p: 2.2, c: 1.4, g: 0.4, porcion: 80 },
  { claves: ["esparragos", "espárragos"], kcal: 30, p: 3, c: 4, g: 0.3, porcion: 100 },
  { claves: ["champinones", "champiñones"], kcal: 22, p: 3.1, c: 3.3, g: 0.3, porcion: 80 },
  { claves: ["boniato", "batata"], kcal: 86, p: 1.6, c: 20, g: 0.1, porcion: 150 },
  { claves: ["pimientos del padron", "pimientos del padrón"], kcal: 25, p: 1, c: 5, g: 0.2, porcion: 100 },
  { claves: ["brocoli", "brócoli", "coliflor"], kcal: 30, p: 3, c: 4, g: 0.3, porcion: 120 },
  { claves: ["calabacin", "calabacín", "berenjena", "pepino"], kcal: 18, p: 1, c: 3, g: 0.2, porcion: 150 },
  { claves: ["ensalada", "lechuga", "verdura", "verduras", "espinacas"], kcal: 20, p: 2.2, c: 1.4, g: 0.4, porcion: 150, unidades: { plato: 200 } },
  { claves: ["tomate", "tomate cherry"], kcal: 18, p: 0.9, c: 3.5, g: 0.2, porcion: 120 },
  { claves: ["cebolla", "pimiento rojo", "pimiento verde", "pimiento"], kcal: 32, p: 1, c: 6.5, g: 0.2, porcion: 100 },
  { claves: ["diente de ajo", "dientes de ajo", "ajitos", "ajito", "ajos", "ajo"], kcal: 149, p: 6.4, c: 33.1, g: 0.5, porcion: 3, unidades: { diente: 3, dientes: 3 } },
  { claves: ["patata", "patatas", "papa"], kcal: 77, p: 2, c: 17, g: 0.1, porcion: 200 },
  { claves: ["judias verdes", "judías verdes", "judia verde", "judía verde", "habichuelas verdes"], kcal: 31, p: 1.8, c: 4.3, g: 0.2, porcion: 200 },
  { claves: ["alubias cocidas", "judias cocidas", "judías cocidas", "legumbres cocidas"], kcal: 105, p: 7, c: 15, g: 1.5, porcion: 200, unidades: { plato: 250 } },
  { claves: ["platano", "plátano", "banana"], kcal: 89, p: 1.1, c: 20, g: 0.3, porcion: 120 },
  { claves: ["manzana", "pera"], kcal: 52, p: 0.3, c: 12, g: 0.2, porcion: 180 },
  { claves: ["naranja", "mandarina"], kcal: 45, p: 0.9, c: 9, g: 0.1, porcion: 150 },
  { claves: ["fresas", "frutos rojos", "arandanos", "arándanos", "frambuesas"], kcal: 40, p: 0.7, c: 8, g: 0.3, porcion: 150 },
  { claves: ["sandia", "sandía", "melon", "melón"], kcal: 30, p: 0.6, c: 8, g: 0.2, porcion: 200 },
  { claves: ["fruta"], kcal: 55, p: 0.8, c: 13, g: 0.2, porcion: 150 },

  /* --- Platos y ultraprocesados --- */
  { claves: ["crema de calabacin", "crema de calabacín"], kcal: 45, p: 1.5, c: 5.5, g: 2, porcion: 300, unidades: { bol: 300, plato: 300, taza: 240 } },
  { claves: ["crema de calabaza"], kcal: 48, p: 1.4, c: 7, g: 1.8, porcion: 300, unidades: { bol: 300, plato: 300, taza: 240 } },
  { claves: ["crema de verduras", "sopa de verduras"], kcal: 43, p: 1.5, c: 6, g: 1.5, porcion: 300, unidades: { bol: 300, plato: 300, taza: 240 } },
  { claves: ["gazpacho"], kcal: 45, p: 1, c: 4, g: 2.7, porcion: 250, unidades: { vaso: 250, taza: 240 } },
  { claves: ["salmorejo"], kcal: 115, p: 2.5, c: 10, g: 7.5, porcion: 250, unidades: { bol: 250, plato: 250, vaso: 250 } },
  { claves: ["hamburguesa completa", "hamburguesa con pan"], kcal: 260, p: 15, c: 22, g: 12, porcion: 220, unidades: { unidad: 220 } },
  { claves: ["hamburguesa de pollo"], kcal: 150, p: 20, c: 3, g: 6.4, porcion: 120, unidades: { unidad: 120 } },
  { claves: ["hamburguesa de pavo"], kcal: 140, p: 20, c: 3, g: 5.3, porcion: 120, unidades: { unidad: 120 } },
  { claves: ["hamburguesa de ternera", "hamburguesa de vacuno"], kcal: 210, p: 18, c: 2, g: 15, porcion: 120, unidades: { unidad: 120 } },
  { claves: ["bocadillo", "bocata"], kcal: 250, p: 8.5, c: 50, g: 1.5, porcion: 100, unidades: { unidad: 100 } },
  { claves: ["sandwich", "sándwich"], kcal: 250, p: 8.5, c: 50, g: 1.5, porcion: 60, unidades: { unidad: 60 } },
  { claves: ["pizza"], kcal: 266, p: 11, c: 33, g: 10, porcion: 120, unidades: { porcion: 110, entera: 450 } },
  { claves: ["hamburguesa"], kcal: 210, p: 18, c: 2, g: 15, porcion: 120, unidades: { unidad: 120 } },
  { claves: ["patatas fritas", "fritas"], kcal: 312, p: 3.4, c: 41, g: 15, porcion: 130 },
  { claves: ["chocolate", "onza"], kcal: 546, p: 5, c: 61, g: 31, porcion: 25, unidades: { onza: 10, tableta: 100 } },
  { claves: ["galletas", "galleta"], kcal: 480, p: 7, c: 68, g: 20, porcion: 30, unidades: { unidad: 8 } },
  { claves: ["bolleria", "bollería", "croissant", "donut", "magdalena"], kcal: 420, p: 7, c: 48, g: 22, porcion: 60 },
  { claves: ["helado"], kcal: 207, p: 3.5, c: 24, g: 11, porcion: 100 },
  { claves: ["azucar", "azúcar"], kcal: 400, p: 0, c: 100, g: 0, porcion: 8, unidades: { cucharada: 12, cucharadita: 5, sobre: 8 } },
  { claves: ["miel"], kcal: 304, p: 0.3, c: 82, g: 0, porcion: 20, unidades: { cucharada: 21 } },
  { claves: ["mermelada"], kcal: 250, p: 0.4, c: 60, g: 0.1, porcion: 20, unidades: { cucharada: 20 } },
  { claves: ["alioli", "alioli casero"], kcal: 680, p: 1, c: 2, g: 74, porcion: 30, unidades: { cucharada: 15 } },
  { claves: ["mostaza antigua", "mostaza"], kcal: 66, p: 4, c: 5, g: 4, porcion: 10, unidades: { cucharada: 15 } },
  { claves: ["tomates secos", "tomate seco"], kcal: 258, p: 14, c: 55, g: 3, porcion: 50 },
  { claves: ["salsa de soja", "soja baja en sodio"], kcal: 53, p: 8, c: 5, g: 0.6, porcion: 15, liquido: true },
  { claves: ["semillas de sesamo", "semillas de sésamo", "sesamo", "sésamo"], kcal: 573, p: 18, c: 12, g: 50, porcion: 10 },
  { claves: ["mayonesa"], kcal: 680, p: 1, c: 1, g: 75, porcion: 15, unidades: { cucharada: 15 } },
  { claves: ["tofu firme", "tofu"], kcal: 144, p: 17, c: 3, g: 9, porcion: 150 },
  { claves: ["vinagre de jerez", "vinagre"], kcal: 18, p: 0, c: 0.4, g: 0, porcion: 5, liquido: true },

  /* --- Bebidas --- */
  { claves: ["cerveza", "caña", "cana", "tercio"], kcal: 43, p: 0.5, c: 3.6, g: 0, porcion: 330, unidades: { cana: 200, caña: 200, tercio: 330, jarra: 500 }, liquido: true },
  { claves: ["vino", "copa de vino", "tinto"], kcal: 83, p: 0.1, c: 2.6, g: 0, porcion: 150, unidades: { copa: 150 }, liquido: true },
  { claves: ["refresco", "coca cola", "cocacola"], kcal: 42, p: 0, c: 10.6, g: 0, porcion: 330, unidades: { lata: 330 }, liquido: true },
  { claves: ["zumo", "jugo"], kcal: 45, p: 0.5, c: 10, g: 0.1, porcion: 200, liquido: true },
  { claves: ["batido de proteinas", "batido de proteínas", "proteina en polvo", "proteína en polvo", "proteina", "proteína", "whey", "aislado"], kcal: 383.3, p: 80, c: 5, g: 3.3, porcion: 30, unidades: { cacito: 30, scoop: 30 } },
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
  const limpio = sinTildes(bruto);
  const partes = limpio.split(/\s*(?:-|–|\ba\b)\s*/).filter(Boolean);
  if (partes.length === 2) {
    const extremos = partes.map(parte => aNumero(parte));
    if (extremos.every((valor): valor is number => valor !== null)) {
      return (extremos[0] + extremos[1]) / 2;
    }
  }
  const n = parseFloat(limpio.replace(",", "."));
  if (Number.isFinite(n)) return n;
  return NUMEROS[limpio] ?? null;
}

/** Patrón de cantidad: cifra o palabra ("2", "1,5", "media"). */
const NUMERO = "(?:\\d+(?:[.,]\\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|media|medio)";
const CANTIDAD = `\\b(${NUMERO}(?:\\s*(?:-|–|a)\\s*${NUMERO})?)\\b`;

interface CantidadInterpretada { gramos: number; tipo: NonNullable<ItemNutricional["tipoCantidad"]>; original?: string }

/**
 * Traduce el contexto de un alimento a gramos.
 * Prioridad: masa explícita → volumen (si líquido) → unidad nombrada → cuenta simple.
 */
function gramosDe(contexto: string, alimento: Alimento): CantidadInterpretada {
  // 1. Masa explícita: "50 gr", "1,5 kg"
  const masa = contexto.match(new RegExp(`${CANTIDAD}\\s*(kg|kilos?|g|gr|grs|gramos?)\\b`));
  if (masa) {
    const n = aNumero(masa[1]);
    if (n !== null) return { gramos: /^k/.test(masa[2]) ? n * 1000 : n, tipo: "masa_declarada", original: masa[0] };
  }

  // 2. Volumen para líquidos: "200 ml", "1 l"
  if (alimento.liquido) {
    const vol = contexto.match(new RegExp(`${CANTIDAD}\\s*(l|litros?|ml|cl)\\b`));
    if (vol) {
      const n = aNumero(vol[1]);
      if (n !== null) {
        const gramos = /^l/.test(vol[2]) ? n * 1000 : vol[2] === "cl" ? n * 10 : n;
        return { gramos, tipo: "volumen_declarado", original: vol[0] };
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
      return { gramos: (n ?? 1) * gramos, tipo: "unidades_declaradas", original: m[0].trim() };
    }
  }

  // 4. Cuenta simple: "2 huevos" → 2 porciones
  const cuenta = contexto.match(new RegExp(`${CANTIDAD}(?!\\s*(?:kg|kilos?|g|gr|grs|gramos?|l|litros?|ml|cl)\\b)`));
  const n = cuenta ? aNumero(cuenta[1]) : 1;
  return { gramos: (n ?? 1) * (cuenta ? alimento.unidades?.unidad ?? alimento.porcion : alimento.porcion), tipo: cuenta ? "unidades_declaradas" : "porcion_supuesta", original: cuenta ? `${cuenta[0]} unidades` : undefined };
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

  const ordenadas = encontradas.sort((a, b) => a.inicio - b.inicio);
  // "ensalada de lechuga" activa dos sinónimos del mismo alimento. Conservamos
  // el término específico y evitamos duplicar toda la guarnición.
  return ordenadas.filter((actual, indice) => {
    const siguiente = ordenadas[indice + 1];
    if (!siguiente || siguiente.alimento !== actual.alimento) return true;
    const puente = texto.slice(actual.fin, siguiente.inicio).trim();
    const contenedor = /^(ensalada|verdura|verduras)$/.test(texto.slice(actual.inicio, actual.fin));
    return !contenedor || (puente !== "" && puente !== "de");
  });
}

// Una coma decimal no separa ingredientes: «1,5 kg» debe conservarse entero.
const SEPARADOR = /\s*(?:(?<!\d),|,(?!\d)|\by\b|\bcon\b|\bmas\b|\+|\n|;)\s*/;

/** Residuo conservador: mostramos texto sin interpretar, no afirmamos que sea
 * una lista perfecta de ingredientes. Nunca se convierte en calorías ocultas. */
function fragmentosNoInterpretados(texto: string, coincidencias: Coincidencia[]): string[] {
  const mascara = texto.split("");
  for (const c of coincidencias) for (let p = c.inicio; p < c.fin; p++) mascara[p] = " ";
  return [...new Set(mascara.join("").split(SEPARADOR).map(parte => parte
    .replace(new RegExp(`${CANTIDAD}\\s*(?:kg|kilos?|g|gr|grs|gramos?|ml|cl|litros?|l|cucharadas?|cda|cucharaditas?|cdta|filetes?|lonchas?|rebanadas?|latas?|vasos?|tazas?|unidades?|piezas?)?\\b`, "g"), " ")
    .replace(/\b(?:de|del|la|el|los|las|a|al|en|un|una|unos|unas|y|con|sin|para|por|sobre|ensalada|bowl|bol|plato|bocadillo|tortilla|acompanad[oa]s?|aderezad[oa]s?|cocinad[oa]s?|saltead[oa]s?|rehogad[oa]s?|cocid[oa]s?|guisad[oa]s?|cocinado|crudo|cruda|peso|plancha|horno|vapor|asado|asada|dados|tiras|rallad[oa]|pelad[oa]s?|escurrid[oa]s?|virgen|extra|fresco|fresca|caser[oa]|natural|entera|entero|piel|rodajas|laminas|templad[oa]|pure|hecho|blanco|eneldo|guindilla|sal)\b/g, " ")
    .replace(/[().:·≈]/g, " ").replace(/\s+/g, " ").trim())
    .filter(parte => /[a-z]{2}/.test(parte)))];
}

type EstadoPeso = "crudo" | "cocinado";

function estadoPesoPara(contexto: string, alimento: Alimento, aclaracion?: string): EstadoPeso {
  if (!alimento.absorcionAgua && !alimento.mermaAgua) return "crudo";
  if (aclaracion === "ya cocinado" || /\b(?:peso\s+)?(?:ya\s+)?cocinad[oa]s?\b|\b(?:peso\s+)?cocid[oa]s?\b|\bhervid[oa]s?\b|\bguisad[oa]s?\b/.test(contexto)) return "cocinado";
  // Regla de RITMO: si no se especifica lo contrario, el peso declarado es
  // crudo/fresco/limpio. El método de preparación no cambia esa premisa.
  return "crudo";
}

function referenciaPara(alimento: Alimento, estado: EstadoPeso = "crudo") {
  const referencia = referenciaLocal(alimento.claves[0], alimento);
  const factor = estado === "cocinado"
    ? alimento.absorcionAgua ?? (alimento.mermaAgua ? 1 - alimento.mermaAgua : 1)
    : 1;
  if (factor === 1) return referencia;
  const dividir = (valor: number) => Math.round(valor / factor * 100) / 100;
  return {
    ...referencia,
    id: `${referencia.id}:${estado}`,
    nombre: `${referencia.nombre} · peso cocinado`,
    fuente: alimento.absorcionAgua
      ? `Catálogo RITMO · cocción calculada con absorción de agua ×${factor}`
      : `Catálogo RITMO · cocción calculada con merma de agua ${Math.round((alimento.mermaAgua ?? 0) * 100)}%`,
    por100g: {
      kcal: dividir(referencia.por100g.kcal),
      proteinas: dividir(referencia.por100g.proteinas),
      carbohidratos: dividir(referencia.por100g.carbohidratos),
      grasas: dividir(referencia.por100g.grasas),
    },
  };
}

/** Catálogo auditable también sin analizar una comida. */
export const CATALOGO_NUTRICIONAL = [
  ...DB.flatMap(alimento => alimento.absorcionAgua || alimento.mermaAgua
    ? [referenciaPara(alimento), referenciaPara(alimento, "cocinado")]
    : [referenciaPara(alimento)]),
  ...Object.values(REFERENCIAS_VERIFICADAS),
];

/** Recalcula una fila interpretada por IA con el mismo catálogo que el motor local. */
export function recalcularItemConCatalogo(item: ItemNutricional, estado: EstadoPeso = "crudo"): ItemNutricional {
  if (!item.gramos || item.gramos <= 0) return item;
  const coincidencia = localizar(sinTildes(item.nombre))[0];
  if (!coincidencia) return item;
  const referencia = referenciaPara(coincidencia.alimento, estado);
  const factor = item.gramos / 100;
  return {
    ...item,
    referencia,
    kcal: Math.round(referencia.por100g.kcal * factor),
    proteinas: Math.round(referencia.por100g.proteinas * factor * 10) / 10,
    carbohidratos: Math.round(referencia.por100g.carbohidratos * factor * 10) / 10,
    grasas: Math.round(referencia.por100g.grasas * factor * 10) / 10,
  };
}

/** Estima kcal y macros a partir de texto libre, sin IA externa. */
export function estimarOffline(texto: string): AnalisisNutricional {
  const normalizado = sinTildes(texto);
  const aceiteTotal = normalizado.match(/aclaracion: cantidad total de aceite del plato\s*:?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)/);
  const estadoCoccion = normalizado.match(/aclaracion: el peso de arroz o pasta indicado es\s*:?\s*(en crudo|ya cocinado)/)?.[1];
  // Las aclaraciones son metadatos del plato, no ingredientes adicionales.
  let base = normalizado.replace(/\n?\s*aclaracion:[^\n]*/g, "");
  if (aceiteTotal) {
    base = base.replace(/\b(?:aceite(?: de oliva(?: virgen extra)?)?|aove)\b/g, " ");
    base += `; ${aceiteTotal[1]} ${aceiteTotal[2]} de aceite de oliva`;
  }
  const limpio = base
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
    let sufijo = limpio.slice(c.fin, inicioSiguiente).split(SEPARADOR)[0] ?? "";
    // «arroz 150 g de pollo»: la cantidad antes del siguiente ingrediente no
    // pertenece también al arroz. Una cantidad pospuesta «pan de 50 g» sí.
    if (i < coincidencias.length - 1) sufijo = sufijo.replace(new RegExp(`${CANTIDAD}\\s*(?:kg|g|gr|gramos?|ml|filetes?|lonchas?)?\\s+de\\s*$`), "");
    // La propia palabra entra en el contexto porque a veces ES la unidad
    // ("2 cañas" → caña = 200 ml, no 2 tercios).
    const surface = limpio.slice(c.inicio, c.fin);
    const contexto = `${prefijo} ${surface} ${sufijo}`;

    const cantidad = gramosDe(contexto, c.alimento);
    if (cantidad.gramos > 10000) throw new Error("Hay una cantidad superior a 10.000 g. Revisa los gramos y las unidades de la descripción.");
    const gramos = Math.max(0, cantidad.gramos);
    const estadoPeso = estadoPesoPara(contexto, c.alimento, estadoCoccion);
    const referencia = referenciaPara(c.alimento, estadoPeso);
    const alimento = referencia.por100g;
    const f = gramos / 100;
    const pesoTexto = `${Number(gramos.toFixed(2)).toLocaleString("es-ES", { useGrouping: false })} g`;

    items.push({
      nombre: `${limpio.slice(c.inicio, c.fin)} · ${Math.round(gramos)} g`,
      cantidad: `${cantidad.tipo === "masa_declarada" ? pesoTexto : `${cantidad.original ? `${cantidad.original} · ` : ""}≈${pesoTexto}`}${(c.alimento.absorcionAgua || c.alimento.mermaAgua) && cantidad.tipo === "masa_declarada" ? ` · peso ${estadoPeso}` : ""}`,
      cantidadEstimada: cantidad.tipo !== "masa_declarada",
      tipoCantidad: cantidad.tipo,
      cantidadOriginal: cantidad.original,
      gramos,
      referencia,
      kcal: Math.round(alimento.kcal * f),
      proteinas: Math.round(alimento.proteinas * f * 10) / 10,
      carbohidratos: Math.round(alimento.carbohidratos * f * 10) / 10,
      grasas: Math.round(alimento.grasas * f * 10) / 10,
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
    noReconocidos: fragmentosNoInterpretados(limpio, coincidencias),
    fuente: "offline",
    aviso:
      items.length === 0
        ? "No se reconoció ningún alimento. Escribe las kcal a mano si lo prefieres."
        : "Estimación aproximada · puedes editar cualquier valor.",
  };
}
