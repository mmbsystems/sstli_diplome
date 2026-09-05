import type { NextConfig } from 'next';
import path from 'node:path';
import { basePath } from './lib/site';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  assetPrefix: `${basePath}/`,
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(process.cwd()),
};
export default nextConfig;
