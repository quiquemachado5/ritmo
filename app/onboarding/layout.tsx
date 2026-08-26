import { redirect } from "next/navigation";
import { DataProvider } from "@/lib/store/provider";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("onboarding_completo")
    .eq("user_id", user.id)
    .maybeSingle();
  if (perfil?.onboarding_completo) redirect("/");

  return <DataProvider>{children}</DataProvider>;
}
