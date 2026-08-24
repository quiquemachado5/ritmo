import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopack: {
      resolveAlias: {}
    }
  },
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.0.110']
};

export default nextConfig;
