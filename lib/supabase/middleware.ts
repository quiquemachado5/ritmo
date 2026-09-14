import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login", "/registro", "/auth", "/bienvenida", "/recuperar", "/recuperar-contrasena", "/privacidad", "/offline", "/api/health"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Refresca la sesión de Supabase y protege las rutas privadas. */
export async function updateSession(request: NextRequest) {
  // Documentos públicos y el worker no necesitan una consulta de identidad.
  if (["/offline", "/privacidad", "/sw.js", "/api/health"].includes(request.nextUrl.pathname)) return NextResponse.next({ request });
  // RITMO requiere Supabase para todo; la validación ocurre en env.ts

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      const denied = NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      return denied;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
