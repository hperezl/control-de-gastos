/* Service worker: makes the app installable on Android and usable offline.
   Runtime caching only — nothing to precache by filename, since every local
   CSS/JS URL already carries a ?v=YYYYMMDDx cache-buster (see index.html).
   That means: cache-first is safe for those (a given URL's content never
   changes), while the app shell (index.html / navigations) stays
   network-first so a new deploy shows up immediately when online. */
const CACHE_NAME = "cdg-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isAppShell = req.mode === "navigate" || req.url.endsWith(".html");

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Clone synchronously, right here — once this callback yields, the
          // response body may already be getting streamed to the page, and a
          // clone() after that point throws "body is already used".
          const resCopy = res.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, resCopy)));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const resCopy = res.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, resCopy)));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
