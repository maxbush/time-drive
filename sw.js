// Cache-first for heavy static assets (GLB models, fonts): GitHub Pages only
// holds a 10-minute cache, so repeat visits re-download megabytes otherwise.
const CACHE = 'td-assets-v4'; // bump when a .glb changes: the cache is cache-first, old entries are purged on activate
const MATCH = /\.(glb|woff2?|ttf|otf)(\?|$)/;

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !MATCH.test(url.pathname)) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
