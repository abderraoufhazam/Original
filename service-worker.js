// service-worker.js
// Cache intelligent pour mode hors ligne

const CACHE_NAME = "qr-auth-v3";
const OFFLINE_CACHE = "qr-auth-offline-v1";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/verify.html",
  "/landing.html",
  "/signup.html",
  "/contact.html",
  "/style.css",
  "/app.js",
  "/i18n.js",
  "/manifest.json",
  "/icon.svg",
  "/instagram.png",
  "/facebook.png",
  "/tiktok.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_ASSETS.map(asset =>
          cache.add(asset).catch(err => console.warn("Cache skip:", asset, err.message))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== OFFLINE_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.headers.get("accept")?.includes("text/html")) {
          const fallback = await caches.match("/verify.html");
          if (fallback) return fallback;
        }

        return new Response("Hors ligne", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" }
        });
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
