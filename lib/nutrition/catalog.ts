import type { ItemNutricional, ReferenciaNutricional } from "./types";

export const VERSION_CATALOGO = "2026-09-15.1";

// Transcripción contrastada con la ficha completa de FoodData Central, no con
// resultados redondeados del buscador. Nutrientes USDA 1008/1003/1005/1004 por 100 g.
// La fuente describe alimentos de referencia: no certifica el plato del usuario.
function usda(id: number, nombre: string, kcal: number, proteinas: number, carbohidratos: number, grasas: number): ReferenciaNutricional {
  return { id: `usda:${id}`, version: VERSION_CATALOGO, nombre, estado: "verificada",
    fuente: `USDA FoodData Central · SR Legacy · ${id} · publicado 01/04/2019`,
    url: `https://fdc.nal.usda.gov/food-details/${id}/nutrients`, revisadaEn: "2026-09-15",
    por100g: { kcal, proteinas, carbohidratos, grasas } };
}

export const REFERENCIAS_VERIFICADAS = {
  arroz_cocido: usda(169757, "Arroz blanco de grano largo, cocido sin sal", 130, 2.69, 28.17, 0.28),
  arroz_crudo: usda(169756, "Arroz blanco de grano largo, crudo", 365, 7.13, 79.95, 0.66),
  pasta_cocida: usda(168928, "Pasta cocida, sin enriquecer y sin sal añadida", 158, 5.8, 30.86, 0.93),
  pasta_cruda: usda(168927, "Pasta seca, sin enriquecer", 371, 13.04, 74.67, 1.51),
  aceite_oliva: usda(171413, "Aceite de oliva para ensalada o cocina", 884, 0, 0, 100),
  pollo_pechuga_plancha: usda(171534, "Pechuga de pollo sin piel, cocinada a la parrilla", 151, 30.54, 0, 3.17),
  huevo_cocido: usda(173424, "Huevo entero cocido", 155, 12.58, 1.12, 10.61),
  platano_crudo: usda(173944, "Plátano crudo", 89, 1.09, 22.84, 0.33),
};

export function referenciaLocal(nombre: string, datos: { kcal: number; p: number; c: number; g: number }): ReferenciaNutricional {
  // Identificador canónico, independiente del orden del catálogo.
  const id = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id: `ritmo-local:${id}`, version: VERSION_CATALOGO, nombre,
    estado: "local_pendiente", fuente: "Catálogo RITMO · referencia estándar por 100 g",
    por100g: { kcal: datos.kcal, proteinas: datos.p, carbohidratos: datos.c, grasas: datos.g } };
}

/** Solo una masa explícita es peso indicado; piezas/volúmenes conservan su incertidumbre. */
export function etiquetaCantidad(item: ItemNutricional): string {
  if (item.cantidadAprendida) return "Porción aprendida";
  switch (item.tipoCantidad) {
    case "masa_declarada": return "Peso indicado";
    case "volumen_declarado": return "Volumen · peso aprox.";
    case "unidades_declaradas": return "Unidades · peso aprox.";
    default: return item.cantidadEstimada === false ? "Cantidad indicada" : "Porción supuesta";
  }
}

export function corregirGramos(item: ItemNutricional, gramos: number): ItemNutricional {
  if (!Number.isFinite(gramos) || gramos <= 0 || gramos > 10000) throw new Error("Indica un peso entre 0 y 10.000 g.");
  if (!item.referencia) throw new Error("Este ingrediente no tiene valores por 100 g. Corrige sus nutrientes manualmente.");
  const base = item.referencia.por100g;
  const escalar = (n: number) => Math.round(n * gramos / 100 * 10) / 10;
  return { ...item, nombre: item.nombre.split(" · ")[0], gramos,
    cantidad: `${gramos.toLocaleString("es-ES", { maximumFractionDigits: 2, useGrouping: false })} g`,
    cantidadOriginal: item.cantidadOriginal ?? `${gramos} g`, tipoCantidad: "masa_declarada", cantidadEstimada: false,
    kcal: Math.round(base.kcal * gramos / 100), proteinas: escalar(base.proteinas),
    carbohidratos: escalar(base.carbohidratos), grasas: escalar(base.grasas) };
}

/** Se comparte con importación/almacenamiento: una referencia incompleta no
 * debe romper la tabla ni introducir enlaces arbitrarios desde un archivo. */
export function metadataIngredienteValida(v: Record<string, unknown>): boolean {
  const num = (x: unknown, max: number) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max;
  const str = (x: unknown, max: number) => typeof x === "string" && x.length <= max;
  if (v.gramos !== undefined && !num(v.gramos, 240000)) return false;
  if (v.cantidadOriginal !== undefined && !str(v.cantidadOriginal, 500)) return false;
  if (v.unidades !== undefined && !num(v.unidades, 1000)) return false;
  if (v.unidad !== undefined && !str(v.unidad, 40)) return false;
  if (v.cantidadAprendida !== undefined && typeof v.cantidadAprendida !== "boolean") return false;
  if (v.tipoCantidad !== undefined && !["masa_declarada", "volumen_declarado", "unidades_declaradas", "porcion_supuesta"].includes(String(v.tipoCantidad))) return false;
  if (v.referencia === undefined) return true;
  if (!v.referencia || typeof v.referencia !== "object" || Array.isArray(v.referencia)) return false;
  const r = v.referencia as Record<string, unknown>;
  if (!["verificada", "local_pendiente", "correccion_personal"].includes(String(r.estado))
    || !str(r.id, 200) || !str(r.version, 100) || !str(r.nombre, 500) || !str(r.fuente, 500)) return false;
  if (r.url !== undefined && (typeof r.url !== "string" || !/^https:\/\/fdc\.nal\.usda\.gov\/food-details\/\d+\/nutrients$/.test(r.url))) return false;
  if (r.revisadaEn !== undefined && (typeof r.revisadaEn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.revisadaEn))) return false;
  if (!r.por100g || typeof r.por100g !== "object" || Array.isArray(r.por100g)) return false;
  const base = r.por100g as Record<string, unknown>;
  return [base.kcal, base.proteinas, base.carbohidratos, base.grasas].every(n => num(n, 12000));
}
