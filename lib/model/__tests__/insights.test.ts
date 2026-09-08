import { describe, expect, it } from "vitest";
import { diagnosticoRescate, escenariosRitmo, estadoVisualRitmo, memoriaCorporal } from "../insights";
import type { Estado } from "../types";

const perfil: Estado["perfil"] = { alturaCm: 180, edad: 30, sexo: "hombre", objetivo: "perder", kcalObjetivo: 2_000, factorActividad: 1.4, umbralRacha: 4 };
const completas = { comida: true, cena: true, noAlcohol: true, deporte: true, beberAgua: true, dormirBien: true };
function base(dias: Estado["dias"] = {}, composicion: Estado["composicion"] = []): Estado { return { perfil, dias, composicion }; }

describe("inteligencia contextual de RITMO", () => {
  it("activa rescate solo tras tres días observados realmente flojos", () => {
    const estado = base({
      "2026-09-04": { fecha: "2026-09-04", habitos: { comida: true } },
      "2026-09-05": { fecha: "2026-09-05", habitos: {} },
      "2026-09-06": { fecha: "2026-09-06", habitos: { beberAgua: true } },
      "2026-09-07": { fecha: "2026-09-07", habitos: { dormirBien: true } },
    });
    expect(diagnosticoRescate(estado, "2026-09-08").activo).toBe(true);
    expect(diagnosticoRescate(base({}), "2026-09-08").activo).toBe(false);
  });

  it("clasifica el ambiente con días observados y no castiga huecos", () => {
    const estado = base({
      "2026-09-07": { fecha: "2026-09-07", habitos: completas },
      "2026-09-08": { fecha: "2026-09-08", habitos: completas },
    });
    expect(estadoVisualRitmo(estado, "2026-09-08")).toMatchObject({ estado: "flujo", constancia: 100, dias: 2 });
  });

  it("crea un escenario por cada número posible de hábitos y conserva sus extremos", () => {
    const estado = base({ "2026-09-08": { fecha: "2026-09-08", habitos: completas, peso: 90 } });
    const escenarios = escenariosRitmo(estado);
    expect(escenarios).toHaveLength(7);
    expect(escenarios[0].cumplidos).toBe(0);
    expect(escenarios[6].cumplidos).toBe(6);
    expect(escenarios[0].peso28).toBeGreaterThan(escenarios[6].peso28);
  });

  it("recupera una memoria corporal solo al reencontrar un peso antiguo", () => {
    const estado = base({
      "2026-01-01": { fecha: "2026-01-01", habitos: completas, peso: 90 },
      "2026-09-08": { fecha: "2026-09-08", habitos: completas, peso: 90.2 },
    });
    expect(memoriaCorporal(estado)).toMatchObject({ fechaAnterior: "2026-01-01", fechaActual: "2026-09-08" });
    expect(memoriaCorporal(base({ "2026-09-08": { fecha: "2026-09-08", habitos: completas, peso: 90 } }))).toBeNull();
  });
});
