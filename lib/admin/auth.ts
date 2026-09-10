import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const OWNER_EMAIL = "quiquemachadodguez@gmail.com";

function configuredAdmins(): Set<string> {
  return new Set(
    [OWNER_EMAIL, ...(process.env.RITMO_ADMIN_EMAILS ?? "").split(",")]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isBootstrapAdmin(user: User | null): boolean {
  if (!user) return false;
  if (user.app_metadata?.role === "admin") return true;
  return configuredAdmins().has((user.email ?? "").toLowerCase());
}

export async function isAdminUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User | null,
): Promise<boolean> {
  if (isBootstrapAdmin(user)) return true;
  const { data, error } = await supabase.rpc("is_ritmo_admin");
  return !error && data === true;
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(supabase, user))) redirect("/");
  return { supabase, user };
}
