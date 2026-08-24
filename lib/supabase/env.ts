/** Credenciales públicas de Supabase. La clave anon es pública por diseño:
 *  quien protege los datos es la política RLS del esquema, no el secreto.
 *
 *  RITMO requiere Supabase: sin conexión a la BD no funciona. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "RITMO requiere Supabase configurado. Asegúrate de que NEXT_PUBLIC_SUPABASE_URL " +
    "y NEXT_PUBLIC_SUPABASE_ANON_KEY estén definidas en .env.local",
  );
}
