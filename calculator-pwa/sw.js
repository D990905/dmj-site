/* ==========================================================================
   단무지공방 — Lifting Calculator PWA Service Worker
   v1 (2026-05-19) — Cache-first for app shell, network fallback.
   ========================================================================== */

const CACHE_VERSION = 'dmj-lift-calc-v1.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/lift-calculator.js',
  './js/foil-presets.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/favicon.svg'
];

// install — precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // addAll fails atomically — if any miss, install fails. Use individual adds for resilience.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] precache miss:', url, err && err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch — cache-first for app shell; network-first for everything else (no runtime data anyway)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful GETs for next time (best-effort)
        if (res && res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // Offline fallback to root index for navigation requests
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// allow page to trigger immediate activate
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
