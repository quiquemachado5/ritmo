import { estimarOffline } from "./offline";
import { normalizarNombreIngrediente, recalcularAnalisis } from "./corrections";
import type { AnalisisNutricional, CorreccionNutricional } from "./types";

/** Sin llamadas de red ni claves; escala referencias personales cuando hay gramos comparables. */
export function analizarLocal(texto: string, correcciones: CorreccionNutricional[] = []) {
  if (!texto.trim() || texto.length > 2500) throw new Error("Describe la comida en un máximo de 2.500 caracteres.");
  const base = estimarOffline(texto);
  let usadas = 0;
  let porcionesAprendidas = 0;
  const nombre = (s: string) => normalizarNombreIngrediente(s.split(" · ")[0]);
  const coincideNombre = (correccion: CorreccionNutricional, item: { nombre: string }) => {
    const objetivo = nombre(item.nombre);
    return nombre(correccion.nombre) === objetivo || correccion.aliases?.includes(objetivo) === true;
  };
  const items = base.items.map(item => {
    const correccion = correcciones.find(c => c.cantidad && item.cantidad
      && coincideNombre(c, item)
      && normalizarNombreIngrediente(c.cantidad) === normalizarNombreIngrediente(item.cantidad)
      && [c.kcal, c.proteinas, c.carbohidratos, c.grasas].every(n => Number.isFinite(n) && n >= 0 && n <= 6000));
    if (!correccion) {
      const pesada = correcciones.find(c => c.gramos != null && item.gramos != null
        && coincideNombre(c, item) && c.gramos > 0 && item.gramos > 0
        && !(c.unidades != null && item.unidades != null && c.unidad != null && c.unidad === item.unidad)
        && [c.kcal, c.proteinas, c.carbohidratos, c.grasas].every(n => Number.isFinite(n) && n >= 0 && n <= 6000));
      if (pesada) {
        const factor = item.gramos! / pesada.gramos!;
        if (factor >= 0.2 && factor <= 5) {
          usadas++;
          return {
            ...item,
            kcal: Math.round(pesada.kcal * factor),
            proteinas: Math.round(pesada.proteinas * factor * 10) / 10,
            carbohidratos: Math.round(pesada.carbohidratos * factor * 10) / 10,
            grasas: Math.round(pesada.grasas * factor * 10) / 10,
            referencia: item.referencia ? {
              ...item.referencia,
              estado: "correccion_personal" as const,
              fuente: "Tus valores corregidos, ajustados al peso indicado",
              url: undefined,
              revisadaEn: undefined,
              por100g: {
                kcal: pesada.kcal * 100 / pesada.gramos!,
                proteinas: pesada.proteinas * 100 / pesada.gramos!,
                carbohidratos: pesada.carbohidratos * 100 / pesada.gramos!,
                grasas: pesada.grasas * 100 / pesada.gramos!,
              },
            } : item.referencia,
          };
        }
      }
      const aprendida = correcciones.find(c => c.gramos != null && c.unidades != null && item.unidades != null
        && c.unidad != null && c.unidad === item.unidad
        && coincideNombre(c, item)
        && c.gramos > 0 && c.unidades > 0 && item.unidades > 0);
      if (!aprendida || !item.referencia) return item;
      const gramos = Math.round((aprendida.gramos! / aprendida.unidades!) * item.unidades! * 10) / 10;
      const factor = gramos / 100;
      const base100 = item.referencia.por100g;
      porcionesAprendidas++;
      return {
        ...item,
        gramos,
        cantidad: `${item.cantidadOriginal ?? `${item.unidades} ${item.unidad}`} · ≈${gramos.toLocaleString("es-ES", { maximumFractionDigits: 1 })} g`,
        cantidadAprendida: true,
        kcal: Math.round(base100.kcal * factor),
        proteinas: Math.round(base100.proteinas * factor * 10) / 10,
        carbohidratos: Math.round(base100.carbohidratos * factor * 10) / 10,
        grasas: Math.round(base100.grasas * factor * 10) / 10,
      };
    }
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
  const observaciones = [
    ...(usadas ? [usadas === 1 ? "Se ha reutilizado una corrección tuya para la misma cantidad." : `Se han reutilizado ${usadas} correcciones tuyas para la misma cantidad.`] : []),
    ...(porcionesAprendidas ? [`RITMO ha aplicado ${porcionesAprendidas === 1 ? "una porción aprendida" : `${porcionesAprendidas} porciones aprendidas`} de tus correcciones.`] : []),
  ];
  return { ...recalcularAnalisis(base, items), confianza,
    aviso: items.length
      ? completo
        ? "Calculado ingrediente a ingrediente con el catálogo RITMO. Revisa las cantidades marcadas como aproximadas."
        : "Hay ingredientes sin calcular. Concreta su nombre y cantidad antes de guardar."
      : base.aviso,
    observaciones: observaciones.length ? observaciones : undefined };
}
