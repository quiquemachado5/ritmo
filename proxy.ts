import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Refresca la sesión de Supabase y protege las rutas privadas (Next 16 "proxy"). */
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  /* Security headers */
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-UA-Compatible', 'IE=edge');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');

  /* CORS para API */
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'http://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);

    if (allowedOrigins.includes(origin || '')) {
      response.headers.set('Access-Control-Allow-Origin', origin || '');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
