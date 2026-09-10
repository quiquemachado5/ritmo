import { describe, expect, it } from "vitest";
import { impactoLiquidosEnFecha, estadoAlcoholDia } from "../fluid-retention";
import type { Estado } from "../types";

const perfil = { alturaCm: 180, edad: 30, sexo: "hombre" as const, kcalObjetivo: 2_000, factorActividad: 1.4, umbralRacha: 4 };
const estado = (dias: Estado["dias"], extra: Partial<Estado> = {}): Estado => ({ perfil, dias, composicion: [], ...extra });

describe("retención transitoria de líquidos", () => {
  it("interpreta un día observado sin 'Sin alcohol' como alcohol, pero no inventa consumo en un hueco", () => {
    const datos = estado({
      "2026-09-06": { fecha: "2026-09-06", habitos: { deporte: true } },
      "2026-09-07": { fecha: "2026-09-07", habitos: {} },
    });
    expect(estadoAlcoholDia(datos, "2026-09-06")).toBe("alcohol");
    expect(estadoAlcoholDia(datos, "2026-09-07")).toBe("desconocido");
    expect(impactoLiquidosEnFecha(datos, "2026-09-07").kg).toBe(0.45);
    expect(impactoLiquidosEnFecha(datos, "2026-09-08").kg).toBe(0.2);
    expect(impactoLiquidosEnFecha(datos, "2026-09-09").kg).toBe(0.07);
    expect(impactoLiquidosEnFecha(datos, "2026-09-10").kg).toBe(0);
  });

  it("no aplica retención si se marcó 'Sin alcohol' o el hábito está desactivado", () => {
    const sobrio = estado({ "2026-09-06": { fecha: "2026-09-06", habitos: { noAlcohol: true, deporte: true } } });
    expect(impactoLiquidosEnFecha(sobrio, "2026-09-07").kg).toBe(0);
    const sinSeguimiento = estado(
      { "2026-09-06": { fecha: "2026-09-06", habitos: { deporte: true } } },
      { perfil: { ...perfil, habitosDesactivados: ["noAlcohol"] } },
    );
    expect(estadoAlcoholDia(sinSeguimiento, "2026-09-06")).toBe("desconocido");
  });

  it("aprende una respuesta personal cuando hay pesajes diarios suficientes", () => {
    const dias: Estado["dias"] = {};
    const filas = [
      ["2026-09-01", 90, false], ["2026-09-02", 90.7, true],
      ["2026-09-03", 90.6, false], ["2026-09-04", 91.3, true],
      ["2026-09-05", 91.2, false], ["2026-09-06", 91.9, true],
      ["2026-09-07", 91.8, true], ["2026-09-08", 91.7, true],
    ] as const;
    for (const [fecha, peso, sinAlcohol] of filas) {
      dias[fecha] = { fecha, peso, habitos: sinAlcohol ? { noAlcohol: true, deporte: true } : { deporte: true } };
    }
    const impacto = impactoLiquidosEnFecha(estado(dias), "2026-09-06");
    expect(impacto.fuente).toBe("personalizada");
    expect(impacto.kg).toBeGreaterThan(0.6);
    expect(impacto.incertidumbreKg).toBe(0.2);
  });

  it("incorpora un evento contextual aprendido solo como oscilación líquida", () => {
    const dias: Estado["dias"] = {};
    const filas = [
      ["2026-09-01", 90, true], ["2026-09-02", 90.8, false],
      ["2026-09-03", 90.7, true], ["2026-09-04", 91.5, false],
      ["2026-09-05", 91.4, false], ["2026-09-06", 91.3, false],
      ["2026-09-07", 91.2, true], ["2026-09-08", 92, false],
      ["2026-09-09", 91.9, false],
    ] as const;
    for (const [fecha, peso, comidaLibre] of filas) dias[fecha] = { fecha, peso, habitos: { noAlcohol: true }, notas: comidaLibre ? "Comida libre" : undefined };
    const impacto = impactoLiquidosEnFecha(estado(dias), "2026-09-08");
    expect(impacto.kg).toBeGreaterThan(0.7);
    expect(impacto.eventosContexto[0]).toMatchObject({ tipo: "comida-libre", personalizada: true });
  });
});
