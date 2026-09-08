import { describe, expect, it } from "vitest";
import { PERFIL_DEFECTO } from "../model/config";
import { generarInformeProfesional } from "../professional-report";

const estado = {
  perfil: { ...PERFIL_DEFECTO, nombre: "Alex <script>" },
  dias: { "2026-09-08": { fecha: "2026-09-08", peso: 90, habitos: { agua: true }, notas: "Dato privado", comidas: [{ id: "1", tipo: "comida" as const, texto: "Pollo & arroz", kcal: 500, proteinas: 40, carbohidratos: 50, grasas: 12 }] } },
  composicion: [],
};

describe("informe profesional privado", () => {
  it("incluye solo los apartados elegidos y escapa texto personal", () => {
    const html = generarInformeProfesional(estado, { period: "all", identity: true, weight: true, body: false, habits: false, nutrition: true, notes: false, meals: false }, "2026-09-08");
    expect(html).toContain("Alex &lt;script&gt;");
    expect(html).toContain("Evolución de peso");
    expect(html).toContain("Registro nutricional");
    expect(html).not.toContain("Dato privado");
    expect(html).not.toContain("Pollo &amp; arroz");
    expect(html).not.toContain("@ritmo");
  });

  it("permite compartir notas y comidas de forma explícita", () => {
    const html = generarInformeProfesional(estado, { period: "all", identity: false, weight: false, body: false, habits: false, nutrition: false, notes: true, meals: true }, "2026-09-08");
    expect(html).toContain("Informe sin nombre");
    expect(html).toContain("Dato privado");
    expect(html).toContain("Pollo &amp; arroz");
  });
});
