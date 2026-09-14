import { describe, expect, it } from "vitest";
import { analizarSaludDatos, repararSaludDatos } from "../data-health";
import { PERFIL_DEFECTO } from "../model/config";

describe("salud de datos", () => {
  const comida = { id: "a", tipo: "comida" as const, texto: "plato", kcal: 300, proteinas: 20, carbohidratos: 25, grasas: 12 };

  it("repara duplicados y totales reconstruibles sin tocar conflictos humanos", () => {
    const data = {
      perfil: PERFIL_DEFECTO,
      dias: { "2026-09-01": { fecha: "2026-08-31", habitos: {}, peso: 90, kcalConsumidas: 10, comidas: [comida, { ...comida, kcal: 320 }] } },
      composicion: [{ fecha: "2026-09-01", peso: 91 }, { fecha: "2026-09-01", peso: 91.2, grasaPct: 20 }],
    };
    const report = analizarSaludDatos(data, "2026-09-10");
    expect(report.repairable).toBe(4);
    expect(report.review).toBe(1);
    const reparado = repararSaludDatos(data, "2026-09-10").data;
    expect(reparado.dias["2026-09-01"]).toMatchObject({ fecha: "2026-09-01", kcalConsumidas: 320 });
    expect(reparado.dias["2026-09-01"].comidas).toHaveLength(1);
    expect(reparado.composicion).toEqual([{ fecha: "2026-09-01", peso: 91.2, grasaPct: 20 }]);
    expect(reparado.dias["2026-09-01"].peso).toBe(90);
  });

  it("deja los registros futuros para revisión", () => {
    const report = analizarSaludDatos({ perfil: PERFIL_DEFECTO, dias: { "2026-09-12": { fecha: "2026-09-12", habitos: {} } }, composicion: [] }, "2026-09-10");
    expect(report).toMatchObject({ repairable: 0, review: 1 });
  });
});
