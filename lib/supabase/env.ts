/** Credenciales públicas de Supabase. La clave anon es pública por diseño:
 *  quien protege los datos es la política RLS del esquema, no el secreto. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** ¿Hay credenciales configuradas? Si no, RITMO funciona en modo demo local. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
