import type { NextConfig } from 'next';
const nextConfig: NextConfig = { transpilePackages: ['@weavia/ui', '@weavia/shared', '@weavia/auth-core'] };
export default nextConfig;
