// Keeps Rock Run playable offline. Only controls /play/, never the main page.
// Bump VERSION whenever a game file changes so players get the new version.
var VERSION = "rockrun-v4";
var FILES = [
  "/play/", "/play/index.html", "/play/game.js", "/play/play.css",
  "/play/manifest.webmanifest", "/assets/img/icon-48.png", "/assets/img/icon-192.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.pathname.indexOf("/api/") === 0) return; // scores and rankings always go to the network
  // Game files: network first, so updates arrive; fall back to the saved copy offline.
  // Google Fonts: saved copy first, so the pixel font works offline after one visit.
  var isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (isFont) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); return res;
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("/play/"); });
  }));
});
