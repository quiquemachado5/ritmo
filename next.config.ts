import type { NextConfig } from "next";
import packageJson from "./package.json";

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || packageJson.version).slice(0, 12);

const nextConfig: NextConfig = {
  // El indicador de desarrollo tapa «Hoy» en el viewport móvil de E2E.
  // Esto no oculta errores de compilación/runtime ni modifica producción.
  devIndicators: process.env.RITMO_E2E === "1" ? false : undefined,
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_RITMO_BUILD_ID: buildId,
  },
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.0.110'],

  /* Optimizaciones de imagen y performance */
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  /* Compresión y caché */
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  /* Security headers */
  async headers() {
    const desarrollo = process.env.NODE_ENV !== 'production';
    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://ritmo.app');
    // Safari también actualiza los activos de loopback a HTTPS. Un servidor
    // local HTTP de producción no ofrece TLS; los dominios publicados sí.
    const localHttp = appOrigin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(appOrigin.hostname);
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Origin-Agent-Cluster',
            value: '?1',
          },
          ...(desarrollo || localHttp ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }]),
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
        ],
      },
    ];
  },

  /* Redirects para SEO */
  async redirects() {
    return [
      {
        source: '/index.html',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
