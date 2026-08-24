import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Refresca la sesión de Supabase y protege las rutas privadas (Next 16 "proxy"). */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
