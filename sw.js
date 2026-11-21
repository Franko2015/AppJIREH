/* Service Worker - Radio JIREH 103.5 FM */
const CACHE_NAME = 'jireh-pwa-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/config.js',
  './js/data.js',
  './js/admin.js',
  './js/main.js',
  './logo-radio.jpg',
  './radio.jpg',
  './assets/img/favicon.svg',
  './assets/img/banner-vivo.svg',
  './assets/img/fondo-cruz.jpg',
  './assets/img/app-icon-192.png',
  './assets/img/app-icon-512.png',
  './assets/img/app-icon-maskable-192.png',
  './assets/img/app-icon-maskable-512.png',
  './assets/img/apple-touch-icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.indexOf('jireh-pwa-') === 0 && k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // No cachear streams de audio ni APIs externas
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      // Sin conexión: servir la copia guardada (ignorando ?app=1 del ícono de la app)
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
