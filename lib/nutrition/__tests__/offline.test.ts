import { describe, expect, it } from "vitest";
import { estimarOffline } from "../offline";

describe("estimador offline de comidas detalladas", () => {
  it("conserva las comas decimales sin confundirlas con separadores", () => {
    const decimal = estimarOffline("1,5 kg de patata, 20 g de pan");
    const entero = estimarOffline("1500 g de patata con 20 g de pan");
    expect(decimal.items.map(item => ({ ...item, cantidadOriginal: undefined }))).toEqual(entero.items.map(item => ({ ...item, cantidadOriginal: undefined })));
    expect(decimal.items[0].cantidad).toBe("1500 g");
  });
  it("cuenta los ingredientes energéticos que suelen omitirse", () => {
    const resultado = estimarOffline("220 g de pechuga de pavo con 25 ml de AOVE, 20 g de pecorino y 80 g de canónigos");
    expect(resultado.kcal).toBeGreaterThan(500);
    expect(resultado.items).toHaveLength(4);
  });

  it("distingue pasta en crudo de una ración cocida", () => {
    const resultado = estimarOffline("150 g de pasta penne rigate peso en crudo con 120 g de gambas, 10 ml de AOVE y 15 g de parmesano");
    expect(resultado.kcal).toBeGreaterThan(700);
  });

  it("reconoce salsa, queso y aliño de una ensalada completa", () => {
    const resultado = estimarOffline("100 g de garbanzos, 120 g de pechuga de pollo, 40 g de queso de cabra y 15 ml de AOVE con 8 g de mostaza antigua");
    expect(resultado.kcal).toBeGreaterThan(550);
  });

  it("descompone una frase larga, cuenta dos cucharadas de AOVE y no duplica ensalada de lechuga", () => {
    const resultado = estimarOffline(
      "ensalada de lechuga con atun esparragos y un aliño de 1 cda de aove con 2 filetes de pollo a la plancha con especias y 1 cda de aove",
    );

    expect(resultado.items.filter((item) => item.nombre.startsWith("aove"))).toHaveLength(2);
    expect(resultado.items.filter((item) => /ensalada|lechuga/.test(item.nombre))).toHaveLength(1);
    expect(resultado.items.some((item) => item.nombre.startsWith("pollo") && item.nombre.includes("260 g"))).toBe(true);
    expect(resultado.kcal).toBeGreaterThan(700);
    expect(resultado.kcal).toBeLessThan(950);
  });

  it("no presta la cantidad del siguiente ingrediente aunque no haya coma", () => {
    const res = estimarOffline("arroz 150 g de pollo");
    expect(res.items[0]).toMatchObject({ gramos: 80, cantidadEstimada: true });
    expect(res.items[1]).toMatchObject({ gramos: 150, cantidadEstimada: false });
  });

  it("separa cantidad declarada de peso inferido y no recorta medias cucharadas", () => {
    const res = estimarOffline("2 filetes de pollo con media cucharada de AOVE y 20 ml de leche");
    expect(res.items[0]).toMatchObject({ gramos: 260, tipoCantidad: "unidades_declaradas", cantidadEstimada: true });
    expect(res.items[1]).toMatchObject({ gramos: 5, tipoCantidad: "unidades_declaradas", cantidadEstimada: true });
    expect(res.items[2]).toMatchObject({ gramos: 20, tipoCantidad: "volumen_declarado", cantidadEstimada: true });
    expect(res.items[1].cantidad).toContain("5 g");
  });

  it("muestra lo no interpretado sin inventar calorías para completarlo", () => {
    const base = estimarOffline("100 g de arroz");
    const incompleto = estimarOffline("100 g de arroz con 30 g de tahini y 15 g de kimchi");
    expect(incompleto.noReconocidos).toEqual(["tahini", "kimchi"]);
    expect(incompleto.kcal).toBe(base.kcal);
    expect(incompleto.items).toHaveLength(1);
  });

  it("no confunde crudo y cocido en una comida con dos cereales", () => {
    const res = estimarOffline("100 g de arroz en crudo y 100 g de pasta cocida");
    expect(res.items[0].referencia?.id).toBe("ritmo-local:arroz");
    expect(res.items[0].kcal).toBe(355);
    expect(res.items[1].referencia?.id).toBe("ritmo-local:pasta-penne-rigate:cocinado");
    expect(res.items[1].kcal).toBe(135);
    expect(estimarOffline("100 g de pasta cruda").kcal).toBe(350);
  });

  it("aplica las equivalencias de aceite definidas por RITMO", () => {
    expect(estimarOffline("1 cucharada de AOVE").kcal).toBe(90);
    expect(estimarOffline("1 cucharadita de AOVE").kcal).toBe(45);
    expect(estimarOffline("1 chorrito de AOVE").kcal).toBe(27);
  });

  it("usa peso crudo por defecto y solo transforma un peso cocinado explícito", () => {
    expect(estimarOffline("100 g de arroz").kcal).toBe(355);
    expect(estimarOffline("100 g de arroz cocido").kcal).toBe(131);
    expect(estimarOffline("100 g de pechuga de pollo a la plancha").kcal).toBe(120);
    expect(estimarOffline("100 g de pechuga de pollo peso cocinado").kcal).toBe(150);
  });

  it("cuenta piezas pequeñas y dos verduras diferentes sin duplicar contenedores", () => {
    expect(estimarOffline("7 galletas").items[0].gramos).toBe(56);
    expect(estimarOffline("ensalada de lechuga con brocoli").items).toHaveLength(2);
  });
});
