// Bumped to v3 on 2026-04-09 to fix POST/API interception breaking
// /api/property-signals and other dynamic endpoints. Bumping the version
// invalidates every returning visitor's stale cache.
// v4 (2026-04-09): plumbing analyzer accuracy overhaul (multi-pass Tesseract,
// multi-strategy regex, opt-in AI). Bump invalidates returning visitors' caches
// so they get the new plumbing-quote-analyzer.html and compare-plumbing-quotes.html.
// v7 (2026-04-27): Trudy retired; precache referenced dead Trudy image URLs
// which made cache.addAll() reject (atomic), breaking the SW install for new
// visitors. Precache trimmed to canonical assets only; Iris images are
// runtime-cached lazily via the fetch handler below.
const CACHE_NAME = "woogoro-v7";
const PRECACHE = [
  "/",
  "/css/woogoro.min.css",
  "/images/Iris/Iris%20color%20side%20silhouette.webp"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Never intercept non-GET requests (POST/PUT/DELETE etc) — POST bodies
  // can't be cached and intercepting them breaks API calls.
  if (e.request.method !== "GET") return;
  // Never intercept API calls — they need fresh network responses.
  if (e.request.url.includes("/api/")) return;
  // Never intercept cross-origin requests (CDNs, analytics, etc.)
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached || Response.error());
      // Always return a Promise that resolves to a Response, never undefined
      return cached || fetched;
    })
  );
});
