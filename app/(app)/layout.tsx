import { redirect } from "next/navigation";
import { ClientProviders } from "@/components/app/client-providers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // En modo nube: exige sesión y onboarding completo antes de entrar.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("onboarding_completo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil?.onboarding_completo) redirect("/onboarding");
  }

  return <ClientProviders>{children}</ClientProviders>;
}
