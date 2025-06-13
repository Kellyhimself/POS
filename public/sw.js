const CACHE_NAME = 'pos-app-cache-v1';
const NEXT_STATIC_CACHE = 'next-static-assets-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Only cache static assets and offline fallback
  OFFLINE_URL
  // Do NOT include route URLs like '/pos', '/inventory', etc. here.
  // Next.js routes are server-rendered and may not be cacheable as static files.
];

// Install: cache app shell and assets, handle errors gracefully
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          fetch(url)
            .then((response) => {
              if (!response.ok) throw new Error(`Request for ${url} failed`);
              return cache.put(url, response);
            })
            .catch((err) => {
              console.warn('Asset failed to cache:', url, err);
            })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== NEXT_STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, then network, then offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Runtime cache for Next.js static assets (JS/CSS chunks, fonts, etc.)
  if (event.request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.open(NEXT_STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request)
            .then((response) => {
              cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => {
              // Always return a valid Response, even if it's an error
              return new Response('', { status: 503, statusText: 'Service Unavailable' });
            });
        })
      )
    );
    return;
  }

  // Runtime cache for icons, fonts, images, etc.
  if (event.request.url.includes('/icons/') || event.request.destination === 'image' || event.request.destination === 'font') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request)
            .then((response) => {
              cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => {
              return new Response('', { status: 503, statusText: 'Service Unavailable' });
            });
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((response) => {
          // Optionally cache new requests here
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            // Serve the app shell (/) for all navigation requests
            // This allows the SPA to handle routing and render the correct page using IndexedDB
            return caches.match('/') || caches.match(OFFLINE_URL) || new Response('', { status: 503, statusText: 'Service Unavailable' });
          }
          // For all other requests, return a 503 error Response
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});