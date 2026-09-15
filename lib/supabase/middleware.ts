import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { rutaInternaSegura } from "@/lib/auth-redirect";

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
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
        );
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Una redirección también debe entregar la renovación o eliminación de
  // cookies. Ninguna respuesta dependiente de sesión puede compartirse en caché.
  function withSession(target: NextResponse) {
    response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
    target.headers.set("Cache-Control", "private, no-store, max-age=0");
    for (const name of ["Pragma", "Expires"]) {
      const value = response.headers.get(name);
      if (value) target.headers.set(name, value);
    }
    return target;
  }

  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return withSession(NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 }));
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return withSession(NextResponse.redirect(url));
  }

  if (user && (pathname === "/login" || pathname === "/registro")) {
    const next = rutaInternaSegura(request.nextUrl.searchParams.get("next"));
    let url = new URL(next, request.url);
    if (["/login", "/registro"].includes(url.pathname.replace(/\/$/, ""))) url = new URL("/", request.url);
    return withSession(NextResponse.redirect(url));
  }

  if (user && !response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
