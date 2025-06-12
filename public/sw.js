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

self.addEventListener("install", function (event) {
  console.log("[PWA Builder] Install Event processing");

  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then(function (cache) {
        console.log("[PWA Builder] Cached offline page during install");
        return cache.addAll(precacheFiles);
      }),
      caches.open(STATIC_CACHE).then(function (cache) {
        console.log("[PWA Builder] Cached static assets during install");
        return cache.addAll(STATIC_ASSETS);
      })
    ])
  );
});

// Allow sw to control of current page
self.addEventListener("activate", function (event) {
  console.log("[PWA Builder] Claiming clients for current page");
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (cacheName !== CACHE && cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
              console.log("[PWA Builder] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Handle fetch events
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Check if it's an API request
  if (API_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Check if it's a static asset
  if (STATIC_ASSETS.some(asset => url.pathname.startsWith(asset))) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // Default to network-first for other requests
  event.respondWith(handleDefaultRequest(event.request));
});

async function handleApiRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    const cache = await caches.open(API_CACHE);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await fromCache(request, API_CACHE);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function handleStaticRequest(request) {
  // Try cache first
  const cachedResponse = await fromCache(request, STATIC_CACHE);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fall back to network
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
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
    // Fall back to cache
    const cachedResponse = await fromCache(request, CACHE);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function fromCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  const matching = await cache.match(request);
  if (!matching || matching.status === 404) {
    return null;
  }
  return matching;
}
