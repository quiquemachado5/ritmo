import { diasEntre, sumarDias } from "./dates";
import { perfilEnFecha } from "./profile-history";
import type { Dia, Estado } from "./types";

const RETENCION_ALCOHOL_PRIOR_KG = 0.45;
const DECAIMIENTO = [1, 0.45, 0.15] as const;

export interface ImpactoLiquidos {
  kg: number;
  incertidumbreKg: number;
  eventosAlcohol: number;
  fuente: "ninguna" | "generica" | "personalizada";
  muestrasPersonales: number;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[mitad]
    : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

function diaObservado(dia?: Dia): boolean {
  if (!dia) return false;
  return Object.keys(dia.habitos || {}).some((clave) => clave !== "noAlcohol")
    || Boolean(dia.comidas?.length)
    || Number.isFinite(dia.kcalConsumidas)
    || Number.isFinite(dia.kcalQuemadas);
}

/**
 * En un día pasado observado, no marcar «Sin alcohol» significa que hubo
 * alcohol. Un día completamente vacío sigue siendo desconocido, no consumo.
 */
export function estadoAlcoholDia(estado: Estado, fecha: string): "alcohol" | "sin-alcohol" | "desconocido" {
  if (perfilEnFecha(estado, fecha).habitosDesactivados?.includes("noAlcohol")) return "desconocido";
  const dia = estado.dias[fecha];
  if (dia?.habitos?.noAlcohol === true) return "sin-alcohol";
  return diaObservado(dia) ? "alcohol" : "desconocido";
}

interface CalibracionLiquidos {
  kgDiaSiguiente: number;
  personalizada: boolean;
  muestras: number;
}

const cache = new WeakMap<Estado, { version: number; valor: CalibracionLiquidos }>();

/** Aprende el exceso de cambio al día siguiente solo con pesajes consecutivos. */
export function calibracionLiquidosAlcohol(estado: Estado): CalibracionLiquidos {
  const guardada = cache.get(estado);
  if (guardada?.version === (estado.version ?? 0)) return guardada.valor;
  const porFecha = new Map<string, number>();
  for (const medicion of estado.composicion || []) porFecha.set(medicion.fecha, medicion.peso);
  for (const dia of Object.values(estado.dias || {})) {
    if (Number.isFinite(dia.peso)) porFecha.set(dia.fecha, dia.peso as number);
  }
  const puntos = [...porFecha.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const alcohol: number[] = [];
  const sinAlcohol: number[] = [];
  for (let i = 1; i < puntos.length; i++) {
    const [fechaAnterior, pesoAnterior] = puntos[i - 1];
    const [fecha, peso] = puntos[i];
    if (diasEntre(fechaAnterior, fecha) !== 1) continue;
    const estadoAlcohol = estadoAlcoholDia(estado, fechaAnterior);
    if (estadoAlcohol === "alcohol") alcohol.push(peso - pesoAnterior);
    if (estadoAlcohol === "sin-alcohol") sinAlcohol.push(peso - pesoAnterior);
  }
  const muestras = alcohol.length + sinAlcohol.length;
  const personalizada = alcohol.length >= 2 && sinAlcohol.length >= 3;
  const diferencia = personalizada ? mediana(alcohol) - mediana(sinAlcohol) : RETENCION_ALCOHOL_PRIOR_KG;
  const valor = {
    kgDiaSiguiente: Math.max(0.15, Math.min(1.2, diferencia)),
    personalizada,
    muestras,
  };
  cache.set(estado, { version: estado.version ?? 0, valor });
  return valor;
}

/**
 * Desviación transitoria esperada en la báscula. No entra en FM, FFM ni en el
 * balance energético y desaparece gradualmente en tres días.
 */
export function impactoLiquidosEnFecha(estado: Estado, fecha: string): ImpactoLiquidos {
  const calibracion = calibracionLiquidosAlcohol(estado);
  let kg = 0;
  let eventosAlcohol = 0;
  for (let indice = 0; indice < DECAIMIENTO.length; indice++) {
    if (estadoAlcoholDia(estado, sumarDias(fecha, -(indice + 1))) !== "alcohol") continue;
    kg += calibracion.kgDiaSiguiente * DECAIMIENTO[indice];
    eventosAlcohol++;
  }
  kg = Math.min(1.5, kg);
  return {
    kg: Math.round(kg * 100) / 100,
    incertidumbreKg: kg > 0 ? (calibracion.personalizada ? 0.2 : 0.35) : 0,
    eventosAlcohol,
    fuente: kg === 0 ? "ninguna" : calibracion.personalizada ? "personalizada" : "generica",
    muestrasPersonales: calibracion.muestras,
  };
}
