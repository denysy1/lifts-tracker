const CACHE_NAME = 'lifts-tracker-cache-v0.3.0';
const URLS_TO_CACHE = [
  '/lifts-tracker/',
  '/lifts-tracker/index.html',
  '/lifts-tracker/css/styles.css',
  '/lifts-tracker/js/app.js',
  '/lifts-tracker/manifest.webmanifest',
  '/lifts-tracker/img/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

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
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('updatefound', () => {
  const newWorker = self.registration.installing;
  newWorker.onstatechange = () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      alert('A new version of the app is available. Please refresh!');
    }
  };
});
