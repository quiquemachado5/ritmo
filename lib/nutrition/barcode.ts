export interface BarcodeProduct {
  code: string;
  name: string;
  brand?: string;
  servingSize?: string;
  servingGrams?: number;
  per100g: {
    kcal: number;
    proteins: number;
    carbohydrates: number;
    fat: number;
  };
  sourceUrl: string;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : undefined;
}

function boundedNumber(value: unknown, max: number): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return Math.round(parsed * 10) / 10;
}

/** EAN/UPC/GTIN legible. Open Food Facts normaliza los ceros iniciales. */
export function normalizeBarcode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "");
  return /^\d{8,14}$/.test(code) ? code : null;
}

/** Convierte la respuesta externa en el contrato mínimo y acotado de RITMO. */
export function parseOpenFoodFactsProduct(payload: unknown, requestedCode: string): BarcodeProduct | null {
  const root = record(payload);
  const product = record(root?.product);
  const nutriments = record(product?.nutriments);
  const code = normalizeBarcode(product?.code) ?? normalizeBarcode(requestedCode);
  const name = shortText(product?.product_name, 120);
  if (!product || !nutriments || !code || !name) return null;

  const kcal = boundedNumber(nutriments["energy-kcal_100g"], 2_000);
  const proteins = boundedNumber(nutriments.proteins_100g, 100);
  const carbohydrates = boundedNumber(nutriments.carbohydrates_100g, 100);
  const fat = boundedNumber(nutriments.fat_100g, 100);
  if ([kcal, proteins, carbohydrates, fat].some((value) => value === null)) return null;

  const servingGrams = boundedNumber(product.serving_quantity, 5_000);
  return {
    code,
    name,
    brand: shortText(product.brands, 100),
    servingSize: shortText(product.serving_size, 60),
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
    per100g: {
      kcal: kcal!,
      proteins: proteins!,
      carbohydrates: carbohydrates!,
      fat: fat!,
    },
    sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}`,
  };
}

export function scaleBarcodeProduct(product: BarcodeProduct, grams: number) {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 5_000) throw new Error("Indica una cantidad entre 1 y 5.000 g.");
  const factor = grams / 100;
  const round = (value: number) => Math.round(value * factor * 10) / 10;
  return {
    grams: Math.round(grams * 10) / 10,
    kcal: Math.round(product.per100g.kcal * factor),
    proteins: round(product.per100g.proteins),
    carbohydrates: round(product.per100g.carbohydrates),
    fat: round(product.per100g.fat),
  };
}
