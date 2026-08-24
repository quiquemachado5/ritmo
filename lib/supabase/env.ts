/** Credenciales públicas de Supabase. La clave anon es pública por diseño:
 *  quien protege los datos es la política RLS del esquema, no el secreto.
 *
 *  RITMO requiere Supabase: sin conexión a la BD no funciona. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "RITMO requiere Supabase configurado. Asegúrate de que NEXT_PUBLIC_SUPABASE_URL " +
    "y NEXT_PUBLIC_SUPABASE_ANON_KEY estén definidas en .env.local",
  );
}

export const SUPABASE_URL: string = url;
export const SUPABASE_ANON_KEY: string = key;
