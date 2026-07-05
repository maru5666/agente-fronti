import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    if (process.env.FRONTI_DISABLE_WEBPACK_CACHE === '1') {
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
