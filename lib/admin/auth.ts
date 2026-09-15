import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function isAdminUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User | null,
): Promise<boolean> {
  if (!user) return false;
  try {
    // La misma autoridad que protege los RPC decide el acceso a páginas.
    // Una revocación en BD debe surtir efecto aunque el JWT conserve un rol.
    const { data, error } = await supabase.rpc("is_ritmo_admin").abortSignal(AbortSignal.timeout(5_000));
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(supabase, user))) redirect("/");
  return { supabase, user };
}
