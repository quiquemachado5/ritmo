export interface ItemNutricional {
  nombre: string;
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
  fuente: "claude" | "offline" | "edamam";
  aviso?: string;
}
