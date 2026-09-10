import { estimarOffline } from "./offline";
import { normalizarNombreIngrediente, recalcularAnalisis } from "./corrections";
import type { AnalisisNutricional, CorreccionNutricional } from "./types";

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
    const factor = item.gramos && item.gramos > 0 ? 100 / item.gramos : null;
    return { ...item, kcal: correccion.kcal, proteinas: correccion.proteinas, carbohidratos: correccion.carbohidratos, grasas: correccion.grasas,
      // Corregir macros no convierte dos filetes en gramos realmente pesados.
      referencia: factor && item.referencia ? { ...item.referencia, estado: "correccion_personal" as const,
        fuente: "Tus valores corregidos para esta cantidad", url: undefined, revisadaEn: undefined,
        por100g: { kcal: correccion.kcal * factor, proteinas: correccion.proteinas * factor,
          carbohidratos: correccion.carbohidratos * factor, grasas: correccion.grasas * factor } } : undefined };
  });
  const proporcionEstimada = items.length ? items.filter(item => item.cantidadEstimada).length / items.length : 1;
  const completo = (base.noReconocidos?.length ?? 0) === 0;
  const confianza: NonNullable<AnalisisNutricional["confianza"]> = completo && proporcionEstimada === 0 ? "alta" : completo && proporcionEstimada < 0.5 ? "media" : "baja";
  return { ...recalcularAnalisis(base, items), confianza,
    aviso: items.length
      ? completo
        ? "Calculado ingrediente a ingrediente con el catálogo RITMO. Revisa las cantidades marcadas como aproximadas."
        : "Hay ingredientes sin calcular. Concreta su nombre y cantidad antes de guardar."
      : base.aviso,
    observaciones: usadas ? [usadas === 1 ? "Se ha reutilizado una corrección tuya para la misma cantidad." : `Se han reutilizado ${usadas} correcciones tuyas para la misma cantidad.`] : undefined };
}
