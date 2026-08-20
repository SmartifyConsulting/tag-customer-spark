// Minimal service worker — exists only so the app satisfies the browser's
// PWA installability criteria (having a registered service worker with a
// fetch handler). Deliberately does no caching: this app is data-driven and
// mostly used while signed in, so serving stale HTML/JSON would do more harm
// than the offline support is worth. Every request just passes straight
// through to the network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: let the browser handle the request normally.
});
