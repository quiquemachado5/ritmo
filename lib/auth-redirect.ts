/** Solo permitimos retornos internos tras autenticar: evita rutas externas o
 * ambiguas en login, OAuth y callback. */
export function rutaInternaSegura(next: string | null | undefined, fallback = "/"): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** La recuperación necesita canjear primero el código PKCE en el callback. */
export function urlRecuperacionConCallback(origin: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", "/recuperar-contrasena");
  return url.toString();
}
