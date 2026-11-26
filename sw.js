// Service worker: makes the app open offline.
// App files: served from cache, refreshed in the background.
// Content (lectures): always tries the network first so new lectures show up
// right away, and falls back to the cached copy when offline.
const VERSION = "v1";
const SHELL = [
  "./", "index.html", "styles.css", "js/app.js", "js/markdown.js",
  "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png",
  "content/modules.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const key = new Request(req.url.split("#")[0]);
  const isContent = new URL(req.url).pathname.includes("/content/");

  const fromNetwork = () => fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); }
    return res;
  });

  if (isContent || req.mode === "navigate") {
    e.respondWith(fromNetwork().catch(() => caches.match(key).then((r) => r || caches.match("index.html"))));
  } else {
    e.respondWith(caches.match(key).then((cached) => {
      const net = fromNetwork().catch(() => cached);
      return cached || net;
    }));
  }
});
