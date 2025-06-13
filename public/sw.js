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

// Updated NEXT_STATIC_ASSETS to include missing chunk filenames from error logs
const NEXT_STATIC_ASSETS = [
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/pages/_app.js',
  '/_next/static/chunks/pages/_error.js',
  '/_next/static/chunks/pages/pos.js',
  '/_next/static/chunks/pages/inventory.js',
  '/_next/static/chunks/pages/dashboard.js',
  '/_next/static/chunks/pages/reports.js',
  '/_next/static/chunks/pages/settings.js',
  '/_next/static/chunks/pages/bulk-operations.js',
  '/_next/static/css/app.css',
  // Added missing chunk filenames from error logs
  '/_next/static/chunks/webpack-1ccbf55278267827.js',
  '/_next/static/chunks/4bd1b696-809dc8533c674123.js',
  '/_next/static/chunks/main-app-d41d56f775a954bb.js',
  '/_next/static/chunks/1108-5ba73e9f29a5063c.js',
  '/_next/static/chunks/6671-be7f8f49a8f75bd4.js',
  '/_next/static/chunks/app/layout-81b4e15978189f07.js',
  '/_next/static/chunks/app/page-10d169074b71cf3d.js',
  // Added font preload
  '/_next/static/media/e4af272ccee01ff0-s.p.woff2',
  // Existing chunk filenames from .next/static/chunks
  '/_next/static/chunks/[root-of-the-server]__5ccb4ec7._.js',
  '/_next/static/chunks/[root-of-the-server]__7db745e8._.css',
  '/_next/static/chunks/src_app_globals_css_f9ee138c._.single.css',
  '/_next/static/chunks/src_app_page_tsx_c50bdba1._.js',
  '/_next/static/chunks/src_app_(auth)_login_page_tsx_c50bdba1._.js',
  '/_next/static/chunks/_f25013a5._.js',
  '/_next/static/chunks/src_app_not-found_tsx_c50bdba1._.js',
  '/_next/static/chunks/[next]_internal_font_google_inter_59dee874_module_css_f9ee138c._.single.css',
  '/_next/static/chunks/src_app_(dashboard)_layout_tsx_c50bdba1._.js',
  '/_next/static/chunks/src_app_(dashboard)_dashboard_page_tsx_63d9e8c0._.js',
  '/_next/static/chunks/node_modules_@supabase_node-fetch_browser_78c6afe4.js',
  '/_next/static/chunks/src_app_layout_tsx_ea9287a8._.js',
  '/_next/static/chunks/src_a02c5fb4._.js',
  '/_next/static/chunks/src_app_(dashboard)_layout_tsx_a1249c27._.js',
  '/_next/static/chunks/_2d4a3e3d._.js',
  '/_next/static/chunks/node_modules_126af1e4._.js',
  '/_next/static/chunks/[root-of-the-server]__d2d202c8._.js',
  '/_next/static/chunks/[root-of-the-server]__8df7605f._.js',
  '/_next/static/chunks/pages__error_52913c4d._.js',
  '/_next/static/chunks/[root-of-the-server]__923cb372._.js',
  '/_next/static/chunks/pages__error_5771e187._.js',
  '/_next/static/chunks/[root-of-the-server]__e2c08166._.js',
  '/_next/static/chunks/node_modules_react-dom_82bb97c6._.js',
  '/_next/static/chunks/node_modules_04bbe746._.js',
  '/_next/static/chunks/pages__app_5771e187._.js',
  '/_next/static/chunks/[root-of-the-server]__49fd8634._.js',
  '/_next/static/chunks/pages__app_0c0fca67._.js',
  '/_next/static/chunks/src_app_favicon_ico_mjs_65a2b8d0._.js',
  '/_next/static/chunks/node_modules_next_dist_compiled_2ce9398a._.js',
  '/_next/static/chunks/node_modules_next_dist_client_8f19e6fb._.js',
  '/_next/static/chunks/node_modules_next_dist_2ecbf5fa._.js',
  '/_next/static/chunks/node_modules_next_dist_build_polyfills_polyfill-nomodule.js',
  '/_next/static/chunks/node_modules_@supabase_node-fetch_browser_4e855e84.js',
  '/_next/static/chunks/_b581757f._.js',
  '/_next/static/chunks/[turbopack]_browser_dev_hmr-client_hmr-client_ts_c20f642f._.js',
  '/_next/static/chunks/[root-of-the-server]__dddb2219._.css',
  '/_next/static/chunks/node_modules_next_dist_b758c999._.js',
  '/_next/static/chunks/[turbopack]_browser_dev_hmr-client_hmr-client_ts_3cd0d838._.js',
  '/_next/static/chunks/node_modules_next_dist_1a6ee436._.js',
  '/_next/static/chunks/[next]_internal_font_google_inter_e345bb4c_module_css_f9ee138c._.single.css',
  '/_next/static/chunks/ed0b0_@swc_helpers_cjs_d9e50ee1._.js',
  '/_next/static/chunks/node_modules_2e209479._.js',
  '/_next/static/chunks/[turbopack]_browser_dev_hmr-client_hmr-client_ts_61dcf9ba._.js',
  '/_next/static/chunks/_63242f4a._.js',
  '/_next/static/chunks/[root-of-the-server]__dddb2219._.css',
  '/_next/static/chunks/src_app_page_tsx_a1249c27._.js',
  '/_next/static/chunks/node_modules_next_dist_2ecbf5fa._.js',
  '/_next/static/chunks/_b581757f._.js',
  '/_next/static/chunks/node_modules_2e209479._.js',
  '/_next/static/chunks/_e69f0d32._.js',
  '/_next/static/chunks/src_app_not-found_tsx_a1249c27._.js',
  '/_next/static/chunks/node_modules_next_dist_client_8f19e6fb._.js',
  '/_next/static/chunks/node_modules_next_dist_b758c999._.js',
  '/_next/static/chunks/node_modules_next_dist_compiled_2ce9398a._.js',
  '/_next/static/chunks/node_modules_@supabase_node-fetch_browser_4e855e84.js',
  '/_next/static/chunks/[turbopack]_browser_dev_hmr-client_hmr-client_ts_61dcf9ba._.js',
  '/_next/static/chunks/bc98253f.a20b3a3cf1b114d6.js',
  '/_next/static/chunks/ad2866b8.1fc071285e350c45.js',
  '/_next/static/chunks/2121.53188f93655a7ff0.js',
  '/_next/static/chunks/822.d1eebe7df2d8fc0a.js',
  '/_next/static/chunks/1737-74e86419b56c112e.js',
  '/_next/static/chunks/5284-c923cf3e10def213.js',
  '/_next/static/chunks/6904-d9b66b0c956c758d.js',
  '/_next/static/chunks/polyfills-42372ed130431b0a.js',
  '/_next/static/chunks/4416-b1d24f9015879f11.js',
  '/_next/static/chunks/6172-55df0d2eb9f2e933.js',
  '/_next/static/chunks/1684-408f0b22278f0aa2.js',
  '/_next/static/chunks/5779-4f81df6e5b27b76b.js',
  '/_next/static/chunks/8428-2b1c0b3ff0343358.js',
  '/_next/static/chunks/4924-916ff8dfa5216b87.js',
  '/_next/static/chunks/5178-73b7c66691a9a64d.js',
  '/_next/static/chunks/2960-d70bc9139c8c4562.js',
  '/_next/static/chunks/5890-b2248bdcc1b9ef88.js',
  '/_next/static/chunks/6967-c85b6e24cd6faa99.js',
  '/_next/static/chunks/6874-09ecb0dcf2ce2534.js'
];

// Modified install event to precache critical Next.js static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
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
      }),
      caches.open(NEXT_STATIC_CACHE).then((cache) => {
        return Promise.all(
          NEXT_STATIC_ASSETS.map((url) =>
            fetch(url)
              .then((response) => {
                if (!response.ok) throw new Error(`Request for ${url} failed`);
                return cache.put(url, response);
              })
              .catch((err) => {
                console.warn('Next.js asset failed to cache:', url, err);
              })
          )
        );
      })
    ])
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

// Modified fetch event to serve the app shell for navigation requests and let React handle client-side routing
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Handle navigation requests (e.g., /dashboard, /inventory)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((response) => {
        if (response) {
          // Return the cached app shell and let React handle client-side routing
          return response;
        }
        return fetch(event.request).catch(() => caches.match(OFFLINE_URL));
      })
    );
    return;
  }

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