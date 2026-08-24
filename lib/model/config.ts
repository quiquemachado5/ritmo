/* ============================================================================
   CONFIG DEL MODELO — hábitos y perfil por defecto.
   Las claves de hábito se conservan de la app anterior porque el modelo de
   estimación de energía y el histórico sembrado dependen de ellas.
   ========================================================================= */

import type { Perfil } from "./types";

export interface DefHabito {
  clave: string;
  etiqueta: string;
  codigo: string;
  /** Nombre de icono lucide (se resuelve en la UI). */
  icono: string;
}

export const HABITOS: DefHabito[] = [
  { clave: "comida", etiqueta: "Comida", codigo: "COM", icono: "UtensilsCrossed" },
  { clave: "cena", etiqueta: "Cena", codigo: "CEN", icono: "Soup" },
  { clave: "noAlcohol", etiqueta: "Sin alcohol", codigo: "0%", icono: "WineOff" },
  { clave: "deporte", etiqueta: "Deporte", codigo: "DEP", icono: "Dumbbell" },
  { clave: "beberAgua", etiqueta: "Beber agua", codigo: "AGU", icono: "Droplets" },
  { clave: "dormirBien", etiqueta: "Dormir bien", codigo: "ZZZ", icono: "Moon" },
];

export const TOTAL_HABITOS = HABITOS.length;

export const PERFIL_DEFECTO: Perfil = {
  alturaCm: 175,
  edad: 30,
  sexo: "hombre",
  objetivo: "perder",
  pesoObjetivo: 80,
  kcalObjetivo: 2000,
  proteinaObjetivo: undefined,
  factorActividad: 1.375,
  umbralRacha: 4,
  aguaObjetivoMl: 2500,
  pasosObjetivo: 8000,
  imputarActiva: true,
  imputarDesde: "2026-07-01",
  imputarSuperavitKcal: 500,
  onboardingCompleto: false,
};

export const VENTANA_GRAFICO = 120;
