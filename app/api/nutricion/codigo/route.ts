import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson, origenPermitido } from "@/lib/http";
import { consumeRateLimit } from "@/lib/rate-limit";
import { normalizeBarcode, parseOpenFoodFactsProduct, type BarcodeProduct } from "@/lib/nutrition/barcode";

export const runtime = "nodejs";
export const maxDuration = 15;

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const cache = new Map<string, { expires: number; product: BarcodeProduct }>();
const pending = new Map<string, Promise<BarcodeProduct | null>>();

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
}

function trimCache(now: number) {
  for (const [code, item] of cache) if (item.expires <= now) cache.delete(code);
  while (cache.size > 200) cache.delete(cache.keys().next().value as string);
}

async function fetchProduct(code: string): Promise<BarcodeProduct | null> {
  const now = Date.now();
  const cached = cache.get(code);
  if (cached && cached.expires > now) return cached.product;

  let task = pending.get(code);
  if (!task) {
    task = (async () => {
      const fields = "code,product_name,brands,serving_size,serving_quantity,nutrition_data,nutriments";
      const response = await fetch(`https://world.openfoodfacts.org/api/v3.2/product/${encodeURIComponent(code)}.json?fields=${fields}`, {
        headers: { "User-Agent": "RITMO/1.0 (https://ritmo-nu-six.vercel.app) - product lookup" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("upstream");
      const product = parseOpenFoodFactsProduct(await response.json(), code);
      if (product) {
        trimCache(now);
        cache.set(code, { product, expires: now + CACHE_TTL_MS });
      }
      return product;
    })().finally(() => pending.delete(code));
    pending.set(code, task);
  }
  return task;
}

export async function POST(request: Request) {
  try {
    if (!origenPermitido(request)) return json({ error: "Origen no permitido." }, 403);
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return json({ error: "Envía el contenido como JSON." }, 415);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Inicia sesión de nuevo para buscar productos." }, 401);
    if (!consumeRateLimit(`barcode:${user.id}`, 10, 60_000) || !consumeRateLimit("barcode:global", 12, 60_000)) {
      return json({ error: "Has realizado varias búsquedas seguidas. Espera un minuto y vuelve a intentarlo." }, 429);
    }

    let body: { code?: unknown };
    try { body = await readBoundedJson(request, 1_024) as typeof body; }
    catch (error) { return json({ error: "La solicitud no es válida." }, error instanceof Error && error.message === "payload_too_large" ? 413 : 400); }
    const code = normalizeBarcode(body?.code);
    if (!code) return json({ error: "Introduce un código EAN, UPC o GTIN de 8 a 14 dígitos." }, 400);

    const product = await fetchProduct(code);
    if (!product) return json({ error: "No encontramos ese producto con valores nutricionales completos. Puedes registrarlo escribiendo la etiqueta." }, 404);
    return json({ product });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return json({ error: "La búsqueda está tardando demasiado. Conservamos el código para que puedas reintentar." }, 504);
    return json({ error: "No se pudo consultar el producto ahora. Conservamos el código para que puedas reintentar." }, 502);
  }
}
