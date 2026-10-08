/* Service Worker — SWR for menu/app, images revalidate */
const CACHE_STATIC = 'oblako-static-v4';
const CACHE_IMAGES = 'oblako-images-v4';

const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './css/cart.css',
  './css/wow.css',
  './css/fun.css',
  './js/config.js',
  './js/data.js',
  './js/image-map.js',
  './js/rules.js',
  './js/app.js',
  './js/cart.js',
  './js/effects.js',
  './js/ui.js',
  './js/wow.js',
  './js/fun.js',
  './data/menu.json',
  './image/logo.webp',
  './image/favicon.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![CACHE_STATIC, CACHE_IMAGES].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isImage(url) {
  return /\.(webp|jpe?g|png|gif|svg)(\?|$)/i.test(url.pathname)
    || url.pathname.includes('/image/dishes/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // menu.json — stale while revalidate
  if (url.pathname.endsWith('/data/menu.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })());
    return;
  }

  if (isImage(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_IMAGES);
      const cached = await cache.match(req);
      const networkPromise = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      // Prefer fresh photo when online; fall back to cache offline
      try {
        const fresh = await networkPromise;
        if (fresh) return fresh;
      } catch (_) { /* ignore */ }
      return cached || Response.error();
    })());
    return;
  }

  // app shell — cache falling back to network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html'))) {
        const copy = res.clone();
        caches.open(CACHE_STATIC).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
