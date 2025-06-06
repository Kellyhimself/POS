const CACHE_NAME = 'pos-cache-v1';
const OFFLINE_URL = '/offline';
const STATE_CACHE_NAME = 'app-state-v1';
const PAGE_CACHE_NAME = 'page-cache-v1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/_next/static/css/app.css',
  '/_next/static/js/main.js'
];

// Install event - cache static assets and initialize state cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(STATE_CACHE_NAME).then((cache) => {
        console.log('📦 Initializing state cache');
        return cache.put('/app-state', new Response(JSON.stringify({
          user: null,
          store: null,
          lastSync: null
        })));
      }),
      caches.open(PAGE_CACHE_NAME).then((cache) => {
        console.log('📦 Initializing page cache');
        return cache.addAll(['/inventory', '/dashboard', '/sales', '/reports']);
      })
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATE_CACHE_NAME && cacheName !== PAGE_CACHE_NAME) {
            console.log('🧹 Cleaning up old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper function to handle API requests
async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache successful API responses
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
    throw new Error('API request failed');
  } catch (error) {
    // Try to get cached response
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Helper function to handle static requests
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
    throw new Error('Static request failed');
  } catch (error) {
    return cache.match(OFFLINE_URL);
  }
}

// Helper function to handle navigation requests
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache the page for offline use
      const pageCache = await caches.open(PAGE_CACHE_NAME);
      await pageCache.put(request, response.clone());
      return response;
    }
    throw new Error('Navigation request failed');
  } catch (error) {
    // Try to get cached page
    const pageCache = await caches.open(PAGE_CACHE_NAME);
    const cachedPage = await pageCache.match(request);
    if (cachedPage) {
      return cachedPage;
    }
    return caches.match(OFFLINE_URL);
  }
}

// Helper function to handle state requests
async function handleStateRequest(request) {
  const cache = await caches.open(STATE_CACHE_NAME);
  const cachedState = await cache.match('/app-state');
  if (cachedState) {
    return cachedState;
  }
  return new Response(JSON.stringify({
    user: null,
    store: null,
    lastSync: null
  }));
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle state requests
  if (url.pathname === '/app-state') {
    event.respondWith(handleStateRequest(request));
    return;
  }

  // Handle static asset requests
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default handling for other requests
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

// Handle sync events
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-state') {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(STATE_CACHE_NAME);
          const state = await cache.match('/app-state');
          if (state) {
            const stateData = await state.json();
            // Update state with current timestamp
            stateData.lastSync = Date.now();
            await cache.put('/app-state', new Response(JSON.stringify(stateData)));
            console.log('✅ State synced successfully');
          }
        } catch (error) {
          console.error('❌ Error syncing state:', error);
        }
      })()
    );
  }
});

// Handle message events
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 