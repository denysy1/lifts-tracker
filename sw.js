const CACHE_NAME = 'lifts-tracker-cache-v0.3.1';
const URLS_TO_CACHE = [
  '/lifts-tracker/',
  '/lifts-tracker/index.html',
  '/lifts-tracker/css/styles.css',
  '/lifts-tracker/js/app.js',
  '/lifts-tracker/manifest.webmanifest',
  '/lifts-tracker/img/favicon.ico'
];

// Install event: Cache resources and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting(); // Activate new service worker immediately
});

// Activate event: Clean up old caches and take control of clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
});

// Fetch event: Respond with cached resources or fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => {
          // Optional offline fallback
          if (event.request.destination === 'document') {
            return caches.match('/lifts-tracker/index.html');
          }
        })
      );
    })
  );
});
