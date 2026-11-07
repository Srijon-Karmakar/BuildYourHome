/* PlotFramer service worker (generated into dist/sw.js at build time; see vite.config.ts).
 * - The app shell (page, scripts, styles, fonts, icons) is stored on install, so the app opens without internet.
 * - Texture photos and anything else from this site are kept the first time they are used.
 * - Requests to other sites (the account / cloud service) are never touched: signing in and sharing need internet.
 */
const VERSION = '__VERSION__';
const SHELL = `plotframer-shell-${VERSION}`;
const RUNTIME = 'plotframer-runtime-v1';
const PRECACHE = []; /* __PRECACHE__ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('plotframer-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromCacheOrNetwork(request, cacheName) {
  const cached = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(cacheName).then((c) => c.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // the cloud service and other sites: never cached

  // Opening the app: try the network (so updates arrive), fall back to the stored page when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((c) => c.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Hashed files never change: stored copy first. Photos, icons, fonts: stored after first use.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/textures/') || /\.(png|jpe?g|webp|svg|woff2?|webmanifest)$/.test(url.pathname)) {
    event.respondWith(fromCacheOrNetwork(request, RUNTIME));
    return;
  }

  // Anything else on this site: show the stored copy at once and refresh it in the background.
  event.respondWith(
    caches.match(request, { ignoreSearch: true, ignoreVary: true }).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});
