// This is the service worker with the Cache-first network

const CACHE = "precache";
const precacheFiles = [
  '/',
  '/dashboard',
  '/login',
  '/pos',
  '/reports',
  '/bulk-operations',
  '/settings',
  '/inventory',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-32x32.png',
  '/icons/icon-16x16.png',
  '/icons/safari-pinned-tab.svg',
  '/browserconfig.xml'
];

// Cache-first strategy for static assets
const STATIC_CACHE = "static-cache";
const STATIC_ASSETS = [
  '/icons/',
  '/manifest.json',
  '/browserconfig.xml'
];

// Network-first strategy for API requests
const API_CACHE = "api-cache";
const API_PATTERNS = [
  /^https:\/\/xugqiojkjvqzqewugldk\.supabase\.co\/.*$/,
  /^https:\/\/pos\.veylor360\.com\/api\/.*$/,
  /^https:\/\/pos-git-test-kellyhimselfs-projects\.vercel\.app\/api\/.*$/
];

// Firefox requires this to be at the top level
self.addEventListener('install', event => {
  console.log('[Service Worker] Install Event');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(precacheFiles);
      }),
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
    ]).catch(error => {
      console.error('[Service Worker] Cache failed:', error);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate Event');
  
  // Claim clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE && cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ]).catch(error => {
      console.error('[Service Worker] Activation failed:', error);
    })
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests that aren't in our API patterns
  if (!url.origin.includes(location.origin) && 
      !API_PATTERNS.some(pattern => pattern.test(url.href))) {
    return;
  }
  
  // Handle different types of requests
  if (API_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(handleApiRequest(event.request));
  } else if (STATIC_ASSETS.some(asset => url.pathname.startsWith(asset))) {
    event.respondWith(handleStaticRequest(event.request));
  } else {
    event.respondWith(handleDefaultRequest(event.request));
  }
});

async function handleApiRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    const cache = await caches.open(API_CACHE);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.log('[Service Worker] Network request failed, trying cache:', error);
    const cachedResponse = await fromCache(request, API_CACHE);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await fromCache(request, STATIC_CACHE);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fall back to network
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.error('[Service Worker] Static request failed:', error);
    throw error;
  }
}

async function handleDefaultRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.log('[Service Worker] Network request failed, trying cache:', error);
    const cachedResponse = await fromCache(request, CACHE);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function fromCache(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const matching = await cache.match(request);
    if (!matching || matching.status === 404) {
      return null;
    }
    return matching;
  } catch (error) {
    console.error('[Service Worker] Cache retrieval failed:', error);
    return null;
  }
}
