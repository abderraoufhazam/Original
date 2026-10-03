// service-worker.js
// Original — Service Worker v23

const CACHE_VERSION = "v26";
const CACHE_NAME = `original-${CACHE_VERSION}`;
const OFFLINE_CACHE = `original-offline-${CACHE_VERSION}`;
const RUNTIME_CACHE = `original-runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "/",
  "/landing.html",
  "/verify.html",
  "/verify",
  "/signup.html",
  "/signup",
  "/login.html",
  "/login",
  "/contact.html",
  "/contact",
  "/brand.html",
  "/brand",
  "/report.html",
  "/report",
  "/shop-dashboard.html",
  "/shop-terms.html",
  "/style.css",
  "/app.js",
  "/i18n.js",
  "/chat.js",
  "/bot-guard.js",
  "/manifest.json",
  "/icon.png",
  "/instagram.png",
  "/facebook.png",
  "/tiktok.png"
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing v" + CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_ASSETS.map(asset =>
          cache.add(asset).catch(err => console.warn("[SW] Cache skip:", asset, err.message))
        )
      );
    })
  );

  self.skipWaiting();
});

// ============================================================
// ACTIVATE
// ============================================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating v" + CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== OFFLINE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // HTML → Network First
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;

          const fallback = await caches.match("/verify.html");
          if (fallback) return fallback;

          return new Response("Hors ligne", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        })
    );
    return;
  }

  // Static → Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return new Response("", { status: 503 });
      });
    })
  );
});

// ============================================================
// PUSH
// ============================================================
self.addEventListener("push", (event) => {
  console.log("[SW] Push received");

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: "Original",
      body: event.data ? event.data.text() : ""
    };
  }

  const title = data.title || "📋 Notification";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.png",
    badge: data.badge || "/icon.png",
    tag: data.tag || "default",
    data: { url: data.url || "/brand" },
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener("notificationclick", async (event) => {
  console.log("[SW] Notification clicked");
  event.notification.close();

  const url = event.notification.data?.url || "/brand";

  const clientList = await clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  for (const client of clientList) {
    if (client.url.includes(self.location.origin) && "focus" in client) {
      if (client.navigate) {
        await client.navigate(url);
      }
      return client.focus();
    }
  }

  if (clients.openWindow) {
    return clients.openWindow(url);
  }
});

// ============================================================
// MESSAGE
// ============================================================
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }

  if (event.data === "clearCache") {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
});
