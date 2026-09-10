import { describe, expect, it } from "vitest";
import { factorPorcion, escalarNutrientes, listaCompra } from "../portions";
import { aclaracionComida } from "../clarification";
import { estimarOffline } from "../offline";
describe("raciones y aclaraciones", () => {
  it("registra una de cuatro raciones, no toda la receta", () => {
    expect(escalarNutrientes({ kcal: 1600, proteinas: 100, carbohidratos: 180, grasas: 50 }, factorPorcion(4, 1))).toEqual({ kcal: 400, proteinas: 25, carbohidratos: 45, grasas: 12.5 });
  });
  it("rechaza porciones vacías, infinitas o mayores que la receta", () => {
    for (const [total, eaten] of [[0,1], [4,5], [4,0], [NaN,1]]) expect(() => factorPorcion(total,eaten)).toThrow();
  });
  it("pregunta por aceite sin cantidad, no por un plato bien especificado", () => {
    expect(aclaracionComida("Ensalada con pollo y aceite")).not.toBeNull();
    expect(aclaracionComida("220 g de pollo con aceite de oliva")).not.toBeNull();
    expect(aclaracionComida("Ensalada con 1 cda de AOVE y 2 filetes con 1 cda de aceite")).toBeNull();
    expect(aclaracionComida("150 g de pasta con verduras")).toBeNull();
    expect(aclaracionComida("150 g de pasta cocida con verduras")).toBeNull();
  });
  it("ofrece las tres equivalencias estándar de aceite", () => {
    expect(aclaracionComida("Ensalada con aceite")?.opciones).toEqual(["3 g", "5 g", "10 g"]);
  });
  it("una aclaración reemplaza el aceite total sin duplicar ingredientes", () => {
    const a = estimarOffline("Ensalada con pollo y aceite de oliva\nAclaración: cantidad total de aceite del plato: 10 ml.");
    const b = estimarOffline("Ensalada con pollo y 10 ml de aceite de oliva");
    expect(a.kcal).toBe(b.kcal);
    expect(a.items.filter(i => i.nombre.includes("aceite"))).toHaveLength(1);
    const arroz = estimarOffline("150 g de arroz con pollo\nAclaración: el peso de arroz o pasta indicado es: En crudo.");
    expect(arroz.items.filter(i => /arroz|pasta/.test(i.nombre))).toHaveLength(1);
    expect(arroz.items.find(i => i.nombre.includes("arroz"))?.kcal).toBeGreaterThan(400);
  });
  it("la compra no mezcla unidades ni incluye comidas ya consumidas", () => {
    const comida = { id: "a", tipo: "comida" as const, texto: "Plato", kcal: 400, proteinas: 25, carbohidratos: 40, grasas: 10, ingredientes: [{ nombre: "Aceite", cantidad: "1 cucharada", kcal: 120, proteinas: 0, carbohidratos: 0, grasas: 13 }] };
    const result = listaCompra([{ id: "a", fecha: "2026-09-04", comida }, { id: "b", fecha: "2026-09-05", comida, registrada: true }]);
    expect(result).toEqual([{ nombre: "Aceite", cantidades: ["1 cucharada"] }]);
  });
});
