import { describe, expect, it } from "vitest";
import { siguienteAccion } from "../next-action";
import type { Estado } from "../types";

const perfil: Estado["perfil"] = {
  alturaCm: 180,
  edad: 30,
  sexo: "hombre",
  kcalObjetivo: 2_000,
  factorActividad: 1.4,
  umbralRacha: 4,
};

function estado(dias: Estado["dias"] = {}, composicion: Estado["composicion"] = [{ fecha: "2026-09-01", peso: 90 }]): Estado {
  return { perfil, dias, composicion };
}

describe("siguiente acción contextual", () => {
  it("pide un primer peso antes de ofrecer análisis que aún no existen", () => {
    expect(siguienteAccion(estado({}, []), "2026-09-08").tab).toBe("peso");
  });

  it("prioriza completar los hábitos activos y muestra el avance real", () => {
    const resultado = siguienteAccion(estado({
      "2026-09-08": { fecha: "2026-09-08", habitos: { comida: true, cena: true } },
    }), "2026-09-08");
    expect(resultado.tab).toBe("habitos");
    expect(resultado.detalle).toBe("2/6 hábitos hoy");
  });

  it("recomienda nutrición cuando los hábitos están completos pero faltan comidas", () => {
    const resultado = siguienteAccion(estado({
      "2026-09-08": {
        fecha: "2026-09-08",
        habitos: { comida: true, cena: true, noAlcohol: true, deporte: true, beberAgua: true, dormirBien: true },
      },
    }), "2026-09-08");
    expect(resultado.tab).toBe("comida");
  });

  it("recomienda pesarse cuando el día ya tiene hábitos y nutrición", () => {
    const resultado = siguienteAccion(estado({
      "2026-09-08": {
        fecha: "2026-09-08",
        habitos: { comida: true, cena: true, noAlcohol: true, deporte: true, beberAgua: true, dormirBien: true },
        comidas: [{ id: "c1", tipo: "comida", texto: "Pollo", kcal: 400, proteinas: 40, carbohidratos: 20, grasas: 12 }],
      },
    }), "2026-09-08");
    expect(resultado.tab).toBe("peso");
  });
});
