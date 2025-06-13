const CACHE_NAME = 'pos-app-cache-v1';
const OFFLINE_URL = '/offline.html'; // Optional: create this in /public

const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-32x32.png',
  '/icons/icon-16x16.png',
  '/icons/icon-192x192.png',
  '/icons/icon-144x144.png',
  '/icons/icon-512x512.png',
  // Add more static assets as needed
  OFFLINE_URL,
  '/pos',
  '/inventory',
  '/dashboard',
  '/settings',
  '/reports',
  '/bulk-operations'
];

// Install: cache app shell and assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
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
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, then network, then offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((response) => {
          // Optionally cache new requests here
          return response;
        })
        .catch(() => {
          // If request is for a navigation to a page, show offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});