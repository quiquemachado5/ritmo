import type { AnalisisNutricional, ItemNutricional } from "./types";

export function energiaDesdeMacros(datos: Pick<AnalisisNutricional, "proteinas" | "carbohidratos" | "grasas">): number {
  return Math.round(datos.proteinas * 4 + datos.carbohidratos * 4 + datos.grasas * 9);
}

export function distribucionMacros(datos: Pick<AnalisisNutricional, "proteinas" | "carbohidratos" | "grasas">) {
  const energia = [datos.proteinas * 4, datos.carbohidratos * 4, datos.grasas * 9];
  const total = energia.reduce((suma, valor) => suma + valor, 0);
  if (total <= 0) return { proteinas: 0, carbohidratos: 0, grasas: 0 };
  const valores = energia.map(valor => Math.round(valor / total * 100));
  valores[1] += 100 - valores.reduce((suma, valor) => suma + valor, 0);
  return { proteinas: valores[0], carbohidratos: valores[1], grasas: valores[2] };
}

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
