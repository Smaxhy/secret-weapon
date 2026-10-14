/* Hana service worker: app shell + dictionary cached for full offline use. */
var VERSION = "hana-v5";
var SHELL = ["./", "index.html", "css/app.css?v=5", "js/phrases.js?v=5", "js/words.js?v=5", "js/engine.js?v=5", "js/app.js?v=5",
  "data/dict.json?v=5", "img/hana.svg", "manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // fonts: cache-first (so the font works offline after first visit)
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); return r; });
    }));
    return;
  }
  if (url.origin !== location.origin) return; // translation APIs go straight to the network
  // big dictionary + images: cache-first
  if (/\/data\/|\/icons\/|\/img\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); return r; });
    }));
    return;
  }
  // app shell: network-first (always fresh when online), cache fallback offline
  e.respondWith(fetch(req, { cache: "no-cache" }).then(function (r) {
    if (r.ok) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); }
    return r;
  }).catch(function () { return caches.match(req).then(function (hit) { return hit || caches.match("index.html"); }); }));
});
