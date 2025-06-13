self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
  // You can add custom caching logic here
  // For now, just log the fetch
  // console.log('Service Worker fetching:', event.request.url);
}); 