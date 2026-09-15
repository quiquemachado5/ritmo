import { describe, expect, it } from "vitest";
import { normalizeBarcode, parseOpenFoodFactsProduct, scaleBarcodeProduct } from "../barcode";

const response = {
  product: {
    code: "3017620422003",
    product_name: "Crema de cacao",
    brands: "Marca ejemplo",
    serving_size: "15 g",
    serving_quantity: 15,
    nutriments: {
      "energy-kcal_100g": 540,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
    },
  },
};

describe("productos por código", () => {
  it("acepta EAN, UPC y GTIN sin permitir texto arbitrario", () => {
    expect(normalizeBarcode("3017 6204-22003")).toBe("3017620422003");
    expect(normalizeBarcode("1234567")).toBeNull();
    expect(normalizeBarcode("301762042200x")).toBeNull();
  });

  it("reduce la respuesta externa a valores acotados y trazables", () => {
    expect(parseOpenFoodFactsProduct(response, "3017620422003")).toMatchObject({
      code: "3017620422003",
      name: "Crema de cacao",
      servingGrams: 15,
      per100g: { kcal: 540, proteins: 6.3, carbohydrates: 57.5, fat: 30.9 },
    });
    expect(parseOpenFoodFactsProduct({ product: { ...response.product, nutriments: {} } }, "3017620422003")).toBeNull();
  });

  it("calcula una ración y rechaza cantidades extremas", () => {
    const product = parseOpenFoodFactsProduct(response, "3017620422003")!;
    expect(scaleBarcodeProduct(product, 30)).toEqual({ grams: 30, kcal: 162, proteins: 1.9, carbohydrates: 17.3, fat: 9.3 });
    expect(() => scaleBarcodeProduct(product, 0)).toThrow(/cantidad/);
    expect(() => scaleBarcodeProduct(product, 5001)).toThrow(/cantidad/);
  });
});
