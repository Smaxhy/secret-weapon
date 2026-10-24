/* Hana service worker: app shell + dictionary + scanner engine cached for full offline use. */
var VERSION = "hana-v8";        // app shell: bump with the ?v= numbers in index.html
var DATA = "hana-data-6";       // dictionary: bump with data/dict.json?v=
var OCR = "hana-ocr-1";         // scanner engine + language data (~10 MB): survives app updates, bump only when vendor/ changes
var FONTS = "hana-fonts-1";
var KEEP = [VERSION, DATA, OCR, FONTS];
var DICT = "data/dict.json?v=6";
var FONT_CSS = "https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap";
var SHELL = ["./", "index.html", "css/app.css?v=8", "js/phrases.js?v=7", "js/words.js?v=7", "js/engine.js?v=7", "js/food.js?v=7", "js/app.js?v=7", "js/scan.js?v=7",
  "img/hana.svg?v=7", "manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png"];

function put(name, req, res) { return caches.open(name).then(function (c) { return c.put(req, res); }).catch(function () {}); }
function fetchRetry(url, opts, tries) {
  return fetch(url, opts).then(function (r) { if (!r.ok) throw new Error(r.status); return r; }).catch(function (e) {
    if (tries <= 1) throw e;
    return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return fetchRetry(url, opts, tries - 1); });
  });
}
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // small files one by one with retries: one dropped request on mobile data must not throw the whole install away
    return Promise.all(SHELL.map(function (u) { return fetchRetry(u, { cache: "no-cache" }, 3).then(function (r) { return c.put(u, r); }); }));
  }).then(function () {
    // the font stylesheet is requested before this worker controls the page, so fetch it here (CORS, so we can check it)
    return fetch(FONT_CSS, { mode: "cors" }).then(function (r) { if (r.ok) return put(FONTS, FONT_CSS, r); }).catch(function () {});
  }).then(function () { return self.skipWaiting(); }));
});
function migrate() { // keep the scanner engine and dictionary the user already downloaded under the old cache name
  return caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return KEEP.indexOf(k) < 0; }).map(function (k) {
      return caches.open(k).then(function (old) {
        return old.keys().then(function (reqs) {
          return Promise.all(reqs.map(function (r) {
            var to = /\/vendor\//.test(r.url) ? OCR : r.url.indexOf(DICT) >= 0 ? DATA : null;
            if (!to) return null;
            return caches.open(to).then(function (dst) { return dst.match(r).then(function (have) { return have || old.match(r).then(function (res) { if (res) return dst.put(r, res); }); }); });
          }));
        });
      }).then(function () { return caches.delete(k); });
    }));
  });
}
self.addEventListener("activate", function (e) {
  e.waitUntil(migrate().catch(function () {}).then(function () { return self.clients.claim(); }));
});

function cacheFirst(req, name) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (r) { if (r.ok) put(name, req, r.clone()); return r; });
  });
}
function shellFallback() { return caches.match("index.html").then(function (h) { return h || caches.match("./"); }); }
function withTimeout(net, ms, fallback) { // 'lie-fi' (signal but no data): don't stare at a blank screen, use the cached copy
  return new Promise(function (res) {
    var done = false;
    function finish(r) { if (!done && r) { done = true; res(r); } }
    var t = setTimeout(function () { fallback().then(finish); }, ms);
    net.then(function (r) { clearTimeout(t); finish(r); }, function () { clearTimeout(t); fallback().then(function (h) { finish(h || Response.error()); }); });
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { e.respondWith(cacheFirst(req, FONTS)); return; }
  if (url.origin !== location.origin) return; // translation / AI APIs go straight to the network
  if (req.mode === "navigate") {
    var net = fetch(req).then(function (r) { if (r.ok) put(VERSION, "index.html", r.clone()); return r; });
    e.respondWith(withTimeout(net, 3000, shellFallback));
    return;
  }
  if (/\/vendor\//.test(url.pathname)) { e.respondWith(cacheFirst(req, OCR)); return; }
  if (/\/data\//.test(url.pathname)) { e.respondWith(cacheFirst(req, DATA)); return; }
  if (/[?&]v=/.test(url.search) || /\/icons\//.test(url.pathname)) { e.respondWith(cacheFirst(req, VERSION)); return; } // versioned files never change
  var fresh = fetch(req).then(function (r) { if (r.ok) put(VERSION, req, r.clone()); return r; });
  e.respondWith(withTimeout(fresh, 3000, function () { return caches.match(req); }));
});
