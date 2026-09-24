/* Trial Garden Field — service worker
   Bump CACHE version when you change the app files so phones pick up the new build. */
const CACHE = "trialgarden-field-v8-2026-09-24r5";
const ROOT = new URL("./", self.location.href);
const OFFLINE_URL = new URL("./", ROOT).href;
const SHELL = [
  "./",
  "./mobile-manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./redirect.html"
].map(p => new URL(p, ROOT).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache Microsoft auth or Graph API responses
  if (
    url.hostname.endsWith("login.microsoftonline.com") ||
    url.hostname.endsWith("msauth.net") ||
    url.hostname.endsWith("graph.microsoft.com") ||
    url.hostname.endsWith("1drv.ms")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // Network-first for same-origin, cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(m => m || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Cache-first for third-party (like MSAL browser lib)
  event.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(res => {
        if (res && res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
