import { describe, expect, it } from "vitest";
import { CATALOGO_NUTRICIONAL, estimarOffline } from "../offline";
import { corregirGramos, etiquetaCantidad, metadataIngredienteValida, REFERENCIAS_VERIFICADAS, VERSION_CATALOGO } from "../catalog";
import { recalcularAnalisis } from "../corrections";
import { analizarLocal } from "../local";

describe("catálogo trazable y cantidades honestas", () => {
  it("tiene IDs únicos, versión y nutrientes por 100 g sin fuentes inventadas", () => {
    expect(new Set(CATALOGO_NUTRICIONAL.map(r => r.id)).size).toBe(CATALOGO_NUTRICIONAL.length);
    expect(CATALOGO_NUTRICIONAL.filter(r => r.estado === "verificada")).toHaveLength(8);
    for (const referencia of CATALOGO_NUTRICIONAL) {
      expect(referencia.version).toBe(VERSION_CATALOGO);
      expect(Object.values(referencia.por100g).every(n => Number.isFinite(n) && n >= 0)).toBe(true);
      if (referencia.estado === "verificada") {
        expect(referencia.url).toMatch(/^https:\/\/fdc.nal.usda.gov\/food-details\/\d+\/nutrients$/);
        expect(referencia.revisadaEn).toBe("2026-09-15");
      } else { expect(referencia.url).toBeUndefined(); expect(referencia.revisadaEn).toBeUndefined(); }
    }
    expect(REFERENCIAS_VERIFICADAS.pasta_cruda.por100g).toEqual({ kcal: 371, proteinas: 13.04, carbohidratos: 74.67, grasas: 1.51 });
    expect(estimarOffline("100 g de plátano").items[0].referencia?.id).toBe("usda:173944");
    expect(estimarOffline("1 huevo cocido").items[0].referencia?.id).toBe("usda:173424");
  });
  it("conserva referencias representativas de todas las familias facilitadas", () => {
    const porId = new Map(CATALOGO_NUTRICIONAL.map(ref => [ref.id, ref.por100g]));
    expect(porId.get("ritmo-local:pechuga-de-pollo")).toEqual({ kcal: 120, proteinas: 22.5, carbohidratos: 0, grasas: 2.6 });
    expect(porId.get("ritmo-local:lomo-de-salmon")).toEqual({ kcal: 208, proteinas: 20, carbohidratos: 0, grasas: 13.5 });
    expect(porId.get("ritmo-local:huevo-l")).toEqual({ kcal: 141.7, proteinas: 12, carbohidratos: 0.7, grasas: 10.3 });
    expect(porId.get("ritmo-local:arroz")).toEqual({ kcal: 355, proteinas: 7, carbohidratos: 78, grasas: 0.8 });
    expect(porId.get("ritmo-local:aguacate")).toEqual({ kcal: 160, proteinas: 2, carbohidratos: 2, grasas: 15 });
    expect(porId.get("ritmo-local:aceite-de-oliva")).toEqual({ kcal: 900, proteinas: 0, carbohidratos: 0, grasas: 100 });
  });
  it("cambiar a gramos explícitos recalcula desde la referencia y actualiza el total", () => {
    const base = estimarOffline("2 filetes de pollo con 100 g de arroz");
    const corregido = corregirGramos(base.items[0], 100);
    expect(corregido).toMatchObject({ gramos: 100, kcal: 120, proteinas: 22.5, tipoCantidad: "masa_declarada", cantidadEstimada: false });
    expect(etiquetaCantidad(base.items[0])).toBe("Unidades · peso aprox.");
    expect(etiquetaCantidad(corregido)).toBe("Peso indicado");
    expect(recalcularAnalisis(base, [corregido, base.items[1]]).kcal).toBe(475);
    expect(() => corregirGramos(corregido, NaN)).toThrow();
    expect(() => corregirGramos(corregido, -1)).toThrow();
    expect(() => corregirGramos(corregido, 10001)).toThrow();
  });
  it("una corrección personal de macros no atribuye sus valores a USDA ni convierte unidades en peso real", () => {
    const item = estimarOffline("1 cucharada de AOVE").items[0];
    const res = analizarLocal("1 cucharada de AOVE", [{ ...item, kcal: 110, clave: "aove", actualizada: 1 }]);
    expect(res.items[0].cantidadEstimada).toBe(true);
    expect(res.items[0].referencia?.estado).toBe("correccion_personal");
    expect(res.items[0].referencia?.url).toBeUndefined();
    expect(corregirGramos(res.items[0], 27).kcal).toBe(297);
  });
  it("rechaza metadatos malformados y URLs importadas arbitrarias", () => {
    const item = estimarOffline("100 g de arroz").items[0];
    expect(metadataIngredienteValida({ ...item })).toBe(true);
    expect(metadataIngredienteValida({ ...item, gramos: Infinity })).toBe(false);
    expect(metadataIngredienteValida({ ...item, referencia: { ...item.referencia, por100g: null } })).toBe(false);
    expect(metadataIngredienteValida({ ...item, referencia: { ...item.referencia, url: "https://example.com/estafa" } })).toBe(false);
  });
});
