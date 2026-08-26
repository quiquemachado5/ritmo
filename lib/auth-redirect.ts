/** Solo permitimos retornos internos tras autenticar: evita rutas externas o
 * ambiguas en login, OAuth y callback. */
export function rutaInternaSegura(next: string | null | undefined, fallback = "/"): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
