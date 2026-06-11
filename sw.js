const CACHE_VERSION = "tradeiq-pro-v1";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const withBase = path => `${BASE_PATH}${path}`;
const APP_SHELL = [withBase("/"), withBase("/offline.html"), withBase("/manifest.json")];
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
            .map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const shouldBypassCache = request => {
  const url = new URL(request.url);

  return (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/oauth/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/stripe/") ||
    url.pathname.includes("webhook")
  );
};

self.addEventListener("fetch", event => {
  const { request } = event;

  if (shouldBypassCache(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(withBase("/offline.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
