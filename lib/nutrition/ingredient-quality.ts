import type { ItemNutricional } from "./types";

export type NivelCalidadIngredientes = "alta" | "media" | "baja";

export interface CalidadIngredientes {
  nivel: NivelCalidadIngredientes;
  kcalAproximadas: number;
  porcentajeAproximado: number;
  prioridades: Array<{ indice: number; nombre: string; kcal: number }>;
}

/**
 * Resume cuánto depende el total de porciones inferidas. Se pondera por kcal:
 * una cucharada de aceite dudosa importa más que el peso de una hoja de lechuga.
 */
export function calidadIngredientes(items: ItemNutricional[]): CalidadIngredientes {
  const total = items.reduce((suma, item) => suma + Math.max(0, item.kcal), 0);
  const aproximados = items
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => item.cantidadEstimada !== false || item.tipoCantidad !== "masa_declarada");
  const kcalAproximadas = aproximados.reduce((suma, { item }) => suma + Math.max(0, item.kcal), 0);
  const porcentajeAproximado = total > 0 ? Math.round(kcalAproximadas / total * 100) : 100;
  const nivel: NivelCalidadIngredientes = porcentajeAproximado === 0
    ? "alta"
    : porcentajeAproximado <= 40
      ? "media"
      : "baja";

  return {
    nivel,
    kcalAproximadas: Math.round(kcalAproximadas),
    porcentajeAproximado,
    prioridades: aproximados
      .sort((a, b) => b.item.kcal - a.item.kcal)
      .slice(0, 2)
      .map(({ item, indice }) => ({ indice, nombre: item.nombre.split(" · ")[0], kcal: Math.round(item.kcal) })),
  };
}
