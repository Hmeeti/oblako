/* OBLAKO service worker
   - app shell & menu data: network first, cache as offline fallback (prices are always fresh)
   - dish photos: cache first (URLs carry ?v=PHOTO_VER, so a new photo = a new URL) */
const VERSION = 'v11';
const CACHE_STATIC = `oblako-static-${VERSION}`;
const CACHE_IMAGES = `oblako-images-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './css/style.css?v=11',
  './css/cart.css?v=11',
  './js/config.js?v=11',
  './js/data.js?v=11',
  './js/image-map.js?v=11',
  './js/rules.js?v=11',
  './js/app.js?v=11',
  './js/cart.js?v=11',
  './js/ui.js?v=11',
  './image/logo.webp',
  './image/favicon.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_IMAGES).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isImage(url) {
  return /\.(webp|jpe?g|png|gif|svg)$/i.test(url.pathname);
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_STATIC);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // menu.json is requested with a cache-busting query — match it without one offline
    const cached = await cache.match(req, { ignoreSearch: req.url.includes('/data/menu.json') });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_IMAGES);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(isImage(url) ? cacheFirst(req) : networkFirst(req));
});
