import { describe, expect, it } from "vitest";
import { PERFIL_DEFECTO, HABITOS } from "../../model/config";
import { energiaDe, calibracionPersonalizada } from "../../model/analytics";
import { configuracionEnFecha, perfilesEquivalentes } from "../../model/profile-history";
import type { Estado } from "../../model/types";
import { evaluarPredicciones } from "../evaluation";
import { validarAuditoriaImportada } from "../import";
import type { PrediccionEmitida } from "../types";

const perfil = { ...PERFIL_DEFECTO, edad: 30, kcalObjetivo: 1700 };
const prediccion: PrediccionEmitida = {
  id: "p-1", emitidaEn: "2026-09-04T10:00:00Z", fechaEmision: "2026-09-04", fechaObjetivo: "2026-09-05",
  horizonteDias: 1, peso: 90, minimo: 89.5, maximo: 90.5, pesoBase: 90.1, fechaBase: "2026-09-04",
  versionModelo: "test", configuracionId: "c-1", diasUtilizados: 10, pesajesUtilizados: 2,
};
const base: Estado = { perfil, dias: { "2026-09-05": { fecha: "2026-09-05", peso: 90.2, habitos: {} } }, composicion: [] };

describe("Auditoría prospectiva", () => {
  it("compara una predicción inmutable con el peso de su fecha exacta", () => {
    const frozen = Object.freeze({ ...prediccion });
    const r = evaluarPredicciones(base, [frozen], "2026-09-05");
    expect(r.casos).toBe(1);
    expect(r.maeKg).toBeCloseTo(0.2);
    expect(r.coberturaPct).toBe(100);
    expect(frozen.peso).toBe(90);
    const editado = { ...base, perfil: { ...perfil, kcalObjetivo: 2200 } };
    expect(evaluarPredicciones(editado, [frozen], "2026-09-05").maeKg).toBe(r.maeKg);
  });
  it("no evalúa pesos futuros, no interpola ni acepta un pronóstico del mismo día", () => {
    expect(evaluarPredicciones(base, [prediccion], "2026-09-04").pendientes).toBe(1);
    expect(evaluarPredicciones(base, [{ ...prediccion, fechaObjetivo: "2026-09-06" }], "2026-09-06").sinPesaje).toBe(1);
    expect(evaluarPredicciones(base, [{ ...prediccion, fechaEmision: "2026-09-05" }], "2026-09-05").casos).toBe(0);
  });
  it("separa el error por horizonte en lugar de confundir mañana con un mes", () => {
    const r = evaluarPredicciones(base, [prediccion, { ...prediccion, id: "p-2", fechaEmision: "2026-08-06", horizonteDias: 30, peso: 89 }], "2026-09-05", "test");
    expect(r.horizontes.find((h) => h.dias === 1)?.maeKg).toBeCloseTo(0.2);
    expect(r.horizontes.find((h) => h.dias === 30)?.maeKg).toBeCloseTo(1.2);
  });
  it("no mezcla la precisión de versiones anteriores con la actual", () => {
    const actual = { ...prediccion, id: "actual", versionModelo: "ritmo-2026-09-v3-liquidos" };
    const vieja = { ...prediccion, id: "vieja", peso: 88, versionModelo: "ritmo-2026-09-v2-composicion" };
    const r = evaluarPredicciones(base, [actual, vieja], "2026-09-05");
    expect(r.actual.casos).toBe(1);
    expect(r.actual.maeKg).toBeCloseTo(0.2);
    expect(r.versiones).toHaveLength(2);
  });
});

describe("Vigencia del perfil", () => {
  const anterior = { id: "c-1", effectiveFrom: "2026-09-04T23:10:00Z", effectiveDate: "2026-09-05", perfil };
  const siguiente = { id: "c-2", effectiveFrom: "2026-09-06T12:00:00Z", effectiveDate: "2026-09-06", perfil: { ...perfil, kcalObjetivo: 2400, habitosDesactivados: ["deporte"] } };
  const estado = { ...base, perfil: siguiente.perfil, perfilHistorial: [anterior, siguiente] };
  it("reordenar claves como JSONB no inventa una versión nueva", () => {
    expect(perfilesEquivalentes(perfil, Object.fromEntries(Object.entries(perfil).reverse()) as typeof perfil)).toBe(true);
    expect(perfilesEquivalentes(perfil, { ...perfil, habitosDesactivados: ["deporte"] })).toBe(false);
  });
  it("respeta día local y explicita que el pasado anterior no está documentado", () => {
    expect(configuracionEnFecha(estado, "2026-09-04")).toEqual({ perfil, documentada: false });
    expect(configuracionEnFecha(estado, "2026-09-05")).toEqual({ perfil, documentada: true });
    expect(configuracionEnFecha(estado, "2026-09-06").perfil).toEqual(siguiente.perfil);
  });
  it("cambiar ajustes actuales no cambia el balance de una fecha histórica", () => {
    const ayer = { fecha: "2026-09-05", peso: 90, habitos: Object.fromEntries(HABITOS.map((h, i) => [h.clave, i < 4])) };
    const e1 = { ...estado, perfil, dias: { [ayer.fecha]: ayer }, perfilHistorial: [anterior] };
    const e2 = { ...e1, perfil: siguiente.perfil, perfilHistorial: [anterior, siguiente] };
    expect(energiaDe(e2, ayer.fecha)).toEqual(energiaDe(e1, ayer.fecha));
    expect(calibracionPersonalizada(e2)).toEqual(calibracionPersonalizada(e1));
  });
});

describe("Importación de auditoría como documento", () => {
  const valido = { configuraciones: [{ id: "c-1", effectiveFrom: "2026-09-04T10:00:00Z", perfil }], predicciones: [prediccion] };
  it("valida límites y tipos sin otorgar a la copia un sello nuevo", () => {
    expect(validarAuditoriaImportada(valido)).toBe(true);
    expect(validarAuditoriaImportada({ ...valido, predicciones: [{ ...prediccion, peso: Infinity }] })).toBe(false);
    expect(validarAuditoriaImportada({ ...valido, predicciones: [{ ...prediccion, emitidaEn: "no" }] })).toBe(false);
    expect(validarAuditoriaImportada({ ...valido, configuraciones: Array(5001).fill(valido.configuraciones[0]) })).toBe(false);
  });
});
