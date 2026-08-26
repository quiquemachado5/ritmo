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
  it("resume nuevas fechas y coincidencias sin mutar el estado", () => {
    const resultado = analizarImportacion({
      app: "ritmo", version: 1, exportado: "2026-08-26T12:00:00.000Z",
      dias: {
        "2026-08-01": { fecha: "2026-08-01", habitos: {}, comidas: [{ id: "a" }] },
        "2026-08-02": { fecha: "2026-08-02", habitos: {}, comidas: [{ id: "b" }, { id: "c" }] },
      },
      composicion: [{ fecha: "2026-08-01", peso: 80 }, { fecha: "2026-08-02", peso: 79.8 }],
    }, actual);
    expect(resultado).toMatchObject({ valido: true, diasNuevos: 1, diasCoincidentes: 1, medicionesNuevas: 1, medicionesCoincidentes: 1, comidas: 3 });
    expect(Object.keys(actual.dias)).toEqual(["2026-08-01"]);
  });

  it("rechaza una app o versión incompatibles antes de importar", () => {
    expect(analizarImportacion({ app: "otra", version: 1 }, actual).valido).toBe(false);
    expect(analizarImportacion({ app: "ritmo", version: 99 }, actual).valido).toBe(false);
  });
});
