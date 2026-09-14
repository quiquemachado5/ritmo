import { pesajes } from "../model/analytics";
import type { Estado } from "../model/types";
import type { PrediccionEmitida, ResultadoPrediccion } from "./types";
import { VERSION_MODELO_ESTABLE } from "./lifecycle";
import { estadoAlcoholDia } from "../model/fluid-retention";
import { sumarDias } from "../model/dates";

export const VERSION_MODELO_AUDITADO = VERSION_MODELO_ESTABLE;

/** Solo fecha exacta y pronósticos sellados en un día anterior; no interpola. */
export function evaluarPredicciones(estado: Estado, predicciones: PrediccionEmitida[], fechaHoy: string, versionActual = VERSION_MODELO_AUDITADO) {
  const reales = new Map(pesajes(estado).filter((p) => p.fecha <= fechaHoy).map((p) => [p.fecha, p.peso]));
  const evaluadas: ResultadoPrediccion[] = [];
  const pendientes = new Set<string>();
  const sinPesaje = new Set<string>();
  for (const p of predicciones) {
    if (p.fechaObjetivo <= p.fechaEmision || !Number.isFinite(p.peso)) continue;
    const caso = `${p.fechaObjetivo}|${p.horizonteDias}`;
    if (p.fechaObjetivo > fechaHoy) { pendientes.add(caso); continue; }
    const real = reales.get(p.fechaObjetivo);
    if (real === undefined) { sinPesaje.add(caso); continue; }
    evaluadas.push({ ...p, pesoReal: real, errorKg: Math.abs(real - p.peso), errorFirmadoKg: p.peso - real, dentroIntervalo: real >= p.minimo && real <= p.maximo });
  }
  const resumen = (filas: ResultadoPrediccion[]) => {
    const errores = filas.map((p) => p.errorKg).sort((a, b) => a - b);
    return {
      casos: filas.length,
      maeKg: filas.length ? filas.reduce((s, p) => s + p.errorKg, 0) / filas.length : null,
      sesgoKg: filas.length ? filas.reduce((s, p) => s + p.errorFirmadoKg, 0) / filas.length : null,
      p90Kg: filas.length ? errores[Math.max(0, Math.ceil(errores.length * 0.9) - 1)] : null,
      coberturaPct: filas.length ? 100 * filas.filter((p) => p.dentroIntervalo).length / filas.length : null,
    };
  };
  const versiones = [...new Set(evaluadas.map((p) => p.versionModelo))]
    .map((version) => ({ version, ...resumen(evaluadas.filter((p) => p.versionModelo === version)) }))
    .sort((a, b) => b.version.localeCompare(a.version));
  const actuales = evaluadas.filter((p) => p.versionModelo === versionActual);
  return {
    ...resumen(evaluadas), pendientes: pendientes.size, sinPesaje: sinPesaje.size,
    actual: { version: versionActual, ...resumen(actuales) },
    versiones,
    evaluadas: actuales.sort((a, b) => b.fechaObjetivo.localeCompare(a.fechaObjetivo) || a.horizonteDias - b.horizonteDias),
    horizontes: ([1, 3, 7, 30] as const).map((dias) => ({ dias, ...resumen(actuales.filter((p) => p.horizonteDias === dias)) })),
    contextoAlcohol: {
      conAlcohol: resumen(actuales.filter((p) => estadoAlcoholDia(estado, sumarDias(p.fechaObjetivo, -1)) === "alcohol")),
      sinAlcohol: resumen(actuales.filter((p) => estadoAlcoholDia(estado, sumarDias(p.fechaObjetivo, -1)) === "sin-alcohol")),
    },
  };
}
