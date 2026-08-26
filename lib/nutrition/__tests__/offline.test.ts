import { describe, expect, it } from "vitest";
import { estimarOffline } from "../offline";

describe("estimador offline de comidas detalladas", () => {
  it("cuenta los ingredientes energéticos que suelen omitirse", () => {
    const resultado = estimarOffline("220 g de pechuga de pavo con 25 ml de AOVE, 20 g de pecorino y 80 g de canónigos");
    expect(resultado.kcal).toBeGreaterThan(500);
    expect(resultado.items).toHaveLength(4);
  });

  it("distingue pasta en crudo de una ración cocida", () => {
    const resultado = estimarOffline("150 g de pasta penne rigate peso en crudo con 120 g de gambas, 10 ml de AOVE y 15 g de parmesano");
    expect(resultado.kcal).toBeGreaterThan(750);
  });

  it("reconoce salsa, queso y aliño de una ensalada completa", () => {
    const resultado = estimarOffline("100 g de garbanzos, 120 g de pechuga de pollo, 40 g de queso de cabra y 15 ml de AOVE con 8 g de mostaza antigua");
    expect(resultado.kcal).toBeGreaterThan(550);
  });
});
