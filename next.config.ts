import type { NextConfig } from 'next';
import nextPWA from 'next-pwa';

const withPWA = nextPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  scope: '/',
  skipWaiting: true,
  sw: '/sw.js',
  buildExcludes: [/middleware-manifest.json$/],
  publicExcludes: ['!robots.txt', '!manifest.json'],
  // Precache critical assets
  additionalPrecaching: [
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/',
  ],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\/api\/.*$/i,
      handler: 'StaleWhileRevalidate', // Faster cache-first response with background update
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 200, // Increased for wholesale app data
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/xugqiojkjvqzqewugldk\.supabase\.co\/.*$/i,
      handler: 'StaleWhileRevalidate', // Serve cached Supabase data immediately
      options: {
        cacheName: 'supabase-cache',
        expiration: {
          maxEntries: 200, // Increased for larger datasets
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/pos\.veylor360\.com\/.*$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'app-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/pos-git-test-kellyhimselfs-projects\.vercel\.app\/.*$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'app-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins:
        process.env.NODE_ENV === 'production'
          ? ['pos.veylor360.com']
          : ['localhost:3000', 'pos.veylor360.com', 'pos-git-test-kellyhimselfs-projects.vercel.app'],
      bodySizeLimit: '2mb',
    },
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      { source: '/icons/:path*', destination: '/icons/:path*' },
      { source: '/manifest.json', destination: '/manifest.json' },
      { source: '/sw.js', destination: '/sw.js' },
    ];
  },
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://ik.imagekit.io; connect-src 'self' https://xugqiojkjvqzqewugldk.supabase.co ws://xugqiojkjvqzqewugldk.supabase.co; frame-src 'none'; object-src 'none';",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);