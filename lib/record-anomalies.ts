import type { Composicion } from "./model/types";
import type { ItemNutricional } from "./nutrition/types";
import { diasEntre } from "./model/dates";
import { normalizarNombreIngrediente } from "./nutrition/corrections";

export interface RecordAnomaly {
  code: string;
  message: string;
}

interface MealValues {
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  items?: ItemNutricional[];
}

function cantidadBase(cantidad?: string): number | null {
  const coincidencia = cantidad?.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/);
  if (!coincidencia) return null;
  const valor = Number(coincidencia[1].replace(",", "."));
  if (!Number.isFinite(valor)) return null;
  return coincidencia[2] === "kg" || coincidencia[2] === "l" ? valor * 1_000 : valor;
}

export function detectarAnomaliasComida(valores: MealValues): RecordAnomaly[] {
  const avisos: RecordAnomaly[] = [];
  const kcalMacros = valores.proteinas * 4 + valores.carbohidratos * 4 + valores.grasas * 9;

  if (valores.kcal > 3_500) {
    avisos.push({ code: "meal-kcal-high", message: `${Math.round(valores.kcal)} kcal en una sola comida es un valor poco habitual.` });
  }
  if (kcalMacros > 100 && Math.abs(valores.kcal - kcalMacros) > Math.max(80, valores.kcal * 0.15)) {
    avisos.push({ code: "meal-macros-mismatch", message: "Las kcal no encajan con la energía aproximada de los macronutrientes." });
  }

  const vistos = new Set<string>();
  let grasaCocinado = 0;
  for (const item of valores.items ?? []) {
    const cantidad = cantidadBase(item.cantidad);
    const nombre = normalizarNombreIngrediente(item.nombre);
    const clave = `${nombre}|${normalizarNombreIngrediente(item.cantidad ?? "")}`;
    if (vistos.has(clave) && clave !== "|") {
      avisos.push({ code: `ingredient-duplicate-${nombre}`, message: `Parece que ${item.nombre} está contado dos veces con la misma cantidad.` });
    }
    vistos.add(clave);
    if (cantidad != null && cantidad > 2_500) {
      avisos.push({ code: `ingredient-quantity-${item.nombre}`, message: `Revisa la cantidad de ${item.nombre}: ${item.cantidad}.` });
    }
    if (item.kcal > 2_000) {
      avisos.push({ code: `ingredient-kcal-${item.nombre}`, message: `${item.nombre} aporta más de 2.000 kcal según el análisis.` });
    }
    const energiaItem = item.proteinas * 4 + item.carbohidratos * 4 + item.grasas * 9;
    if (energiaItem > 50 && Math.abs(item.kcal - energiaItem) > Math.max(35, item.kcal * 0.2)) {
      avisos.push({ code: `ingredient-macros-${nombre}`, message: `Las kcal de ${item.nombre} no encajan con sus macronutrientes.` });
    }
    if (cantidad != null && /\b(aceite|aove|mantequilla)\b/.test(nombre)) grasaCocinado += cantidad;
  }
  if (grasaCocinado > 30) avisos.push({ code: "cooking-fat-high", message: `El plato suma unos ${Math.round(grasaCocinado)} g de aceite o grasa de cocinado. Comprueba que no se haya duplicado.` });

  return avisos.slice(0, 3);
}

interface MeasurementContext {
  measurement: Composicion;
  reference?: Pick<Composicion, "fecha" | "peso"> | null;
}

export function detectarAnomaliasMedicion({ measurement, reference }: MeasurementContext): RecordAnomaly[] {
  const avisos: RecordAnomaly[] = [];
  const { peso } = measurement;

  if (peso < 30 || peso > 300) {
    avisos.push({ code: "weight-range", message: `Comprueba el peso: ${peso.toLocaleString("es-ES")} kg está fuera del rango habitual.` });
  }
  if (reference && reference.fecha !== measurement.fecha) {
    const distancia = Math.abs(diasEntre(reference.fecha, measurement.fecha));
    const cambio = Math.abs(peso - reference.peso);
    if (distancia <= 7 && cambio >= 4) {
      avisos.push({ code: "weight-jump", message: `Son ${cambio.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kg de diferencia respecto al pesaje cercano del ${reference.fecha}.` });
    }
  }
  if (measurement.grasaPct != null && (measurement.grasaPct < 3 || measurement.grasaPct > 65)) {
    avisos.push({ code: "body-fat-range", message: `Revisa el porcentaje de grasa: ${measurement.grasaPct}%.` });
  }
  if (measurement.aguaPct != null && (measurement.aguaPct < 20 || measurement.aguaPct > 80)) {
    avisos.push({ code: "water-range", message: `Revisa el porcentaje de agua: ${measurement.aguaPct}%.` });
  }
  if (measurement.masaMuscularKg != null && measurement.masaMuscularKg > peso) {
    avisos.push({ code: "muscle-over-weight", message: "La masa muscular no puede superar el peso total." });
  }
  if (measurement.cintura != null && (measurement.cintura < 35 || measurement.cintura > 250)) {
    avisos.push({ code: "waist-range", message: `Revisa la cintura: ${measurement.cintura} cm.` });
  }
  if (measurement.cadera != null && (measurement.cadera < 35 || measurement.cadera > 250)) {
    avisos.push({ code: "hip-range", message: `Revisa la cadera: ${measurement.cadera} cm.` });
  }
  if (measurement.metabBasalKcal != null && (measurement.metabBasalKcal < 700 || measurement.metabBasalKcal > 5_000)) {
    avisos.push({ code: "bmr-range", message: `Revisa el metabolismo basal: ${measurement.metabBasalKcal} kcal.` });
  }
  if (measurement.gastoDiarioKcal != null && (measurement.gastoDiarioKcal < 800 || measurement.gastoDiarioKcal > 7_000)) {
    avisos.push({ code: "tdee-range", message: `Revisa el gasto diario: ${measurement.gastoDiarioKcal} kcal.` });
  }

  return avisos.slice(0, 3);
}
