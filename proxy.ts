import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { contentSecurityPolicy } from "@/lib/security-policy";

/** Refresca la sesión de Supabase y protege las rutas privadas (Next 16 "proxy"). */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const securedRequest = new NextRequest(request, { headers: requestHeaders });
  const response = await updateSession(securedRequest);

  /* Security headers */
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-UA-Compatible', 'IE=edge');
  const localHostname = ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const secureRequest = forwardedProtocol ? forwardedProtocol === "https" : request.nextUrl.protocol === "https:";
  if (process.env.NODE_ENV === 'production' && secureRequest && !localHostname) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

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
