export interface ReferenciaNutricional {
  id: string;
  version: string;
  nombre: string;
  estado: "verificada" | "local_pendiente" | "correccion_personal";
  fuente: string;
  url?: string;
  revisadaEn?: string;
  por100g: { kcal: number; proteinas: number; carbohidratos: number; grasas: number };
}

export interface ItemNutricional {
  nombre: string;
  /** Forma anterior escrita por el analizador; permite aprender un sinónimo al corregir el nombre. */
  aliasOrigen?: string;
  /** Cantidad interpretada por el analizador (p. ej. "2 filetes · 260 g"). */
  cantidad?: string;
  cantidadEstimada?: boolean;
  tipoCantidad?: "masa_declarada" | "volumen_declarado" | "unidades_declaradas" | "porcion_supuesta";
  cantidadOriginal?: string;
  gramos?: number;
  /** Cuenta y unidad detectadas, para aprender el tamaño habitual de la persona. */
  unidades?: number;
  unidad?: string;
  /** La masa se ha inferido de una corrección anterior de la misma unidad. */
  cantidadAprendida?: boolean;
  referencia?: ReferenciaNutricional;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
}

export interface CorreccionNutricional extends ItemNutricional {
  clave: string;
  aliases?: string[];
  actualizada: number;
}

export interface AnalisisNutricional {
  resumen: string;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  items: ItemNutricional[];
  fuente: "gemini" | "claude" | "offline" | "edamam" | "openfoodfacts";
  confianza?: "alta" | "media" | "baja";
  observaciones?: string[];
  aviso?: string;
  /** Fragmentos no interpretados; nunca se añaden al total como alimentos. */
  noReconocidos?: string[];
}
