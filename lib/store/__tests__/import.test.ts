import { describe, expect, it } from "vitest";
import { PERFIL_DEFECTO } from "../../model/config";
import { analizarImportacion } from "../import";
import type { StoreData } from "../types";

const actual: StoreData = {
  perfil: { ...PERFIL_DEFECTO },
  dias: { "2026-08-01": { fecha: "2026-08-01", habitos: {} } },
  composicion: [{ fecha: "2026-08-01", peso: 80 }],
};

describe("analizarImportacion", () => {
  it("rechaza fechas imposibles, ingredientes corruptos y planes mal formados", () => {
    expect(analizarImportacion({ dias: { "2026-02-31": { fecha: "2026-02-31", habitos: {} } } }, actual).valido).toBe(false);
    expect(analizarImportacion({ dias: { "2026-08-01": { fecha: "2026-08-01", habitos: {}, comidas: [{ ...comida("a"), ingredientes: [{}] }] } } }, actual).valido).toBe(false);
    expect(analizarImportacion({ preferencias: { fav: [], hidden: [], templates: [], catalog: [], plan: [{}] } }, actual).valido).toBe(false);
    expect(analizarImportacion(JSON.parse('{"perfil":{"__proto__":{"admin":true}}}'), actual).valido).toBe(false);
  });
  it("resume nuevas fechas y coincidencias sin mutar el estado", () => {
    const resultado = analizarImportacion({
      app: "ritmo", version: 2, schemaVersion: "202609010001", exportado: "2026-08-26T12:00:00.000Z",
      dias: {
        "2026-08-01": { fecha: "2026-08-01", habitos: {}, comidas: [comida("a")] },
        "2026-08-02": { fecha: "2026-08-02", habitos: {}, comidas: [comida("b"), comida("c")] },
      },
      composicion: [{ fecha: "2026-08-01", peso: 80 }, { fecha: "2026-08-02", peso: 79.8 }],
    }, actual);
    expect(resultado).toMatchObject({ valido: true, version: 2, schemaVersion: "202609010001", diasNuevos: 1, diasCoincidentes: 1, medicionesNuevas: 1, medicionesCoincidentes: 1, comidas: 3 });
    expect(Object.keys(actual.dias)).toEqual(["2026-08-01"]);
  });

  it("rechaza registros incompletos en lugar de importar datos que rompan la pantalla", () => {
    expect(analizarImportacion({ dias: { "2026-08-01": { fecha: "2026-08-01", habitos: {}, comidas: [{ id: "a" }] } } }, actual).valido).toBe(false);
  });

  it.each([
    {}, { contenido: "archivo de otra aplicación" }, { perfil: { nombre: 12 } },
    { perfil: { umbralRacha: 0 } }, { perfil: { onboardingCompleto: "sí" } },
    { dias: { "2026-08-01": { fecha: "2026-08-01", habitos: {}, peso: 0 } } },
    { dias: { "2026-08-01": { fecha: "2026-08-01", habitos: {}, grasaPct: 900 } } },
    { dias: { "2026-08-01": { fecha: "2026-08-01", habitos: {}, kcalConsumidas: 400.5 } } },
    { composicion: [{ fecha: "2026-08-01", peso: 80, aguaPct: 99 }] },
    { composicion: [{ fecha: "2026-08-01", peso: 80, grasaVisceral: 3.5 }] },
  ])("rechaza formatos que fallarían durante el guardado parcial", (archivo) => {
    expect(analizarImportacion(archivo, actual).valido).toBe(false);
  });

  it("acepta una medición completa dentro de los límites del esquema", () => {
    expect(analizarImportacion({ composicion: [{ fecha: "2026-08-01", peso: 80.5, grasaPct: 21.5, masaMuscularKg: 42.5, imc: 25, grasaVisceral: 8, metabBasalKcal: 1700, gastoDiarioKcal: 2200, masaOseaKg: 3.2, aguaPct: 55, cintura: 82, cadera: 96, pecho: 100, brazo: 34, muslo: 55, cuello: 38 }] }, actual).valido).toBe(true);
  });

  it("rechaza una app o versión incompatibles antes de importar", () => {
    expect(analizarImportacion({ app: "otra", version: 1 }, actual).valido).toBe(false);
    expect(analizarImportacion({ app: "ritmo", version: 99 }, actual).valido).toBe(false);
    expect(analizarImportacion({ app: "ritmo", version: 2, schemaVersion: "999999999999" }, actual).valido).toBe(false);
  });

  it("mantiene compatibilidad con copias v1 sin versión de esquema", () => {
    expect(analizarImportacion({ app: "ritmo", version: 1, dias: {} }, actual)).toMatchObject({ valido: true, version: 1, schemaVersion: null });
  });
});

function comida(id: string) { return { id, tipo: "comida", texto: "Plato de prueba", kcal: 400, proteinas: 20, carbohidratos: 40, grasas: 15 }; }
