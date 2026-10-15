/* Hana menu scanner: camera -> OCR (tesseract.js, offline) -> dish matching with ingredients.
 * Optional "AI perfect scan" sends the photo to Claude with the user's own API key. */
(function () {
"use strict";
var E = window.HanaEngine;
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt || false); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function UI() { return window.HanaUI; }

/* ---------------------------------------------------------------- food index */
function toHira(s) { return String(s).replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }); }
function key(s) { return toHira(s).replace(/[\s・･,、。.!！?？()（）「」『』【】\[\]〜~ー－-]/g, "").replace(/の/g, ""); }
var FOOD = [], NAMES = [];
FOOD_SRC.trim().split("\n").forEach(function (line) {
  var a = line.split("|"); if (a.length < 5) return;
  var f = { names: a[0].split("/"), en: a[1], ing: a[2], tags: a[3] ? a[3].split(",") : [], desc: a[4] };
  FOOD.push(f);
  f.names.forEach(function (n) { var k = key(n); if (k) NAMES.push({ k: k, f: f, name: n }); });
});
NAMES.sort(function (a, b) { return b.k.length - a.k.length; });
var WORDS = Object.keys(FOOD_WORDS).map(function (w) { return { k: key(w), w: w, en: FOOD_WORDS[w][0], tag: FOOD_WORDS[w][1] }; }).filter(function (x) { return x.k; });
WORDS.sort(function (a, b) { return b.k.length - a.k.length; });
var SECTIONS = {}; Object.keys(FOOD_SECTIONS).forEach(function (k) { SECTIONS[key(k)] = FOOD_SECTIONS[k]; });
var ANIMAL = ["pork", "beef", "chicken", "fish", "shellfish"];

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  var prev = [], cur, i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur = [i]; var best = i;
    for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function wordsIn(k) { // greedy ingredient/cooking words in a key string
  var out = [], i = 0;
  while (i < k.length) {
    var hit = null;
    for (var n = 0; n < WORDS.length; n++) { var w = WORDS[n]; if (w.k.length >= 1 && k.substr(i, w.k.length) === w.k) { hit = w; break; } }
    if (hit && (hit.k.length > 1 || /[㐀-鿿]/.test(hit.k))) { out.push(hit); i += hit.k.length; } else i++;
  }
  return out;
}
function matchDish(name) {
  var k = key(name); if (!k) return null;
  var i, n;
  for (i = 0; i < NAMES.length; i++) if (NAMES[i].k === k) return { f: NAMES[i].f, at: 0, len: k.length, k: k, exact: true };
  for (i = 0; i < NAMES.length; i++) { n = NAMES[i]; if (n.k.length >= 2 && k.indexOf(n.k) >= 0 && !(n.k.length === 2 && k.length > 6 && !/[㐀-鿿]/.test(n.k))) return { f: n.f, at: k.indexOf(n.k), len: n.k.length, k: k }; }
  // fuzzy (OCR misreads): compare without voicing marks (ぶ/ぷ/ふ, ど/と) and allow 1-2 edits
  var kb = devoice(k);
  if (k.length >= 2) {
    var best = null, bd = 9;
    for (i = 0; i < NAMES.length; i++) {
      n = NAMES[i]; if (n.k.length < 2) continue;
      var nb = n.kb || (n.kb = devoice(n.k));
      if (n.k.length === 2 || k.length === 2) { // 2-char names: one kanji may be misread (杖豆 -> 枝豆)
        if (k.length === 2 && n.k.length === 2 && /[\u3400-\u9fff]/.test(n.k) && (k[0] === n.k[0] || k[1] === n.k[1]) && bd > 1) { bd = 1; best = n; }
        continue;
      }
      var max = n.k.length >= 6 ? 2 : 1, d = lev(kb, nb, max); if (d <= max && d < bd) { bd = d; best = n; }
    }
    if (best) return { f: best.f, at: 0, len: k.length, k: k, fuzzy: true };
  }
  return null;
}
function devoice(s) { try { return s.normalize("NFD").replace(/[\u3099\u309a]/g, ""); } catch (e) { return s; } }
function sectionOf(sk) {
  if (SECTIONS[sk]) return SECTIONS[sk];
  if (sk.length >= 3) for (var k in SECTIONS) if (k.length >= 3 && lev(sk, k, 1) <= 1) return SECTIONS[k];
  return "";
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function describe(name) {
  var m = matchDish(name), k = key(name), tags = {}, extra = [];
  if (m) {
    m.f.tags.forEach(function (t) { tags[t] = 1; });
    var pre = wordsIn(k.slice(0, m.at)), post = wordsIn(k.slice(m.at + m.len));
    pre.concat(post).forEach(function (w) { if (w.tag) tags[w.tag] = 1; });
    var preEn = pre.map(function (w) { return w.en; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var postEn = post.map(function (w) { return w.en; });
    var en = (preEn.length ? cap(preEn.join(" ")) + " " + m.f.en.charAt(0).toLowerCase() + m.f.en.slice(1) : m.f.en) + (postEn.length ? " (" + postEn.join(", ") + ")" : "");
    return { en: en, desc: m.f.desc, ing: m.f.ing, tags: Object.keys(tags), sure: m.exact ? 3 : m.fuzzy ? 1 : 2 };
  }
  var ws = wordsIn(k); ws.forEach(function (w) { if (w.tag) tags[w.tag] = 1; });
  var lit = "";
  if (E && E.ready()) { var r = E.jaToEn(name); if (r && r.words && r.words.length) lit = r.words.map(function (w) { return w.en; }).filter(function (x) { return x && x !== "?"; }).join(" · "); }
  if (!lit && ws.length) lit = ws.map(function (w) { return w.en; }).join(" ");
  return { en: lit ? cap(lit) : "", desc: "", ing: ws.length ? ws.map(function (w) { return w.en; }).join(", ") : "", tags: Object.keys(tags), sure: 0 };
}
function romajiOf(name) { if (E && E.ready()) { var r = E.jaToEn(name); if (r && r.ro) return r.ro.replace(/[.,!?]$/, ""); } return ""; }

/* ---------------------------------------------------------------- OCR text clean-up */
function cleanLine(t) {
  t = String(t || "").replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); }).replace(/[，]/g, ",").replace(/[￥\\]/g, "¥");
  t = t.replace(/(\d)\s*[.．]\s*(\d{3})(?=\s*(円|$|\D))/g, "$1,$2").replace(/(\d)[oO](?=\d|円)/g, "$10").replace(/(\d)[QＱ](?=\d|円)/g, "$10");
  t = t.replace(/([^\x00-\x7f])\s+(?=[^\x00-\x7f])/g, "$1").replace(/(\d)\s+(?=[\d,])/g, "$1").replace(/,\s+(?=\d)/g, ",");
  t = t.replace(/(天|牛|豚|親子|カツ|かつ|海鮮|鉄火|中華|他人|うな|鰻|いくら|ネギトロ|ねぎとろ|マグロ|まぐろ|しらす|ステーキ|ローストビーフ|そぼろ|玉子|スタミナ|焼肉|ちらし)井/g, "$1丼");
  t = t.replace(/ラ一メン/g, "ラーメン").replace(/[一]{2,}/g, "ー");
  return t.trim();
}
var PRICE_RE = /(?:¥\s*([\d,]{2,7}))|(?:([\d,]{2,7})\s*円)|(?:([\d,]{3,7})\s*(?:\(税込\)|（税込）|税込)?$)/;
var KNUM = { "〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
function kanjiNum(s) { var total = 0, cur = 0; for (var i = 0; i < s.length; i++) { var c = s[i]; if (KNUM[c] !== undefined) cur = cur * 10 + KNUM[c]; else if (c === "十") { total += (cur || 1) * 10; cur = 0; } else if (c === "百") { total += (cur || 1) * 100; cur = 0; } else if (c === "千") { total += (cur || 1) * 1000; cur = 0; } else if (c === "万") { total = (total + cur) * 10000; cur = 0; } } return total + cur; }
function parsePrice(t) {
  var k = t.match(/([〇零一二三四五六七八九十百千万]{2,})円/); if (k) { var kv = kanjiNum(k[1]); if (kv >= 50 && kv < 200000) return kv; }
  var m = t.match(PRICE_RE); if (!m) return null; var v = (m[1] || m[2] || m[3] || "").replace(/,/g, ""); var n = parseInt(v, 10); return n >= 50 && n < 200000 ? n : null; }
function stripName(t) {
  return t.replace(/[ゃゅょっぁぃぅぇぉ・.。,、:;]+\s*$/, "").replace(/^\s*[ゃゅょっぁぃぅぇぉ・.。,、]+/, "").replace(/[〇零一二三四五六七八九十百千万]{2,}円/g, "").replace(/[¥]\s*[\d,]+/g, "").replace(/[\d,]+\s*円/g, "").replace(/\(?税込\)?|（税込）|\(?税抜\)?|（税抜）|税別/g, "")
    .replace(/[…‥・･.。:：\-－—_~〜]{2,}/g, " ").replace(/[\d,]{3,}\s*$/, "").replace(/^[\s・*※●○◎■□◆◇▼▲★☆\-]+/, "").replace(/\s{2,}/g, " ").trim()
    .replace(/[\sゃゅょっぁぃぅぇぉ・.。,、:;]+$/, "").trim();
}
var CJK = /[぀-ヿ㐀-鿿]/g;
function cjkCount(s) { var m = String(s).match(CJK); return m ? m.length : 0; }

/* ---------------------------------------------------------------- state & settings */
var store = { get: function (k, d) { try { var v = JSON.parse(localStorage.getItem("hana." + k)); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem("hana." + k, JSON.stringify(v)); } catch (e) {} } };
var avoid = store.get("avoid", []);
var dirMode = store.get("scanDir", "auto");
var DBG = {};
var stream = null, worker = null, workerLang = null, busy = false, lastItems = [], lastImg = null;

/* ---------------------------------------------------------------- tesseract worker */
function loadScript(src) { return new Promise(function (res, rej) { if (window.Tesseract) return res(); var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
function getWorker(lang, progress) {
  if (worker && workerLang === lang) return Promise.resolve(worker);
  return loadScript("vendor/tesseract/tesseract.min.js").then(function () {
    var base = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
    var p = worker ? worker.terminate() : Promise.resolve();
    return p.then(function () {
      worker = null;
      return Tesseract.createWorker(lang, 1, {
        workerPath: base + "vendor/tesseract/worker.min.js", corePath: base + "vendor/tesseract/core", langPath: base + "vendor/tesseract/lang",
        gzip: true, workerBlobURL: false, cacheMethod: "write",
        logger: function (m) { if (progress && m && typeof m.progress === "number") progress(m.status, m.progress); }
      });
    }).then(function (w) { worker = w; workerLang = lang; return w; });
  });
}

/* ---------------------------------------------------------------- image helpers */
function toCanvas(src, maxSide, minSide) {
  var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
  var s = Math.min(1, maxSide / Math.max(w, h)); if (Math.max(w, h) * s < minSide) s = minSide / Math.max(w, h);
  var c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(h * s);
  var g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function skewAngle(src) { // projection-profile deskew estimate, degrees
  var S = 500 / Math.max(src.width, src.height), W = Math.max(1, Math.round(src.width * S)), H = Math.max(1, Math.round(src.height * S));
  var c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d"); g.drawImage(src, 0, 0, W, H);
  var p = g.getImageData(0, 0, W, H).data, gray = new Float32Array(W * H), i, x, y;
  for (i = 0; i < W * H; i++) gray[i] = (p[i * 4] * 299 + p[i * 4 + 1] * 587 + p[i * 4 + 2] * 114) / 1000;
  var pts = [];
  for (y = 2; y < H - 2; y++) for (x = 2; x < W - 2; x++) {
    var v = gray[y * W + x], m = (gray[y * W + x - 2] + gray[y * W + x + 2] + gray[(y - 2) * W + x] + gray[(y + 2) * W + x]) / 4;
    if (m - v > 25) pts.push(x, y);
  }
  if (pts.length < 200) return 0;
  var best = 0, bestScore = -1;
  for (var a = -10; a <= 10; a += 0.5) {
    var r = a * Math.PI / 180, sn = Math.sin(r), cs = Math.cos(r), bins = new Float32Array(H * 2);
    for (i = 0; i < pts.length; i += 2) { var yy = Math.round(pts[i + 1] * cs - pts[i] * sn + H / 2); if (yy >= 0 && yy < bins.length) bins[yy]++; }
    var sc = 0; for (i = 1; i < bins.length; i++) { var d = bins[i] - bins[i - 1]; sc += d * d; }
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best;
}
function borderColor(src) {
  var g = src.getContext("2d"), W = src.width, H = src.height, d = g.getImageData(0, 0, W, H).data, r = 0, gg = 0, b = 0, n = 0;
  function add(x, y) { var i = (y * W + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  for (var x = 0; x < W; x += 8) { add(x, 0); add(x, H - 1); }
  for (var y = 0; y < H; y += 8) { add(0, y); add(W - 1, y); }
  return "rgb(" + Math.round(r / n) + "," + Math.round(gg / n) + "," + Math.round(b / n) + ")";
}
function rotateCanvas(src, deg) {
  if (!deg) return src;
  var r = deg * Math.PI / 180, s = Math.abs(Math.sin(r)), c = Math.abs(Math.cos(r)), W = src.width, H = src.height;
  var out = document.createElement("canvas"); out.width = Math.round(W * c + H * s); out.height = Math.round(W * s + H * c);
  var g = out.getContext("2d"); g.fillStyle = borderColor(src); g.fillRect(0, 0, out.width, out.height);
  g.translate(out.width / 2, out.height / 2); g.rotate(r); g.drawImage(src, -W / 2, -H / 2);
  return out;
}
function binarize(src) { // Bradley adaptive threshold -> {canvas (white bg, black ink), ink mask}
  var W = src.width, H = src.height, g = src.getContext("2d"), img = g.getImageData(0, 0, W, H), p = img.data, i, x, y;
  var gray = new Float32Array(W * H);
  for (i = 0; i < W * H; i++) gray[i] = (p[i * 4] * 299 + p[i * 4 + 1] * 587 + p[i * 4 + 2] * 114) / 1000;
  var I = new Float64Array((W + 1) * (H + 1));
  for (y = 0; y < H; y++) { var row = 0; for (x = 0; x < W; x++) { row += gray[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
  var r = Math.max(8, Math.round(Math.max(W, H) / 40)), ink = new Uint8Array(W * H);
  var out = document.createElement("canvas"); out.width = W; out.height = H; var og = out.getContext("2d"), od = og.createImageData(W, H), q = od.data;
  for (y = 0; y < H; y++) {
    var y0 = Math.max(0, y - r), y1 = Math.min(H - 1, y + r);
    for (x = 0; x < W; x++) {
      var x0 = Math.max(0, x - r), x1 = Math.min(W - 1, x + r), cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
      var sum = I[(y1 + 1) * (W + 1) + x1 + 1] - I[y0 * (W + 1) + x1 + 1] - I[(y1 + 1) * (W + 1) + x0] + I[y0 * (W + 1) + x0];
      var k = y * W + x, isInk = gray[k] * cnt < sum * 0.88 ? 1 : 0;
      ink[k] = isInk; var v = isInk ? 0 : 255, j = k * 4; q[j] = q[j + 1] = q[j + 2] = v; q[j + 3] = 255;
    }
  }
  og.putImageData(od, 0, 0);
  return { canvas: out, ink: ink, W: W, H: H };
}
function runs(arr, minVal, maxGap, minLen) {
  var out = [], s = -1, last = -1;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] > minVal) { if (s < 0) s = i; last = i; }
    else if (s >= 0 && i - last > maxGap) { if (last - s + 1 >= minLen) out.push([s, last]); s = -1; }
  }
  if (s >= 0 && last - s + 1 >= minLen) out.push([s, last]);
  return out;
}
function crop(src, x0, y0, x1, y1, pad) {
  pad = pad || 0;
  var w = x1 - x0 + 1, h = y1 - y0 + 1, c = document.createElement("canvas"); c.width = w + pad * 2; c.height = h + pad * 2;
  var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, x0, y0, w, h, pad, pad, w, h);
  return c;
}

/* ---------------------------------------------------------------- camera */
function camMsg(t) { var m = $("#camMsg"); m.textContent = t || ""; m.style.display = t ? "" : "none"; }
function startCam() {
  if (stream) return Promise.resolve();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camMsg("Camera not available here — use 🖼 to pick a photo"); return Promise.resolve(); }
  camMsg("Starting camera…");
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }).then(function (s) {
    stream = s; var v = $("#video"); v.srcObject = s; v.setAttribute("playsinline", ""); v.muted = true;
    return v.play().then(function () {
      showLive(); camMsg("");
      var tr = s.getVideoTracks()[0], caps = tr.getCapabilities ? tr.getCapabilities() : {};
      $("#torchBtn").style.visibility = caps && caps.torch ? "visible" : "hidden";
    });
  }).catch(function () { camMsg("Camera blocked — allow it in settings, or use 🖼 to pick a photo"); });
}
function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } $("#video").srcObject = null; }
var torch = false;
on($("#torchBtn"), "click", function () { if (!stream) return; torch = !torch; var tr = stream.getVideoTracks()[0]; tr.applyConstraints({ advanced: [{ torch: torch }] }).catch(function () {}); $("#torchBtn").classList.toggle("on", torch); });
function showLive() { $("#cam").style.aspectRatio = ""; $("#cam").classList.remove("shot", "done"); $("#shot").removeAttribute("src"); $("#ar").innerHTML = ""; $("#retake").style.display = "none"; }

on($("#shutter"), "click", function () {
  if (busy) return;
  var v = $("#video");
  if (!stream || !v.videoWidth) { startCam(); return; }
  try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
  var c = toCanvas(v, 2000, 0);
  $("#cam").classList.add("flash"); setTimeout(function () { $("#cam").classList.remove("flash"); }, 300);
  process(c);
});
on($("#upBtn"), "click", function () { $("#fileIn").click(); });
on($("#fileIn"), "change", function () {
  var f = $("#fileIn").files && $("#fileIn").files[0]; if (!f) return;
  var img = new Image(); img.onload = function () { process(toCanvas(img, 2000, 0)); URL.revokeObjectURL(img.src); };
  img.src = URL.createObjectURL(f); $("#fileIn").value = "";
});
on($("#retake"), "click", function () { showLive(); $("#scanResults").innerHTML = ""; startCam(); });

/* ---------------------------------------------------------------- pipeline */
function setProg(p, label) { $("#scanFill").style.width = Math.round(p * 100) + "%"; if (label) camMsg(label); }
function process(colorCanvas) {
  busy = true; lastImg = colorCanvas;
  var shot = $("#shot"); shot.src = colorCanvas.toDataURL("image/jpeg", 0.9);
  $("#cam").style.aspectRatio = colorCanvas.width + " / " + colorCanvas.height;
  $("#cam").classList.add("shot", "scanning"); $("#ar").innerHTML = ""; $("#retake").style.display = "";
  stopCam();
  $("#scanResults").innerHTML = '<div class="empty-note"><div class="dots"><i></i><i></i><i></i></div></div>';
  if (UI()) UI().say(UI().line("scan"));
  var useAI = aiReady() && navigator.onLine && store.get("aiAuto", true);
  var job = useAI ? aiScan(colorCanvas) : ocrScan(colorCanvas);
  job.then(function (items) {
    $("#cam").classList.remove("scanning"); $("#cam").classList.add("done"); setProg(1); camMsg(""); setTimeout(function () { setProg(0); }, 600);
    lastItems = items; render(items, colorCanvas);
    if (UI()) {
      if (!items.length) UI().say(["うーん…読めないわ", "Hmm, I can't read that one. Get closer & hold steady?"]);
      else if (items.some(function (it) { return it.tags.indexOf("alcohol") >= 0; })) UI().say(UI().line("alcohol"));
      else if (items.some(function (it) { return it.tags.indexOf("spicy") >= 0; })) UI().say(UI().line("spicy"));
      else UI().say(UI().line("scanDone"));
    }
  }).catch(function (err) {
    $("#cam").classList.remove("scanning"); setProg(0); camMsg("");
    $("#scanResults").innerHTML = '<div class="empty-note">Scan failed: ' + esc(err && err.message || err) + "</div>";
  }).then(function () { busy = false; });
}

function ocrScan(colorCanvas) {
  // 1) straighten  2) high-contrast b/w  3) OCR horizontal (sparse) and/or vertical (per column)  4) rebuild menu rows
  var firstLoad = !worker;
  setProg(0.03, "Straightening photo…");
  var small = toCanvas(colorCanvas, 2000, 1200);
  var ang = skewAngle(small), rot = Math.abs(ang) >= 0.75 ? -ang : 0;
  var straight = rotateCanvas(small, rot);
  if (rot) { lastImg = straight; $("#shot").src = straight.toDataURL("image/jpeg", 0.9); $("#cam").style.aspectRatio = straight.width + " / " + straight.height; }
  var B = binarize(straight), W = straight.width, H = straight.height;
  function prog(base, span) {
    return function (status, p) {
      if (/recogniz/.test(status)) setProg(base + p * span, "Reading the menu… " + Math.round((base + p * span) * 100) + "%");
      else setProg(Math.min(base, 0.3) * p, firstLoad ? "Loading scanner (first time only)…" : "Warming up…");
    };
  }
  function horizontal() {
    return getWorker("jpn", prog(0.1, 0.55)).then(function (w) {
      return w.setParameters({ tessedit_pageseg_mode: "11" }).then(function () { return w.recognize(B.canvas, {}, { blocks: true }); });
    }).then(function (r) { DBG.data = r.data; return mergeRows(piecesOf(r.data)); });
  }
  function vertical() {
    var colSum = new Float32Array(W), x, y;
    for (x = 0; x < W; x++) { var s = 0; for (y = 0; y < H; y++) s += B.ink[y * W + x]; colSum[x] = s; }
    var cols = runs(colSum, Math.max(1, H / 400), Math.max(4, Math.round(W / 140)), Math.max(8, Math.round(W / 90))).reverse(); // right -> left
    var out = [], chain = getWorker("jpn_vert", prog(0.1, 0.05));
    cols.forEach(function (c, ci) {
      chain = chain.then(function (w) {
        var rowSum = new Float32Array(H); for (y = 0; y < H; y++) { var s2 = 0; for (x = c[0]; x <= c[1]; x++) s2 += B.ink[y * W + x]; rowSum[y] = s2; }
        var span = runs(rowSum, 0, H, 4)[0]; if (!span) return w;
        var pad = Math.round((c[1] - c[0]) * 0.4);
        var strip = crop(B.canvas, c[0], span[0], c[1], span[1], pad);
        return w.setParameters({ tessedit_pageseg_mode: "5" }).then(function () { return w.recognize(strip); }).then(function (r) {
          setProg(0.15 + 0.8 * (ci + 1) / cols.length, "Reading vertical columns… " + (ci + 1) + "/" + cols.length);
          var t = cleanLine((r.data.text || "").replace(/\s+/g, ""));
          if (t) out.push({ text: t, conf: r.data.confidence, box: { x0: c[0], y0: span[0], x1: c[1], y1: span[1] } });
          return w;
        });
      });
    });
    return chain.then(function () { return out; });
  }
  function score(lines) { return lines.reduce(function (a, l) { return a + cjkCount(stripName(l.text)) * Math.max(0.1, l.conf / 100); }, 0); }
  var p;
  if (dirMode === "v") p = vertical();
  else if (dirMode === "h") p = horizontal();
  else p = horizontal().then(function (h) {
    var avg = h.length ? h.reduce(function (a, l) { return a + l.conf; }, 0) / h.length : 0;
    if (score(h) >= 14 && avg >= 60) return h;
    return vertical().then(function (v) { return score(v) > score(h) * 1.2 ? v : h; }).catch(function () { return h; });
  });
  return p.then(function (lines) { return toItems(lines, W, H); }).then(onlineBoost);
}
var LEADER = /[ンクジグシタイビデぐくンーｰ・･.。…‥:：\-—_~〜=＝ニ一二|｜]/;
function isLeaderJunk(t) { var s = t.replace(/\s/g, ""); if (s.length < 4) return false; var n = 0; for (var i = 0; i < s.length; i++) if (LEADER.test(s[i])) n++; return n / s.length > 0.8; }
function piecesOf(data) {
  // word-level: drop low-confidence junk (dot leaders, smudges) and split lines where junk was
  var out = [];
  function flush(cur) { if (!cur) return; var t = cleanLine(cur.text); if (!t || isLeaderJunk(t)) return; if (cur.sum / cur.n < 40 && cjkCount(t) < 2 && !parsePrice(t)) return; out.push({ text: t, conf: cur.sum / cur.n, box: cur.box }); }
  (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) {
    var ws = l.words && l.words.length ? l.words : [{ text: l.text, confidence: l.confidence, bbox: l.bbox }], cur = null;
    // pass 1: confident words (Tesseract under-rates correct kanji, so confidence alone can't decide)
    var good = ws.map(function (w) { var t = String(w.text || "").trim(); return !!t && !isLeaderJunk(t) && (w.confidence >= 45 || /[\d¥￥円]/.test(t)); });
    // pass 2: short weak words touching a good neighbour are part of the name; long weak runs are dot leaders / smudges
    var keep = ws.map(function (w, i) {
      var t = String(w.text || "").trim(); if (!t || isLeaderJunk(t)) return false; if (good[i]) return true;
      if (t.length > 3) return false;
      var h = w.bbox.y1 - w.bbox.y0, near = function (j) { if (j < 0 || j >= ws.length || !good[j]) return false; var o = ws[j].bbox; return Math.max(o.x0 - w.bbox.x1, w.bbox.x0 - o.x1) < h * 0.8; };
      return near(i - 1) || near(i + 1);
    });
    ws.forEach(function (w, i) {
      var t = String(w.text || "").trim();
      if (!keep[i]) { flush(cur); cur = null; return; }
      if (!cur) cur = { text: "", sum: 0, n: 0, minConf: 100, box: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } };
      cur.text += (cur.text ? " " : "") + t; cur.sum += Math.max(w.confidence, good[i] ? 0 : 45); cur.n++; cur.minConf = Math.min(cur.minConf, w.confidence);
      cur.box.x0 = Math.min(cur.box.x0, w.bbox.x0); cur.box.y0 = Math.min(cur.box.y0, w.bbox.y0); cur.box.x1 = Math.max(cur.box.x1, w.bbox.x1); cur.box.y1 = Math.max(cur.box.y1, w.bbox.y1);
    });
    flush(cur);
  }); }); });
  return out;
}
function mergeRows(pieces) { // pieces on the same text row -> one menu line ("name … price")
  pieces.sort(function (a, b) { return (a.box.y0 + a.box.y1) - (b.box.y0 + b.box.y1); });
  var rows = [];
  pieces.forEach(function (p) {
    var h = p.box.y1 - p.box.y0, row = null;
    for (var i = rows.length - 1; i >= 0 && i >= rows.length - 4; i--) {
      var r = rows[i], ov = Math.min(r.y1, p.box.y1) - Math.max(r.y0, p.box.y0);
      if (ov >= 0.5 * Math.min(h, r.y1 - r.y0)) { row = r; break; }
    }
    if (row) { row.items.push(p); row.y0 = Math.min(row.y0, p.box.y0); row.y1 = Math.max(row.y1, p.box.y1); }
    else rows.push({ y0: p.box.y0, y1: p.box.y1, items: [p] });
  });
  var out = [];
  rows.forEach(function (r) {
    r.items.sort(function (a, b) { return a.box.x0 - b.box.x0; });
    var seg = null;
    r.items.forEach(function (p) {
      var gap = seg ? p.box.x0 - seg.box.x1 : 0, hgt = p.box.y1 - p.box.y0;
      if (seg && gap > hgt * 6 && cjkCount(p.text) > 0 && cjkCount(seg.text) > 0) { out.push(seg); seg = null; } // separate column
      if (!seg) seg = { text: p.text, confs: [p.conf], box: { x0: p.box.x0, y0: p.box.y0, x1: p.box.x1, y1: p.box.y1 } };
      else { seg.text += " " + p.text; seg.confs.push(p.conf); seg.box.x0 = Math.min(seg.box.x0, p.box.x0); seg.box.y0 = Math.min(seg.box.y0, p.box.y0); seg.box.x1 = Math.max(seg.box.x1, p.box.x1); seg.box.y1 = Math.max(seg.box.y1, p.box.y1); }
      if (parsePrice(p.text) && cjkCount(stripName(p.text)) === 0) { out.push(seg); seg = null; } // a price closes the item
    });
    if (seg) out.push(seg);
  });
  out.forEach(function (s) { s.conf = s.confs.reduce(function (a, b) { return a + b; }, 0) / s.confs.length; s.text = cleanLine(s.text); });
  return out;
}
function toItems(lines, W, H) {
  var items = [], section = "", pending = [];
  lines.forEach(function (l) {
    var price = parsePrice(l.text), name = stripName(l.text), cj = cjkCount(name);
    if (cj === 0) { if (price) pending.push({ price: price, box: l.box }); return; }
    if (l.conf < 30 && cj < 3) return;
    var sk = key(name);
    if (!sk) return;
    var sec = !price && sectionOf(sk);
    if (sec) { section = sec; return; }
    var d = describe(name);
    if (!d.en && cj < 2) return;
    if (isLeaderJunk(name)) return;
    items.push({ jp: name, ro: romajiOf(name), en: d.en, desc: d.desc, ing: d.ing, tags: d.tags, price: price, sure: d.sure, box: l.box, section: section, conf: l.conf, W: W, H: H });
  });
  // leftover prices (e.g. a separate price column): give each to the nearest item on the same row, else the item above
  pending.forEach(function (pr) {
    var best = null, bd = 1e9;
    items.forEach(function (it) {
      if (it.price || !it.box || !pr.box) return;
      var cy = (pr.box.y0 + pr.box.y1) / 2, iy = (it.box.y0 + it.box.y1) / 2, ih = it.box.y1 - it.box.y0;
      var dy = Math.abs(cy - iy), dx = pr.box.x0 - it.box.x1;
      var d = dy <= ih * 0.8 ? dy + Math.abs(dx) * 0.01 : (cy > iy && dy < ih * 3 ? 1000 + dy : 1e9);
      if (d < bd) { bd = d; best = it; }
    });
    if (best) best.price = pr.price;
  });
  return items;
}
function onlineBoost(items) {
  var s = UI() && UI().settings();
  if (!navigator.onLine || !items.length || (s && s.mode === "offline")) return Promise.resolve(items);
  var q = items.map(function (it) { return it.jp; }).join("\n");
  var u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=" + encodeURIComponent(q);
  return new Promise(function (res) {
    var done = false, t = setTimeout(function () { done = true; res(items); }, 5000);
    fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      if (done) return; clearTimeout(t);
      var txt = j[0].map(function (x) { return x[0]; }).join(""), arr = txt.split("\n");
      if (arr.length === items.length) items.forEach(function (it, i) { var o = arr[i].trim(); if (o && o.toLowerCase() !== (it.en || "").toLowerCase()) it.online = o; if (!it.en) it.en = o; });
      res(items);
    }).catch(function () { if (!done) { clearTimeout(t); res(items); } });
  });
}

/* ---------------------------------------------------------------- AI perfect scan (Claude) */
var TAGS = Object.keys(FOOD_TAGS);
var MENU_SCHEMA = {
  type: "object", additionalProperties: false, required: ["items", "notes"],
  properties: {
    notes: { type: "string" },
    items: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["jp", "romaji", "en", "description", "ingredients", "tags", "price_yen", "section"],
      properties: {
        jp: { type: "string" }, romaji: { type: "string" }, en: { type: "string" }, description: { type: "string" },
        ingredients: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string", enum: TAGS } },
        price_yen: { type: "integer" }, section: { type: "string" }
      } } }
  }
};
var AI_PROMPT = "This is a photo of a restaurant menu in Japan, taken by a traveler who doesn't read Japanese. " +
  "List every food and drink item you can read, in menu order. For each item give: the Japanese name exactly as written (jp), Hepburn romaji, " +
  "a natural English menu name (en), a one-sentence description of what it actually is, the typical main ingredients (short list), " +
  "dietary tags chosen only from the allowed list (include every allergen-relevant tag that typically applies), the price in yen as an integer (0 if not shown), " +
  "and the menu section heading in English (empty string if none). Expand abbreviations (e.g. 生 at a bar = draft beer). " +
  "In notes, add short useful tips for ordering (cover charges like お通し, set inclusions, sizes, spiciness levels) or say what you couldn't read. " +
  "If the photo isn't a menu, return an empty items list and explain in notes.";
function aiKey() { return store.get("claudeKey", ""); }
function aiReady() { return !!aiKey(); }
var sdkPromise = null;
function loadSDK() {
  // dynamic import via Function so older browsers can still parse this file
  if (!sdkPromise) sdkPromise = new Function("u", "return import(u)")("https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.129.0/+esm").then(function (m) { return m.default || m.Anthropic; });
  return sdkPromise;
}
function aiScan(colorCanvas) {
  setProg(0.1, "Sending to AI ✨ (needs internet)…");
  var c = toCanvas(colorCanvas, 1568, 0), data = c.toDataURL("image/jpeg", 0.85).split(",")[1];
  var t0 = Date.now(), tick = setInterval(function () { var p = Math.min(0.92, 0.1 + (Date.now() - t0) / 40000); setProg(p, "AI is reading every dish… " + Math.round((Date.now() - t0) / 1000) + "s"); }, 400);
  return loadSDK().then(function (Anthropic) {
    var client = new Anthropic({ apiKey: aiKey(), dangerouslyAllowBrowser: true });
    return client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: MENU_SCHEMA } },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data } },
        { type: "text", text: AI_PROMPT }
      ] }]
    });
  }).then(function (resp) {
    clearInterval(tick);
    if (resp.stop_reason === "refusal") throw new Error("the AI declined this image");
    var txt = resp.content.filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
    var j = JSON.parse(txt);
    var items = (j.items || []).map(function (it) {
      return { jp: it.jp, ro: it.romaji, en: it.en, desc: it.description, ing: (it.ingredients || []).join(", "), tags: it.tags || [], price: it.price_yen || null, sure: 4, box: null, section: it.section || "", ai: true };
    });
    items.notes = j.notes || "";
    return items;
  }).catch(function (err) {
    clearInterval(tick);
    var msg = String(err && (err.status === 401 ? "API key rejected" : err.message) || err);
    if (UI()) UI().toast("AI scan failed — using offline scanner");
    console.warn("AI scan failed:", msg);
    return ocrScan(colorCanvas).then(function (items) { items.notes = "AI scan failed (" + msg + "), these are offline results."; return items; });
  });
}

/* ---------------------------------------------------------------- render */
function tagChips(tags) {
  var hasAnimal = tags.some(function (t) { return ANIMAL.indexOf(t) >= 0; });
  return tags.filter(function (t) { return FOOD_TAGS[t] && !(t === "veg" && hasAnimal); }).map(function (t) {
    return '<span class="ftag' + (avoid.indexOf(t) >= 0 ? " bad" : "") + '">' + FOOD_TAGS[t][0] + " " + FOOD_TAGS[t][1] + "</span>";
  }).join("");
}
function render(items, colorCanvas) {
  var box = $("#scanResults"), ar = $("#ar");
  ar.innerHTML = ""; box.innerHTML = "";
  if (!items.length) { box.innerHTML = '<div class="empty-note">No menu text found 🤔<br>Tips: fill the frame with the menu, avoid glare, hold still — or try the 縦 (vertical) setting.' + (aiReady() ? "" : "<br>For handwritten/stylish menus, turn on ✨ AI scan in settings.") + "</div>"; return; }
  var head = document.createElement("div"); head.className = "scan-head";
  head.innerHTML = "<b>" + items.length + " items found</b>" + (items[0].ai ? '<span class="badge online">✨ AI</span>' : '<span class="badge offline">⚡ Offline</span>') + '<button class="link" id="arToggle">Labels on photo: on</button>';
  box.appendChild(head);
  if (items.notes) { var n = document.createElement("div"); n.className = "alt"; n.innerHTML = "<b>Tips</b>" + esc(items.notes); box.appendChild(n); }
  var lastSection = null;
  items.forEach(function (it, i) {
    if (it.section && it.section !== lastSection) { lastSection = it.section; var s = document.createElement("div"); s.className = "section-title"; s.innerHTML = "<span>" + esc(it.section) + "</span>"; box.appendChild(s); }
    var bad = it.tags.filter(function (t) { return avoid.indexOf(t) >= 0; });
    var d = document.createElement("div"); d.className = "dish" + (bad.length ? " warn" : ""); d.id = "dish" + i;
    d.style.animationDelay = Math.min(i, 12) * 50 + "ms";
    d.innerHTML = '<div class="dish-top"><div class="dish-jp">' + esc(it.jp) + "</div>" + (it.price ? '<div class="price">¥' + it.price.toLocaleString() + "</div>" : "") + "</div>" +
      (it.ro ? '<div class="dish-ro">' + esc(it.ro) + "</div>" : "") +
      '<div class="dish-en">' + esc(it.en || "(unknown — tap 🔍)") + (it.sure === 1 ? ' <span class="mut small">· best guess</span>' : "") + "</div>" +
      (it.online ? '<div class="mut small">🌐 ' + esc(it.online) + "</div>" : "") +
      (it.desc ? '<div class="dish-desc">' + esc(it.desc) + "</div>" : "") +
      (it.ing ? '<div class="dish-ing"><b>Ingredients:</b> ' + esc(it.ing) + "</div>" : "") +
      (bad.length ? '<div class="dish-bad">⚠️ Contains ' + bad.map(function (t) { return FOOD_TAGS[t][1].toLowerCase(); }).join(", ") + "</div>" : "") +
      '<div class="ftags">' + tagChips(it.tags) + "</div>" +
      '<div class="actions"><button class="act" data-a="order">🙋 Order this</button><button class="act" data-a="say">🔊</button><button class="act" data-a="ask">❓ Ask</button><button class="act" data-a="tr">🔍 Translate</button><button class="act" data-a="fav">⭐</button></div>';
    on(d.querySelector('[data-a="order"]'), "click", function () { var u = UI(); u.showBig(it.jp + "をください", "", "One " + (it.en || it.jp) + ", please"); u.speak(it.jp + "をください"); });
    on(d.querySelector('[data-a="say"]'), "click", function () { UI().speak(it.jp); });
    on(d.querySelector('[data-a="ask"]'), "click", function () { var u = UI(); var q = bad.length ? "これに" + bad.map(jpAllergen).join("や") + "は入っていますか？" : "これは何が入っていますか？"; u.showBig(q, "", bad.length ? "Does this contain " + bad.join("/") + "?" : "What's in this?"); u.speak(q); });
    on(d.querySelector('[data-a="tr"]'), "click", function () { UI().translateText(it.jp); });
    on(d.querySelector('[data-a="fav"]'), "click", function (e) { UI().addFav({ jp: it.jp, en: it.en + (it.price ? " · ¥" + it.price : ""), ro: it.ro || "" }); e.currentTarget.textContent = "✅"; UI().toast("Saved ⭐"); });
    box.appendChild(d);
    if (it.box && colorCanvas) {
      var b = it.box, lab = document.createElement("button"); lab.className = "arlab" + (bad.length ? " bad" : "");
      var vertical = (b.y1 - b.y0) > (b.x1 - b.x0) * 1.6;
      var IW = it.W || colorCanvas.width, IH = it.H || colorCanvas.height;
      lab.style.left = (b.x0 / IW * 100) + "%"; lab.style.top = (b.y0 / IH * 100) + "%";
      lab.style.maxWidth = Math.max(18, (vertical ? 30 : (b.x1 - b.x0) / IW * 100 + 10)) + "%";
      lab.style.animationDelay = 200 + Math.min(i, 15) * 60 + "ms";
      lab.textContent = (bad.length ? "⚠️ " : "") + (it.en || it.jp) + (it.price ? " ¥" + it.price : "");
      on(lab, "click", function () { var el = $("#dish" + i); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("ping"); void el.offsetWidth; el.classList.add("ping"); });
      ar.appendChild(lab);
    }
  });
  on($("#arToggle"), "click", function () { var hidden = ar.classList.toggle("off"); $("#arToggle").textContent = "Labels on photo: " + (hidden ? "off" : "on"); });
}
var JP_ALLERGEN = { pork: "豚肉", beef: "牛肉", chicken: "鶏肉", fish: "魚", shellfish: "エビ・カニ・貝", egg: "卵", dairy: "乳製品", wheat: "小麦", soy: "大豆", nuts: "ナッツ・ごま", alcohol: "アルコール", spicy: "辛いもの", raw: "生もの", veg: "野菜", sweet: "砂糖", drink: "" };
function jpAllergen(t) { return JP_ALLERGEN[t] || t; }

/* ---------------------------------------------------------------- controls */
function paintAvoid() {
  var el = $("#avoid"); el.innerHTML = "";
  ["pork", "beef", "chicken", "fish", "shellfish", "egg", "dairy", "wheat", "nuts", "alcohol", "raw", "spicy"].forEach(function (t) {
    var b = document.createElement("button"); b.className = "cchip small" + (avoid.indexOf(t) >= 0 ? " on" : ""); b.textContent = FOOD_TAGS[t][0] + " " + FOOD_TAGS[t][1];
    on(b, "click", function () { var i = avoid.indexOf(t); if (i >= 0) avoid.splice(i, 1); else avoid.push(t); store.set("avoid", avoid); paintAvoid(); if (lastItems.length) render(lastItems, lastImg); });
    el.appendChild(b);
  });
}
function paintDir() { $$("#scanDir button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === dirMode); }); }
$$("#scanDir button").forEach(function (b) { on(b, "click", function () { dirMode = b.getAttribute("data-v"); store.set("scanDir", dirMode); paintDir(); }); });
function paintAI() { var b = $("#aiChip"); b.style.display = aiReady() ? "" : "none"; b.classList.toggle("on", store.get("aiAuto", true)); }
on($("#aiChip"), "click", function () { store.set("aiAuto", !store.get("aiAuto", true)); paintAI(); UI().toast(store.get("aiAuto", true) ? "✨ AI scan on (when online)" : "AI off — offline scanner only"); });
on($("#prefetchOCR"), "click", function () {
  var b = $("#prefetchOCR"); b.textContent = "Downloading…";
  getWorker("jpn", function (s, p) { b.textContent = "Downloading… " + Math.round(p * 100) + "%"; })
    .then(function () { return fetch("vendor/tesseract/lang/jpn_vert.traineddata.gz"); })
    .then(function () { b.textContent = "✅ Scanner works offline"; store.set("ocrReady", true); })
    .catch(function () { b.textContent = "Download failed — try again online"; });
});

window.HanaScan = {
  enter: function () { paintAvoid(); paintDir(); paintAI(); if (store.get("ocrReady", false)) $("#prefetchOCR").textContent = "✅ Scanner works offline"; if (!$("#cam").classList.contains("shot")) startCam(); },
  leave: function () { stopCam(); },
  refreshAI: paintAI,
  _test: { dbg: DBG, describe: describe, cleanLine: cleanLine, parsePrice: parsePrice, stripName: stripName, matchDish: matchDish, toItems: toItems, process: process }
};
})();
