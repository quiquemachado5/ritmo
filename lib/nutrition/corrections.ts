import type { AnalisisNutricional, ItemNutricional } from "./types";

export function normalizarNombreIngrediente(nombre: string): string {
  return nombre.trim().toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function recalcularAnalisis(analisis: AnalisisNutricional, items: ItemNutricional[]): AnalisisNutricional {
  const total = items.reduce(
    (suma, item) => ({
      kcal: suma.kcal + item.kcal,
      proteinas: suma.proteinas + item.proteinas,
      carbohidratos: suma.carbohidratos + item.carbohidratos,
      grasas: suma.grasas + item.grasas,
    }),
    { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  );
  return {
    ...analisis,
    items,
    kcal: Math.round(total.kcal),
    proteinas: Math.round(total.proteinas),
    carbohidratos: Math.round(total.carbohidratos),
    grasas: Math.round(total.grasas),
  };
}
