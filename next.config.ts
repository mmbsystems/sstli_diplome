import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(process.cwd()),
  webpack(config) {
    // Poison even a direct JSON import from a Client Component.
    config.module.rules.push({
      test: /config[\\/]admins\.json$/,
      type: 'javascript/auto',
      use: path.resolve('scripts/server-only-json.cjs'),
    });
    return config;
  },
  async headers() {
    return [{source: '/:path*', headers: [
      {key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet'},
      {key: 'Cache-Control', value: 'private, no-store'},
    ]}];
  },
};
export default nextConfig;
