import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

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
    /* Match all request paths except for the ones starting with:
       - api (API routes)
       - _next/static (static files)
       - _next/image (image optimization files)
       - favicon.ico (favicon file)
       - public folder
    */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
