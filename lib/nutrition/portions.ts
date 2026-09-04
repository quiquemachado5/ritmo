import type { Comida } from "../model/types";
import type { ItemNutricional } from "./types";

export function factorPorcion(raciones: number, consumidas: number): number {
  if (!Number.isFinite(raciones) || !Number.isFinite(consumidas) || raciones < 1 || raciones > 24 || consumidas <= 0 || consumidas > raciones) throw new Error("Revisa las raciones preparadas y consumidas.");
  return consumidas / raciones;
}
export function escalarNutrientes<T extends Pick<Comida, "kcal" | "proteinas" | "carbohidratos" | "grasas">>(base: T, factor: number): T {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 24) throw new Error("Porción no válida.");
  return { ...base, kcal: Math.round(base.kcal * factor), proteinas: Math.round(base.proteinas * factor * 10) / 10,
    carbohidratos: Math.round(base.carbohidratos * factor * 10) / 10, grasas: Math.round(base.grasas * factor * 10) / 10 };
}
export function escalarIngrediente(item: ItemNutricional, factor: number): ItemNutricional {
  return { ...escalarNutrientes(item, factor), cantidad: factor === 1 ? item.cantidad : `${factor.toLocaleString("es-ES", { maximumFractionDigits: 2 })} × (${item.cantidad || "cantidad sin indicar"})` };
}
export interface ComidaPlanificada { id: string; fecha: string; comida: Comida; registrada?: boolean }
export interface Compra { nombre: string; cantidades: string[] }
export function listaCompra(plan: ComidaPlanificada[]): Compra[] {
  const grupos = new Map<string, Compra>();
  for (const entrada of plan.filter(p => !p.registrada)) {
    const ingredientes = entrada.comida.ingredientes?.length ? entrada.comida.ingredientes : [{ nombre: entrada.comida.texto, cantidad: "Revisar ingredientes" }];
    for (const item of ingredientes) {
      const key = item.nombre.toLocaleLowerCase("es-ES").trim();
      const grupo = grupos.get(key) ?? { nombre: item.nombre, cantidades: [] };
      grupo.cantidades.push(item.cantidad || "Cantidad por concretar"); grupos.set(key, grupo);
    }
  }
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
