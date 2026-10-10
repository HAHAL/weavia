import type { NextConfig } from 'next';

const backend = process.env.WEAVIA_BACKEND_URL ?? 'http://localhost:8080';
const nextConfig: NextConfig = {
  transpilePackages: ['@weavia/ui', '@weavia/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};
export default nextConfig;
