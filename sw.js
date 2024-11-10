const GHPATH = '/lifts-tracker';
const APP_PREFIX = 'liftstracker_';
const VERSION = 'version_01';
const URLS = [    
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/css/styles.css`,
  `${GHPATH}/js/app.js`
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_PREFIX + VERSION).then((cache) => {
      return cache.addAll(URLS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key.startsWith(APP_PREFIX) && key !== APP_PREFIX + VERSION) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((request) => request || fetch(e.request))
  );
});
