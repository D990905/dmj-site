/* SailTech Orchestrator Dashboard — service worker (Phase 1)
   Strategy:
   - app shell: cache-first
   - cytoscape CDN: stale-while-revalidate
   - everything else: network-first w/ cache fallback
   Versioned cache so bumping CACHE_VERSION invalidates old assets.
*/
const CACHE_VERSION = 'sailtech-orchestrator-v3-oval'; // bumped: mobile oval layout
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './data.sample.js',
  './styles.css',
  './manifest.json',
  './icons/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cytoscape CDN — stale-while-revalidate
  if (url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async cache => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Same-origin: cache-first for app shell, network-first otherwise
  if (url.origin === self.location.origin) {
    const isShell = APP_SHELL.some(s => url.pathname.endsWith(s.replace(/^\.\//, '')));
    if (isShell) {
      event.respondWith(
        caches.match(req).then(c => c || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
          return res;
        }))
      );
    } else {
      event.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
          return res;
        }).catch(() => caches.match(req))
      );
    }
  }
});
