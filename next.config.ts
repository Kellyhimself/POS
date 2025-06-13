import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'pos.veylor360.com', 'pos-git-test-kellyhimselfs-projects.vercel.app'],
      bodySizeLimit: '2mb'
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        zlib: false,
        http: false,
        https: false,
        path: false,
        os: false,
        'png-js': false,
        'pdfkit': false,
      }
    }
    return config
  },
  async rewrites() {
    return [
      { source: '/icons/:path*', destination: '/icons/:path*' }
    ]
  },
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      }
    ]
  },
};

export default nextConfig;