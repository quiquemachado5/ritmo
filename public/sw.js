/* Solo activos públicos. Nunca cachea HTML privado, respuestas RSC ni API. */
const VERSION = "ritmo-" + (new URL(self.location.href).searchParams.get("v") || "dev");
const STATIC_CACHE = VERSION + "-static";
const OFFLINE_URL = "/offline";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll([OFFLINE_URL, "/manifest.json", "/icon"])));
  // Una versión nueva espera confirmación: no interrumpe un formulario abierto.
});
self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ritmo-") && k !== STATIC_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
    return;
  }
  if (request.headers.has("rsc") || url.searchParams.has("_rsc")) return;
  const publicAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname === "/icon";
  if (!publicAsset) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.put(request, copy))); }
    return response;
  })));
});
