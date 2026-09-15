/** Política estricta por petición. El nonce permite los scripts que Next.js
 * genera para esa respuesta sin abrir la ejecución inline a cualquier script. */
export function contentSecurityPolicy(nonce: string, options?: {
  development?: boolean;
  appUrl?: string;
  supabaseUrl?: string;
}): string {
  const development = options?.development ?? process.env.NODE_ENV !== "production";
  const appOrigin = new URL(options?.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ritmo.app");
  const localHttp = appOrigin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(appOrigin.hostname);
  const supabaseOrigin = new URL(options?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co").origin;
  const supabaseSocket = supabaseOrigin.replace(/^http/, "ws");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Los gráficos y varios componentes accesibles colocan estilos calculados
    // en atributos. Los scripts sí quedan cerrados con un nonce por respuesta.
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}${development ? " ws:" : ""}`,
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    development || localHttp ? "" : "upgrade-insecure-requests",
  ].filter(Boolean).join("; ");
}
