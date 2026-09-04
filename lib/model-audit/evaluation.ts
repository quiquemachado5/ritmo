import { pesajes } from "../model/analytics";
import type { Estado } from "../model/types";
import type { PrediccionEmitida, ResultadoPrediccion } from "./types";

export const VERSION_MODELO_AUDITADO = "ritmo-2026-09-v1";

/** Solo fecha exacta y pronósticos sellados en un día anterior; no interpola. */
export function evaluarPredicciones(estado: Estado, predicciones: PrediccionEmitida[], fechaHoy: string) {
  const reales = new Map(pesajes(estado).filter((p) => p.fecha <= fechaHoy).map((p) => [p.fecha, p.peso]));
  const evaluadas: ResultadoPrediccion[] = [];
  let pendientes = 0;
  let sinPesaje = 0;
  for (const p of predicciones) {
    if (p.fechaObjetivo <= p.fechaEmision || !Number.isFinite(p.peso)) continue;
    if (p.fechaObjetivo > fechaHoy) { pendientes++; continue; }
    const real = reales.get(p.fechaObjetivo);
    if (real === undefined) { sinPesaje++; continue; }
    evaluadas.push({ ...p, pesoReal: real, errorKg: Math.abs(real - p.peso), dentroIntervalo: real >= p.minimo && real <= p.maximo });
  }
  const resumen = (filas: ResultadoPrediccion[]) => ({
    casos: filas.length,
    maeKg: filas.length ? filas.reduce((s, p) => s + p.errorKg, 0) / filas.length : null,
    coberturaPct: filas.length ? 100 * filas.filter((p) => p.dentroIntervalo).length / filas.length : null,
  });
  return {
    ...resumen(evaluadas), pendientes, sinPesaje,
    evaluadas: evaluadas.sort((a, b) => b.fechaObjetivo.localeCompare(a.fechaObjetivo) || a.horizonteDias - b.horizonteDias),
    horizontes: ([1, 3, 7, 30] as const).map((dias) => ({ dias, ...resumen(evaluadas.filter((p) => p.horizonteDias === dias)) })),
  };
}
