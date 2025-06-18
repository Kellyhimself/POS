const APP_SHELL_CACHE = 'pos-app-shell-v1';
const DYNAMIC_STATIC_CACHE = 'pos-dynamic-static-v1';
const OFFLINE_URL = '/offline.html';

const APP_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html',
  // Main routes to precache
  '/dashboard',
  '/pos',
  '/inventory',
  '/reports',
  '/settings',
  '/bulk-operations'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== APP_SHELL_CACHE && name !== DYNAMIC_STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Dynamically cache all Next.js/static assets, icons, css, media
  if (
    url.includes('/_next/static/') ||
    url.includes('/static/') ||
    url.includes('/icons/') ||
    url.includes('/css/') ||
    url.includes('/media/')
  ) {
    event.respondWith(
      caches.open(DYNAMIC_STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request)
            .then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => {
              // Optionally return a fallback (e.g., offline image/font)
              return new Response('', { status: 503 });
            });
        })
      )
    );
    return;
  }

  // Handle navigation requests (e.g., /dashboard, /inventory)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the successful response in app shell cache
          const responseToCache = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Try to get the requested URL from cache
          return caches.match(event.request.url)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, try to get the app shell
              return caches.match('/')
                .then((shellResponse) => {
                  if (shellResponse) {
                    return shellResponse;
                  }
                  // If all else fails, show offline page
                  return caches.match(OFFLINE_URL);
                });
            });
        })
    );
    return;
  }

  // Default fetch handler
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((response) => {
          // Cache successful responses in app shell cache
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/') || caches.match(OFFLINE_URL);
          }
          return new Response('', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
    })
  );
});