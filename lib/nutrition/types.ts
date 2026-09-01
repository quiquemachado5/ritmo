export interface ItemNutricional {
  nombre: string;
  /** Cantidad interpretada por el analizador (p. ej. "2 filetes · 260 g"). */
  cantidad?: string;
  cantidadEstimada?: boolean;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
}

export interface AnalisisNutricional {
  resumen: string;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  items: ItemNutricional[];
  fuente: "gemini" | "claude" | "offline" | "edamam";
  confianza?: "alta" | "media" | "baja";
  observaciones?: string[];
  aviso?: string;
}
