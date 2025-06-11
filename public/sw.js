const CACHE_NAME = 'pos-cache-v1';
const OFFLINE_URL = '/offline';
const STATE_CACHE_NAME = 'app-state-v1';
const PAGE_CACHE_NAME = 'page-cache-v1';

// All navigation routes from Sidebar
const NAVIGATION_ROUTES = [
  '/dashboard',
  '/pos',
  '/inventory',
  '/reports',
  '/settings',
  '/bulk-operations'
];

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/next.svg',
  '/_next/static/css/app.css',
  '/_next/static/js/main.js'
];

// Install event - cache static assets and initialize state cache
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installing...');
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
        return cache.addAll(NAVIGATION_ROUTES);
      })
    ]).then(() => {
      console.log('✅ Service Worker installed successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...');
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
    }).then(() => {
      console.log('✅ Service Worker activated successfully');
      return self.clients.claim();
    })
  );
});

// Helper function to handle static requests
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('📦 Serving static asset from cache:', request.url);
    return cachedResponse;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      console.log('📦 Cached new static asset:', request.url);
      return response;
    }
    throw new Error('Static request failed');
  } catch (error) {
    console.log('⚠️ Static request failed, trying cache:', request.url);
    // Try to serve from cache even if it's not an exact match
    const cachedResponse = await cache.match(request.url);
    if (cachedResponse) {
      console.log('📦 Serving static asset from cache (fallback):', request.url);
      return cachedResponse;
    }
    console.log('❌ No cached version available for:', request.url);
    return caches.match(OFFLINE_URL);
  }
}

// Helper function to handle navigation requests
async function handleNavigationRequest(request) {
  const url = new URL(request.url);
  const pageCache = await caches.open(PAGE_CACHE_NAME);
  
  try {
    // Try network first
    const response = await fetch(request);
    if (response.ok) {
      // Cache the page for offline use
      await pageCache.put(request, response.clone());
      console.log('📦 Cached new page:', url.pathname);
      return response;
    }
    throw new Error('Navigation request failed');
  } catch (error) {
    console.log('⚠️ Navigation request failed, trying cache:', url.pathname);
    // Try to get cached page
    const cachedPage = await pageCache.match(request);
    if (cachedPage) {
      console.log('📦 Serving page from cache:', url.pathname);
      return cachedPage;
    }
    
    // If the requested page is in our navigation routes, try to serve it from cache
    if (NAVIGATION_ROUTES.includes(url.pathname)) {
      const cachedResponse = await pageCache.match(url.pathname);
      if (cachedResponse) {
        console.log('📦 Serving navigation route from cache:', url.pathname);
        return cachedResponse;
      }
    }
    
    console.log('❌ No cached version available for:', url.pathname);
    // Only show offline page if we can't serve any cached content
    return caches.match(OFFLINE_URL);
  }
}

// Helper function to handle state requests
async function handleStateRequest() {
  const cache = await caches.open(STATE_CACHE_NAME);
  const cachedState = await cache.match('/app-state');
  if (cachedState) {
    console.log('📦 Serving state from cache');
    return cachedState;
  }
  console.log('📦 Initializing new state');
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

  // Handle API requests - let them pass through to IndexedDB
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open('api-cache').then(cache => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('⚠️ API request failed, returning offline response');
          // For API requests, we don't want to show the offline page
          // Instead, let the app handle the offline state
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Handle state requests
  if (url.pathname === '/app-state') {
    event.respondWith(handleStateRequest());
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
    fetch(request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clonedResponse);
          });
        }
        return response;
      })
      .catch(() => {
        console.log('⚠️ Request failed, trying cache:', request.url);
        return caches.match(request).then((response) => {
          if (response) {
            console.log('📦 Serving from cache:', request.url);
            return response;
          }
          // Only show offline page for navigation requests
          if (request.mode === 'navigate') {
            console.log('❌ No cached version available, showing offline page');
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