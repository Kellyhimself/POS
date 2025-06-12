// Import Workbox from CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

const CACHE_VERSION = 'v1';
const PRECACHE = `precache-${CACHE_VERSION}`;
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const API_CACHE = `api-cache-${CACHE_VERSION}`;

// Precache critical static assets
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-32x32.png',
  '/icons/icon-16x16.png',
  '/icons/safari-pinned-tab.svg',
  '/browserconfig.xml'
];

// Static assets for cache-first strategy
const STATIC_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-32x32.png',
  '/icons/icon-16x16.png',
  '/icons/safari-pinned-tab.svg',
  '/browserconfig.xml',
  '/manifest.json'
];

// API patterns for network-first strategy
const API_PATTERNS = [
  /^https:\/\/xugqiojkjvqzqewugldk\.supabase\.co\/.*$/,
  /^https:\/\/pos\.veylor360\.com\/api\/.*$/,
  /^https:\/\/pos-git-test-kellyhimselfs-projects\.vercel\.app\/api\/.*$/
];

// Install event: Precache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install Event');
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching precache assets');
        return Promise.all(
          PRECACHE_ASSETS.map((url) =>
            cache.add(url).catch((error) => {
              console.error(`[Service Worker] Failed to cache ${url}:`, error);
            })
          )
        );
      })
      .then(() => {
        console.log('[Service Worker] Install completed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

// Activate event: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate Event');
  const currentCaches = [PRECACHE, STATIC_CACHE, API_CACHE];
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        )
      )
    ])
      .then(() => {
        console.log('[Service Worker] Activation completed');
      })
      .catch((error) => {
        console.error('[Service Worker] Activation failed:', error);
      })
  );
});

// Workbox routing for static assets, APIs, and fonts
workbox.routing.registerRoute(
  ({ url }) => STATIC_ASSETS.includes(url.pathname),
  new workbox.strategies.CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

workbox.routing.registerRoute(
  ({ url }) => API_PATTERNS.some((pattern) => pattern.test(url.href)),
  new workbox.strategies.NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 10,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60 // 1 day
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

workbox.routing.registerRoute(
  ({ url }) => url.pathname.match(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i),
  new workbox.strategies.CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 64,
        maxAgeSeconds: 24 * 60 * 60 // 1 day
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

workbox.routing.registerRoute(
  ({ url }) => url.pathname.match(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i),
  new workbox.strategies.CacheFirst({
    cacheName: 'static-font-assets',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 4,
        maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

workbox.routing.registerRoute(
  ({ url }) => url.pathname.match(/\.(?:js|css)$/i),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60 // 1 day
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

// Fallback for other GET requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    console.log('[Service Worker] Skipping non-GET request:', event.request.url);
    return;
  }

  // Let Workbox handle registered routes
  if (workbox.routing.routes.some((route) => route.test({ url: new URL(event.request.url) }))) {
    return;
  }

  // Default: Network-first for non-static, non-API requests
  console.log('[Service Worker] Handling default request:', event.request.url);
  event.respondWith(
    caches.open(PRECACHE)
      .then((cache) =>
        fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone());
            console.log('[Service Worker] Cached default response:', event.request.url);
            return response;
          })
          .catch(() => {
            console.log('[Service Worker] Default network failed, trying cache:', event.request.url);
            return cache.match(event.request) || new Response('Offline', { status: 503 });
          })
      )
      .catch((error) => {
        console.error('[Service Worker] Fetch failed:', event.request.url, error);
        return new Response('Offline', { status: 503 });
      })
  );
});

// Log Workbox initialization
console.log('[Service Worker] Workbox loaded:', workbox);