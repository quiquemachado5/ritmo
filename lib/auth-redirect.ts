/** Solo permitimos retornos internos tras autenticar: evita rutas externas o
 * ambiguas en login, OAuth y callback. */
export function rutaInternaSegura(next: string | null | undefined, fallback = "/"): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // El parser del navegador elimina tabuladores/saltos de línea y convierte
  // barras inversas en barras: /\\dominio y /\n/dominio pueden salir de la app.
  if ([...next].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return fallback;
  return next;
}

/** La recuperación necesita canjear primero el código PKCE en el callback. */
export function urlRecuperacionConCallback(origin: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", "/recuperar-contrasena");
  return url.toString();
}
