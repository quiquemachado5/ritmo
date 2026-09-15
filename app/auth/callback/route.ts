import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const next = rutaInternaSegura(searchParams.get("next"));
  const redirect = (path: string) => NextResponse.redirect(new URL(path, origin), {
    headers: { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" },
  });

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!error) return redirect(next);
    } catch {
      // Un enlace caducado o un proveedor temporalmente caído vuelve al acceso.
      // El código de un solo uso no debe aparecer en logs ni en el destino.
    }
  }

  return redirect("/login");
}
