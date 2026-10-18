/**
 * Standalone Service Worker for Offline Caching
 */

const CACHE_NAME = 'sastc-portal-v2.2.0';
const DATA_CACHE_NAME = 'sastc-data-cache-v2.2.0';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/sastc-notices.json',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://i.ibb.co.com/7JnHCrB5/Chat-GPT-Image-Jul-29-2026-09-55-12-PM.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DATA_CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Cache API notices and results
  if (url.includes('notices.json') || url.includes('results.json')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
            return response;
          }
          return cache.match(event.request).then(cached => cached || response);
        }).catch(() => {
          // Offline fallback
          return cache.match(event.request);
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
