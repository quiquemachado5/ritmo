import { estimarOffline } from "./offline";
import { normalizarNombreIngrediente, recalcularAnalisis } from "./corrections";
import type { CorreccionNutricional } from "./types";

/** Sin llamadas de red ni claves; reutiliza correcciones solo para igual cantidad. */
export function analizarLocal(texto: string, correcciones: CorreccionNutricional[] = []) {
  if (!texto.trim() || texto.length > 2500) throw new Error("Describe la comida en un máximo de 2.500 caracteres.");
  const base = estimarOffline(texto);
  let usadas = 0;
  const nombre = (s: string) => normalizarNombreIngrediente(s.split(" · ")[0]);
  const items = base.items.map(item => {
    const correccion = correcciones.find(c => c.cantidad && item.cantidad
      && nombre(c.nombre) === nombre(item.nombre)
      && normalizarNombreIngrediente(c.cantidad) === normalizarNombreIngrediente(item.cantidad)
      && [c.kcal, c.proteinas, c.carbohidratos, c.grasas].every(n => Number.isFinite(n) && n >= 0 && n <= 6000));
    if (!correccion) return item;
    usadas++;
    return { ...item, kcal: correccion.kcal, proteinas: correccion.proteinas, carbohidratos: correccion.carbohidratos, grasas: correccion.grasas, cantidadEstimada: false };
  });
  return { ...recalcularAnalisis(base, items), confianza: "baja" as const,
    aviso: items.length ? "Estimación local, sin IA externa. Revisa los ingredientes reconocidos y las cantidades; puede faltar algún alimento." : base.aviso,
    observaciones: usadas ? [usadas === 1 ? "Se ha reutilizado una corrección tuya para la misma cantidad." : `Se han reutilizado ${usadas} correcciones tuyas para la misma cantidad.`] : undefined };
}
