import type { NextConfig } from "next";
import packageJson from "./package.json";

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || packageJson.version).slice(0, 12);

const nextConfig: NextConfig = {
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
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ''}`,
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${desarrollo ? ' ws:' : ''}`,
      desarrollo ? '' : "upgrade-insecure-requests",
    ].filter(Boolean).join('; ');
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
            value: 'SAMEORIGIN',
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
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
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
