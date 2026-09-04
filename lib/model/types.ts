/* ============================================================================
   TIPOS DEL MODELO — RITMO
   Un día se identifica siempre por su fecha ISO local 'YYYY-MM-DD'.
   ========================================================================= */

export type Sexo = "hombre" | "mujer";
export type Objetivo = "perder" | "mantener" | "ganar";
export type TipoComida = "desayuno" | "comida" | "cena" | "snack";

export type Habitos = Record<string, boolean>;

export interface HabitoPersonalizado {
  clave: string;
  etiqueta: string;
  codigo: string;
  icono: string;
}

/** Una entrada de nutrición en lenguaje natural, ya resuelta a macros. */
export interface Comida {
  id: string;
  tipo: TipoComida;
  texto: string;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  /** Procedencia del cálculo; los valores siguen siendo estimaciones editables. */
  fuente?: "gemini" | "edamam" | "offline" | "claude" | "manual";
  estimado?: boolean;
  creado?: string; // ISO datetime
  ingredientes?: import("../nutrition/types").ItemNutricional[];
  racionesReceta?: number;
  porcionConsumida?: number;
}

export interface Dia {
  fecha: string;
  habitos: Habitos;
  peso?: number;
  kcalConsumidas?: number;
  kcalQuemadas?: number;
  grasaPct?: number;
  notas?: string;
  /* Extensiones RITMO */
  comidas?: Comida[];
}

export interface Composicion {
  fecha: string;
  peso: number;
  grasaPct?: number;
  masaMuscularKg?: number;
  imc?: number;
  grasaVisceral?: number;
  metabBasalKcal?: number;
  gastoDiarioKcal?: number;
  masaOseaKg?: number;
  aguaPct?: number;
  /* Medidas corporales (cm) */
  cintura?: number;
  cadera?: number;
  pecho?: number;
  brazo?: number;
  muslo?: number;
  cuello?: number;
}

export interface Perfil {
  nombre?: string;
  alturaCm: number;
  edad: number;
  sexo: Sexo;
  objetivo?: Objetivo;
  pesoObjetivo?: number;
  kcalObjetivo: number;
  proteinaObjetivo?: number;
  factorActividad: number;
  umbralRacha: number;
  /* Imputación de días sin registro */
  imputarActiva?: boolean;
  imputarDesde?: string;
  imputarSuperavitKcal?: number;
  /** Hábitos configurables por persona; los activos alimentan el modelo. */
  habitosPersonalizados?: HabitoPersonalizado[];
  /** Claves que se conservan en el historial pero se excluyen del modelo. */
  habitosDesactivados?: string[];
  onboardingCompleto?: boolean;
}

export interface Estado {
  perfil: Perfil;
  dias: Record<string, Dia>;
  composicion: Composicion[];
  version?: number;
}

export interface ReglaImputacion {
  activa: boolean;
  desde: string;
  superavitKcal: number;
}

export interface EnergiaDia {
  consumidas: number;
  quemadas: number;
  balance: number;
  deficit: number;
  deltaKg: number | null;
  estimado: boolean;
  consumidasEstimadas: boolean;
  quemadasEstimadas: boolean;
  /** Hay comidas registradas, pero falta la cena: el modelo completa la ingesta con hábitos. */
  ingestaIncompleta: boolean;
  /** Sin hábitos positivos: el modelo aplica un superávit conservador. */
  sinHabitosMarcados: boolean;
  sinRegistro: boolean;
  imputado: boolean;
}

export interface Pesaje {
  fecha: string;
  peso: number;
  dia: number; // día absoluto
}

export interface PesoIntervalo {
  peso: number;
  minimo: number;
  maximo: number;
  margen: number;
}
