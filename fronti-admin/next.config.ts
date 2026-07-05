import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    if (!process.env.FRONTI_BACKEND_URL) {
      return [];
    }

    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.FRONTI_BACKEND_URL}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    if (process.env.FRONTI_DISABLE_WEBPACK_CACHE === '1') {
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
