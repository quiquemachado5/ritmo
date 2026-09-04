/** Next puede reconstruir request.url con un host interno tras un proxy.
 * Solo aceptamos el origen de la petición o dominios configurados por el operador. */
export function origenPermitido(request: Request, publicUrl = process.env.NEXT_PUBLIC_APP_URL): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // clientes no navegador: la sesión sigue siendo obligatoria
  const allowed = new Set([new URL(request.url).origin]);
  for (const value of [publicUrl, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined]) {
    if (value) { try { allowed.add(new URL(value).origin); } catch { /* configuración inválida, no se autoriza */ } }
  }
  return allowed.has(origin);
}

/** Limita los bytes realmente leídos, incluso sin Content-Length. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new Error("payload_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty_body");
  const decoder = new TextDecoder();
  let size = 0; let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("payload_too_large"); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
