import { redirect } from "next/navigation";
import { ClientProviders } from "@/components/app/client-providers";
import { createClient } from "@/lib/supabase/server";

// La identidad puede cambiar sin que cambie la URL (cerrar sesión e iniciar con
// otra cuenta). Forzamos la comprobación del servidor para no reutilizar el
// árbol ni el onboarding de la sesión anterior.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  return <ClientProviders>{children}</ClientProviders>;
}
