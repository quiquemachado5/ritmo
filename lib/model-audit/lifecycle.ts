import { pesajes, type EstrategiaProyeccion } from "../model/analytics";
import type { Estado } from "../model/types";
import type { PrediccionEmitida } from "./types";

export const VERSION_MODELO_ESTABLE = "ritmo-2026-09-v3-liquidos";
export const VERSION_MODELO_CANDIDATO = "ritmo-2026-09-v4-conservador";

interface ComparacionPareada {
  fecha: string;
  errorEstable: number;
  errorCandidato: number;
  rangoEstable: boolean;
  rangoCandidato: boolean;
}

function paresEvaluables(estado: Estado, predicciones: PrediccionEmitida[], fechaHoy: string): ComparacionPareada[] {
  const reales = new Map(pesajes(estado).filter((p) => p.fecha <= fechaHoy).map((p) => [p.fecha, p.peso]));
  const grupos = new Map<string, Partial<Record<"estable" | "candidato", PrediccionEmitida>>>();
  for (const prediccion of predicciones) {
    if (prediccion.fechaObjetivo > fechaHoy || prediccion.fechaObjetivo <= prediccion.fechaEmision) continue;
    const rol = prediccion.versionModelo === VERSION_MODELO_ESTABLE
      ? "estable"
      : prediccion.versionModelo === VERSION_MODELO_CANDIDATO
        ? "candidato"
        : null;
    if (!rol || !reales.has(prediccion.fechaObjetivo)) continue;
    const clave = `${prediccion.fechaEmision}|${prediccion.fechaObjetivo}|${prediccion.horizonteDias}`;
    grupos.set(clave, { ...grupos.get(clave), [rol]: prediccion });
  }
  return [...grupos.values()].flatMap((grupo) => {
    if (!grupo.estable || !grupo.candidato) return [];
    const real = reales.get(grupo.estable.fechaObjetivo)!;
    return [{
      fecha: grupo.estable.fechaObjetivo,
      errorEstable: Math.abs(real - grupo.estable.peso),
      errorCandidato: Math.abs(real - grupo.candidato.peso),
      rangoEstable: real >= grupo.estable.minimo && real <= grupo.estable.maximo,
      rangoCandidato: real >= grupo.candidato.minimo && real <= grupo.candidato.maximo,
    }];
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function resumen(pares: ComparacionPareada[]) {
  const media = (valores: number[]) => valores.reduce((suma, valor) => suma + valor, 0) / Math.max(1, valores.length);
  return {
    casos: pares.length,
    fechas: new Set(pares.map((par) => par.fecha)).size,
    maeEstableKg: pares.length ? media(pares.map((par) => par.errorEstable)) : null,
    maeCandidatoKg: pares.length ? media(pares.map((par) => par.errorCandidato)) : null,
    coberturaEstablePct: pares.length ? 100 * pares.filter((par) => par.rangoEstable).length / pares.length : null,
    coberturaCandidatoPct: pares.length ? 100 * pares.filter((par) => par.rangoCandidato).length / pares.length : null,
  };
}

function promocionValida(pares: ComparacionPareada[]) {
  const r = resumen(pares);
  return r.casos >= 12 && r.fechas >= 4
    && r.maeEstableKg !== null && r.maeCandidatoKg !== null
    && r.maeCandidatoKg <= r.maeEstableKg * 0.92
    && (r.coberturaCandidatoPct ?? 0) >= (r.coberturaEstablePct ?? 0) - 5;
}

export interface CicloModelo {
  estado: "sombra" | "activo" | "revertido";
  estrategia: EstrategiaProyeccion;
  versionActiva: string;
  pares: number;
  fechas: number;
  maeEstableKg: number | null;
  maeCandidatoKg: number | null;
  motivo: string;
}

/** Promoción y reversión derivadas solo de predicciones selladas y pesos posteriores. */
export function evaluarCicloModelos(estado: Estado, predicciones: PrediccionEmitida[], fechaHoy: string): CicloModelo {
  const pares = paresEvaluables(estado, predicciones, fechaHoy);
  const total = resumen(pares);
  let indicePromocion = -1;
  for (let i = 11; i < pares.length; i++) {
    if (promocionValida(pares.slice(0, i + 1))) { indicePromocion = i; break; }
  }
  if (indicePromocion < 0) return {
    estado: "sombra", estrategia: "estable", versionActiva: VERSION_MODELO_ESTABLE,
    pares: total.casos, fechas: total.fechas, maeEstableKg: total.maeEstableKg, maeCandidatoKg: total.maeCandidatoKg,
    motivo: total.casos < 12 || total.fechas < 4
      ? `Faltan ${Math.max(0, 12 - total.casos)} comparaciones y ${Math.max(0, 4 - total.fechas)} fechas para decidir.`
      : "El candidato todavía no mejora al modelo estable con margen suficiente.",
  };

  const posteriores = pares.slice(indicePromocion + 1).slice(-12);
  const recientes = resumen(posteriores);
  const degradado = recientes.casos >= 8 && recientes.maeEstableKg !== null && recientes.maeCandidatoKg !== null
    && (recientes.maeCandidatoKg > recientes.maeEstableKg * 1.12
      || (recientes.coberturaCandidatoPct ?? 0) < (recientes.coberturaEstablePct ?? 0) - 15);
  if (degradado) return {
    estado: "revertido", estrategia: "estable", versionActiva: VERSION_MODELO_ESTABLE,
    pares: total.casos, fechas: total.fechas, maeEstableKg: total.maeEstableKg, maeCandidatoKg: total.maeCandidatoKg,
    motivo: "Las comparaciones recientes empeoraron; RITMO volvió automáticamente al modelo estable.",
  };
  return {
    estado: "activo", estrategia: "candidata-conservadora", versionActiva: VERSION_MODELO_CANDIDATO,
    pares: total.casos, fechas: total.fechas, maeEstableKg: total.maeEstableKg, maeCandidatoKg: total.maeCandidatoKg,
    motivo: "El candidato redujo el error prospectivo y mantiene una cobertura comparable.",
  };
}
