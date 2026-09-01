import type { Comida, Dia } from "@/lib/model/types";

export function sumaKcalComidas(comidas: Comida[] | undefined): number | null {
  if (!comidas || comidas.length === 0) return null;
  return Math.round(comidas.reduce((total, comida) => total + (comida.kcal || 0), 0));
}

/** Mantiene comidas y total calórico como una única fuente de verdad. */
export function recalcularKcalComidas(dia: Dia, comidasActualizadas: boolean): Dia {
  if (!comidasActualizadas) return dia;
  const siguiente = { ...dia };
  const suma = sumaKcalComidas(siguiente.comidas);
  if (suma === null) {
    delete siguiente.comidas;
    delete siguiente.kcalConsumidas;
  } else {
    siguiente.kcalConsumidas = suma;
  }
  return siguiente;
}
