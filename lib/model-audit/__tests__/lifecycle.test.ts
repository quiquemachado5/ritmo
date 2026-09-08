import { describe, expect, it } from "vitest";
import { sumarDias } from "../../model/dates";
import { PERFIL_DEFECTO } from "../../model/config";
import type { Estado } from "../../model/types";
import {
  evaluarCicloModelos,
  VERSION_MODELO_CANDIDATO,
  VERSION_MODELO_ESTABLE,
} from "../lifecycle";
import type { PrediccionEmitida } from "../types";

function escenario(errores: Array<{ estable: number; candidato: number }>) {
  const estado: Estado = { perfil: PERFIL_DEFECTO, dias: {}, composicion: [] };
  const predicciones: PrediccionEmitida[] = [];
  errores.forEach((error, indice) => {
    const objetivo = sumarDias("2026-01-02", indice);
    const emision = sumarDias(objetivo, -1);
    const real = 90 - indice * 0.05;
    estado.dias[objetivo] = { fecha: objetivo, peso: real, habitos: {} };
    for (const [version, desviacion] of [[VERSION_MODELO_ESTABLE, error.estable], [VERSION_MODELO_CANDIDATO, error.candidato]] as const) {
      predicciones.push({
        id: `${indice}-${version}`, emitidaEn: `${emision}T08:00:00Z`, fechaEmision: emision,
        fechaObjetivo: objetivo, horizonteDias: 1, peso: real + desviacion,
        minimo: real - 1, maximo: real + 1, pesoBase: real + 0.1,
        fechaBase: emision, versionModelo: version, configuracionId: "c-1",
        diasUtilizados: 20, pesajesUtilizados: 5,
      });
    }
  });
  return { estado, predicciones, hoy: sumarDias("2026-01-02", errores.length - 1) };
}

describe("ciclo de vida del modelo", () => {
  it("mantiene el candidato en sombra mientras no hay evidencia suficiente", () => {
    const datos = escenario(Array.from({ length: 8 }, () => ({ estable: 0.5, candidato: 0.2 })));
    const ciclo = evaluarCicloModelos(datos.estado, datos.predicciones, datos.hoy);
    expect(ciclo.estado).toBe("sombra");
    expect(ciclo.estrategia).toBe("estable");
  });

  it("promueve un candidato solo tras mejorar comparaciones prospectivas emparejadas", () => {
    const datos = escenario(Array.from({ length: 12 }, () => ({ estable: 0.5, candidato: 0.2 })));
    const ciclo = evaluarCicloModelos(datos.estado, datos.predicciones, datos.hoy);
    expect(ciclo.estado).toBe("activo");
    expect(ciclo.versionActiva).toBe(VERSION_MODELO_CANDIDATO);
    expect(ciclo.maeCandidatoKg).toBeLessThan(ciclo.maeEstableKg!);
  });

  it("revierte al estable si el candidato activado empeora de forma sostenida", () => {
    const buenos = Array.from({ length: 12 }, () => ({ estable: 0.5, candidato: 0.2 }));
    const malos = Array.from({ length: 8 }, () => ({ estable: 0.2, candidato: 0.7 }));
    const datos = escenario([...buenos, ...malos]);
    const ciclo = evaluarCicloModelos(datos.estado, datos.predicciones, datos.hoy);
    expect(ciclo.estado).toBe("revertido");
    expect(ciclo.versionActiva).toBe(VERSION_MODELO_ESTABLE);
  });
});
