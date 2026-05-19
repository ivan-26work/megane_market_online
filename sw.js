const CACHE_NAME = 'megane-market-v1';
const urlsToCache = [
  '/megane_market_online/',
  '/megane_market_online/index.html',
  '/megane_market_online/market.html',
  '/megane_market_online/viewproduct.html',
  '/megane_market_online/profil.html',
  '/megane_market_online/search.html',
  '/megane_market_online/login.html',
  '/megane_market_online/assets/logo.png'
];

self.addEventListener('install', event => {
  console.log('Service Worker installation');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Erreur cache:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activé');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Ancien cache supprimé:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
      .catch(() => {
        return caches.match('/megane_market_online/index.html');
      })
  );
});
