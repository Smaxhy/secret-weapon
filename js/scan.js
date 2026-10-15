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
var KEY_DROP = /[\s・･,、。.!！?？()（）「」『』【】\[\]〜~ー－\-の]/;
function key(s) { return toHira(s).replace(/[\s・･,、。.!！?？()（）「」『』【】\[\]〜~ー－-]/g, "").replace(/の/g, ""); }
function keyIdx(s) { var idx = []; for (var i = 0; i < s.length; i++) if (!KEY_DROP.test(toHira(s.charAt(i)))) idx.push(i); return idx; } // key position -> source position
var FOOD = [], NAMES = [], DISHKEY = {};
FOOD_SRC.trim().split("\n").forEach(function (line) {
  var a = line.split("|"); if (a.length < 5) return;
  var f = { names: a[0].split("/"), en: a[1], ing: a[2], tags: a[3] ? a[3].split(",") : [], desc: a[4] };
  f.mod = f.tags.indexOf("mod") >= 0; // size / set / platter words: describe the dish next to them, never "be" the dish
  FOOD.push(f);
  f.names.forEach(function (n) { var k = key(n); if (k) { NAMES.push({ k: k, f: f, name: n }); DISHKEY[k] = 1; } });
});
NAMES.sort(function (a, b) { return b.k.length - a.k.length; });
var WORDS = Object.keys(FOOD_WORDS).map(function (w) { return { k: key(w), w: w, en: FOOD_WORDS[w][0], tag: FOOD_WORDS[w][1] }; }).filter(function (x) { return x.k; });
WORDS.sort(function (a, b) { return b.k.length - a.k.length; });
var SECTIONS = {}, SECT_JP = {}; Object.keys(FOOD_SECTIONS).forEach(function (k) { SECTIONS[key(k)] = FOOD_SECTIONS[k]; SECT_JP[key(k)] = k; });
var ANIMAL = ["pork", "beef", "chicken", "fish", "shellfish"];
var HAN = /[㐀-鿿]/, KANA_KEY = /^[ぁ-ゖ]+$/;

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
function devoice(s) { try { return s.normalize("NFD").replace(/[゙゚]/g, ""); } catch (e) { return s; } }
function wordsIn(k) { // greedy ingredient/cooking words in a key string
  var out = [], i = 0;
  while (i < k.length) {
    var hit = null;
    for (var n = 0; n < WORDS.length; n++) { var w = WORDS[n]; if (k.substr(i, w.k.length) === w.k) { hit = w; break; } }
    if (hit && (hit.k.length > 1 || HAN.test(hit.k))) { out.push(hit); i += hit.k.length; } else i++;
  }
  return out;
}
function uncovered(k) { // Japanese characters no food word explains
  var n = 0, i = 0;
  while (i < k.length) {
    var hit = null;
    for (var j = 0; j < WORDS.length; j++) { var w = WORDS[j]; if ((w.k.length > 1 || HAN.test(w.k)) && k.substr(i, w.k.length) === w.k) { hit = w; break; } }
    if (hit) i += hit.k.length; else { if (/[぀-ヿ㐀-鿿]/.test(k.charAt(i))) n++; i++; }
  }
  return n;
}
function wordEdge(s, atEnd) { // a known dish/food word starts (or ends) s
  var lists = [NAMES, WORDS];
  for (var L = 0; L < 2; L++) for (var i = 0; i < lists[L].length; i++) {
    var w = lists[L][i].k; if (w.length < 2 || w.length > s.length) continue;
    if (atEnd ? s.slice(s.length - w.length) === w : s.slice(0, w.length) === w) return true;
  }
  return false;
}
function edgeOK(k, at, nk) { // short kana names must not sit inside a longer kana word (とろ in とろろ, さわ in さわら)
  if (nk.length > 3 || !KANA_KEY.test(nk)) return true;
  var before = k.slice(0, at), after = k.slice(at + nk.length);
  if (/[ぁ-ゖ]/.test(before.charAt(before.length - 1)) && !wordEdge(before, true)) return false;
  if (/[ぁ-ゖ]/.test(after.charAt(0)) && !wordEdge(after, false)) return false;
  return true;
}
function knownWord(name) { // a real word that just isn't a dish (大豆, 白子…) must not be "corrected"
  if (FOOD_WORDS[name]) return true;
  if (!E || !E.ready()) return false;
  var r = E.jaToEn(name), w = r && r.words;
  return !!(w && w.length === 1 && !w[0].unknown && w[0].jp === name && w[0].en && w[0].en !== "?");
}
var glyphCache = {};
function glyphMask(ch) {
  if (glyphCache[ch]) return glyphCache[ch];
  var S = 28, c = document.createElement("canvas"); c.width = c.height = S;
  var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, S, S); g.fillStyle = "#000";
  g.font = "24px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, S / 2, S / 2);
  var d = g.getImageData(0, 0, S, S).data, m = new Uint8Array(S * S), o = new Uint8Array(S * S), x, y;
  for (var i = 0; i < S * S; i++) m[i] = d[i * 4] < 128 ? 1 : 0;
  for (y = 0; y < S; y++) for (x = 0; x < S; x++) if (m[y * S + x]) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S && Y < S) o[Y * S + X] = 1; }
  return (glyphCache[ch] = o);
}
function glyphSim(a, b) { // how alike two characters look (OCR confuses look-alikes: 杖/枝, 慮/唐)
  try { var A = glyphMask(a), B = glyphMask(b), i = 0, u = 0; for (var j = 0; j < A.length; j++) { if (A[j] && B[j]) i++; if (A[j] || B[j]) u++; } return u ? i / u : 0; } catch (e) { return 0; }
}
var GLYPH_MIN = 0.65, glyphOK = null;
function canGlyph() { if (glyphOK === null) glyphOK = glyphSim("木", "木") > 0.9; return glyphOK; }
function fuzzyIn(k, raw) { // OCR misreads: one wrong kanji in a 2-kanji name, or 1-2 edits (voicing marks ignored)
  if (k.length < 2) return null;
  var kb = devoice(k), best = null, bd = 9, bs = -1, i, n;
  var two = k.length === 2 && HAN.test(k) && !knownWord(raw);
  for (i = 0; i < NAMES.length; i++) {
    n = NAMES[i]; if (n.k.length < 2 || n.f.mod) continue;
    if (n.k.length === 2 || k.length === 2) {
      if (!two || n.k.length !== 2 || !HAN.test(n.k) || bd < 1) continue;
      var p = k[0] === n.k[0] ? 1 : k[1] === n.k[1] ? 0 : -1; if (p < 0 || k === n.k) continue;
      var sim = glyphSim(k[p], n.k[p]);
      if (sim > bs) { bs = sim; bd = 1; best = n; }
      continue;
    }
    var nb = n.kb || (n.kb = devoice(n.k)), max = n.k.length >= 6 ? 2 : 1, d = lev(kb, nb, max);
    if (d <= max && d < bd) { bd = d; best = n; bs = 1; }
  }
  if (best && best.k.length === 2 && bs < GLYPH_MIN && canGlyph()) return null; // sharing one kanji isn't enough: the other must look alike
  return best ? { n: best, d: bd } : null;
}
function bestVariant(f, k, raw) { // the dictionary spelling for an exact key match
  var best = null, bs = -1e9;
  f.names.forEach(function (n) { if (key(n) !== k) return; var s = 0; for (var i = 0; i < n.length; i++) if (raw.indexOf(n.charAt(i)) >= 0) s++; s -= Math.abs(n.length - raw.length) * 0.1; if (s > bs) { bs = s; best = n; } });
  return best;
}
function matchDish(name) {
  var k = key(name); if (!k) return null;
  var i, n, raw = name.replace(/\s+/g, "");
  for (i = 0; i < NAMES.length; i++) if (NAMES[i].k === k) {
    var v = bestVariant(NAMES[i].f, k, raw);
    return { f: NAMES[i].f, at: 0, len: k.length, k: k, exact: true, mods: [], fix: v && v.length > raw.length ? { a: 0, b: k.length, text: v } : null };
  }
  var hit = null, mod = null;
  for (i = 0; i < NAMES.length; i++) {
    n = NAMES[i]; if (n.k.length < 2) continue;
    var at = k.indexOf(n.k); if (at < 0 || !edgeOK(k, at, n.k)) continue;
    if (n.f.mod) { if (!mod) mod = { n: n, at: at }; continue; }
    hit = { n: n, at: at }; break;
  }
  function modsOutside(a, b) { // size/set words around the dish: つけ麺 + 大盛
    var out = [], rest = k.slice(0, a) + " " + k.slice(b);
    NAMES.forEach(function (x) { if (x.f.mod && x.k.length >= 2 && rest.indexOf(x.k) >= 0 && out.indexOf(x.f) < 0) { out.push(x.f); rest = rest.replace(x.k, " "); } });
    return out;
  }
  if (hit) {
    var len = hit.n.k.length, m = { f: hit.n.f, at: hit.at, len: len, k: k, mods: modsOutside(hit.at, hit.at + len) };
    // an unexplained leftover may be an OCR slip inside a more specific dish (油ラーメン -> 醤油ラーメン)
    if (uncovered(k.slice(0, hit.at) + k.slice(hit.at + len))) {
      var fz = fuzzyIn(k, raw);
      if (fz && fz.n.k.length > len && fz.n.k.indexOf(hit.n.k) >= 0) return { f: fz.n.f, at: 0, len: k.length, k: k, fuzzy: true, mods: [], fix: { a: 0, b: k.length, text: fz.n.name } };
    }
    return m;
  }
  if (mod) { // only a modifier was readable: the other side may be a misread dish (つけ敬 大盛)
    var a = k.slice(0, mod.at), b = k.slice(mod.at + mod.n.k.length), side = a.length >= b.length ? a : b, off = side === a ? 0 : mod.at + mod.n.k.length;
    var sf = side.length >= 2 ? fuzzyIn(side, side) : null;
    if (sf) return { f: sf.n.f, at: off, len: side.length, k: k, fuzzy: true, mods: [mod.n.f], fix: { a: off, b: off + side.length, text: sf.n.name } };
    return { f: mod.n.f, at: mod.at, len: mod.n.k.length, k: k, mods: [] };
  }
  var fw = fuzzyIn(k, raw);
  if (fw) return { f: fw.n.f, at: 0, len: k.length, k: k, fuzzy: true, mods: [], fix: { a: 0, b: k.length, text: fw.n.name } };
  return null;
}
function applyFix(name, fix) { // put the corrected dish spelling back into the OCR text
  if (!fix) return null;
  var idx = keyIdx(name); if (!idx.length || fix.b - 1 >= idx.length) return null;
  var out = name.slice(0, idx[fix.a]) + fix.text + name.slice(idx[fix.b - 1] + 1);
  return out === name ? null : out;
}
function sectionOf(sk, headingLike) { // -> {en, jp, exact} or null
  if (SECTIONS[sk]) return !DISHKEY[sk] || headingLike ? { en: SECTIONS[sk], jp: SECT_JP[sk], exact: true } : null; // サラダ / 刺身 / ラーメン are dishes too
  if (headingLike && sk.length >= 3 && !matchDish(sk)) for (var k in SECTIONS) if (k.length >= 3 && lev(sk, k, 1) <= 1) return { en: SECTIONS[k], jp: SECT_JP[k] };
  return null;
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function low(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
function stripMods(s, mods) { mods.forEach(function (f) { f.names.forEach(function (n) { var nk = key(n); if (nk) s = s.split(nk).join(""); }); }); return s; }
function finishTags(tags, k, m) {
  if (tags.soy && !/えだまめ|枝豆|わらび|きなこ|豆乳|大豆|だいず/.test(k)) tags.wheat = 1; // Japanese soy sauce is brewed with wheat
  if (!m || !m.exact) delete tags.veg; // only curated exact dishes may claim veg-friendly
  return Object.keys(tags);
}
function describe(name) {
  var k = key(name), m = matchDish(name), tags = {};
  function add(t) { if (t && t !== "mod") tags[t] = 1; }
  if (m) {
    m.f.tags.forEach(add);
    var a = stripMods(k.slice(0, m.at), m.mods), b = stripMods(k.slice(m.at + m.len), m.mods);
    var pre = wordsIn(a), post = wordsIn(b);
    pre.concat(post).forEach(function (w) { add(w.tag); });
    if (m.fuzzy) wordsIn(k).forEach(function (w) { add(w.tag); }); // a guess must not hide what was actually read
    m.mods.forEach(function (f) { f.tags.forEach(add); });
    var preEn = uniq(pre.map(function (w) { return w.en; })), postEn = uniq(post.map(function (w) { return w.en; }));
    var en = preEn.length ? cap(preEn.join(" ")) + " " + low(m.f.en) : m.f.en, desc = m.f.desc, ing = m.f.ing;
    if (m.f.names[0] === "唐揚げ" && !m.exact) { // 唐揚げ is a cooking style: タコの唐揚げ is octopus, not chicken
      var other = pre.filter(function (w) { return ANIMAL.indexOf(w.tag) >= 0 && w.tag !== "chicken"; });
      if (other.length) { en = cap(preEn.join(" ")) + " karaage (deep-fried)"; desc = "Deep-fried karaage style"; ing = ""; if (!pre.some(function (w) { return w.tag === "chicken"; })) delete tags.chicken; }
    }
    if (postEn.length) en += " (" + postEn.join(", ") + ")";
    if (m.mods.length) en += " (" + m.mods.map(function (f) { return low(f.en); }).join(", ") + ")";
    if (tags.raw && !m.exact && /焼|揚|あげ|ふらい|煮|蒸|炒|茹|ゆで|かつ|てんぷら|天ぷら|天(?!然|日)/.test(a + b)) delete tags.raw; // grilled/fried versions aren't raw
    return { en: en, desc: desc, ing: ing, tags: finishTags(tags, k, m), sure: m.exact ? 3 : m.fuzzy ? 1 : 2, fix: m.fuzzy || m.exact ? applyFix(name, m.fix) : null };
  }
  var ws = wordsIn(k); ws.forEach(function (w) { add(w.tag); });
  var lit = "";
  if (E && E.ready()) { var r = E.jaToEn(name); if (r && r.words && r.words.length) lit = r.words.map(function (w) { return w.en; }).filter(function (x) { return x && x !== "?"; }).join(" · "); }
  if (!lit && ws.length) lit = ws.map(function (w) { return w.en; }).join(" ");
  return { en: lit ? cap(lit) : "", desc: "", ing: ws.length ? uniq(ws.map(function (w) { return w.en; })).join(", ") : "", tags: finishTags(tags, k, null), sure: 0, fix: null };
}
function romajiOf(name) { if (E && E.ready()) { var r = E.jaToEn(name); if (r && r.ro) return r.ro.replace(/[.,!?]$/, ""); } return ""; }
var COUNT_EN = { "個": "pcs", "本": "pcs", "枚": "pcs", "貫": "pcs", "切れ": "slices", "切": "slices", "ピース": "pcs", "p": "pcs", "P": "pcs", "人前": "servings", "杯": "glasses", "皿": "plates", "g": "g" };
function noteEn(note) {
  var c = note.match(/^(\d+)\s*(個|本|枚|貫|切れ|切|ピース|p|P|人前|杯|皿|g)$/); if (c) return c[1] + " " + COUNT_EN[c[2]];
  var ws = wordsIn(key(note)); if (ws.length) return uniq(ws.map(function (w) { return w.en; })).join(", ");
  if (E && E.ready()) { var r = E.jaToEn(note); if (r && r.en) return r.en.replace(/[.!]$/, ""); }
  return "";
}

/* ---------------------------------------------------------------- OCR text clean-up */
function cleanLine(t) {
  t = String(t || "").replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); }).replace(/[，]/g, ",").replace(/[￥\\]/g, "¥");
  // kanji prices: OCR reads 九 as カ/力, 八 as ハ, 二 as ニ
  t = t.replace(/[カ力](?=[百千][〇一二三四五六七八九十百千]*円)/g, "九").replace(/ハ(?=[百千十][〇一二三四五六七八九十百千]*円)/g, "八").replace(/ニ(?=[百千十][〇一二三四五六七八九十百千]*円)/g, "二");
  t = t.replace(/(\d)\s*[.．,，]+\s*(\d{3})(?=\s*(円|$|\D))/g, "$1,$2").replace(/(\d)[oO](?=\d|円)/g, "$10").replace(/(\d)[QＱ](?=\d|円)/g, "$10");
  t = t.replace(/([^\x00-\x7f])\s+(?=[^\x00-\x7f])/g, "$1").replace(/(\d)\s+(?=[\d,])/g, "$1").replace(/,\s+(?=\d)/g, ",");
  t = t.replace(/(天|牛|豚|親子|カツ|かつ|海鮮|鉄火|中華|他人|うな|鰻|いくら|ネギトロ|ねぎとろ|マグロ|まぐろ|しらす|ステーキ|ローストビーフ|そぼろ|玉子|スタミナ|焼肉|ちらし)井/g, "$1丼");
  t = t.replace(/ラ一メン/g, "ラーメン").replace(/[一]{2,}/g, "ー");
  return t.trim();
}
var PRICE_RE = /(?:¥\s*(\d[\d,]{1,6}))|(?:(\d[\d,]{1,6})\s*円)|(?:(\d[\d,]{2,6})\s*(?:\(税込\)|（税込）|税込)?$)/;
var PRICE_END = /(?:¥\s*\d[\d,]*|\d[\d,]*\s*円|[〇一二三四五六七八九十百千万]+円|\d[\d,]{2,})\s*(?:\(?税込\)?|（税込）|\(?税抜\)?|（税抜）)?\s*$/;
var KNUM = { "〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
function kanjiNum(s) { var total = 0, cur = 0; for (var i = 0; i < s.length; i++) { var c = s[i]; if (KNUM[c] !== undefined) cur = cur * 10 + KNUM[c]; else if (c === "十") { total += (cur || 1) * 10; cur = 0; } else if (c === "百") { total += (cur || 1) * 100; cur = 0; } else if (c === "千") { total += (cur || 1) * 1000; cur = 0; } else if (c === "万") { total = (total + cur) * 10000; cur = 0; } } return total + cur; }
function parsePrice(t) {
  var k = t.match(/([〇零一二三四五六七八九十百千万]+)円/); if (k) { var kv = kanjiNum(k[1]); if (kv >= 50 && kv < 200000) return kv; }
  var m = t.match(PRICE_RE); if (!m) return null; var v = (m[1] || m[2] || m[3] || "").replace(/,/g, ""); var n = parseInt(v, 10); return n >= 50 && n < 200000 ? n : null;
}
function stripName(t) {
  t = t.replace(/[・.。,、:;]+\s*$/, "").replace(/^\s*[・.。,、]+/, "").replace(/[〇零一二三四五六七八九十百千万]+円/g, "").replace(/[¥]\s*[\d,]+/g, "").replace(/[\d,]+\s*円/g, "").replace(/\(?税込\)?|（税込）|\(?税抜\)?|（税抜）|税別/g, "")
    .replace(/[…‥・･.。:：\-－—_~〜]{2,}/g, " ").replace(/[\d,]{3,}\s*$/, "").replace(/^[\s・*※●○◎■□◆◇▼▲★☆\-]+/, "").replace(/\s{2,}/g, " ").trim()
    .replace(/[\s・.。,、:;]+$/, "").trim();
  // a small kana can't follow a kanji/digit: OCR junk (玉子ゃ) — but keep かぼちゃ
  return t.replace(/(^|[^ぁ-ゖァ-ヺー])[ゃゅょっぁぃぅぇぉャュョッァィゥェォ]+$/, "$1").replace(/^[ゃゅょっぁぃぅぇぉャュョッァィゥェォ]+/, "").trim();
}
var CJK = /[぀-ヿ㐀-鿿]/g;
function cjkCount(s) { var m = String(s).match(CJK); return m ? m.length : 0; }

/* ---------------------------------------------------------------- state & settings */
var store = { get: function (k, d) { try { var v = JSON.parse(localStorage.getItem("hana." + k)); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem("hana." + k, JSON.stringify(v)); } catch (e) {} } };
var avoid = store.get("avoid", []);
var dirMode = store.get("scanDir", "auto");
var DBG = {};
var stream = null, busy = false, scanSeq = 0, lastItems = [], lastImg = null, active = false, camWanted = false, camPending = null, aiAbort = null;

/* ---------------------------------------------------------------- tesseract worker */
var OCR_FILES = ["vendor/tesseract/tesseract.min.js", "vendor/tesseract/worker.min.js", "vendor/tesseract/lang/jpn.traineddata.gz", "vendor/tesseract/lang/jpn_vert.traineddata.gz"];
function loadScript(src) {
  return new Promise(function (res, rej) {
    if (window.Tesseract) return res();
    var s = document.createElement("script"); s.src = src; s.onload = res;
    s.onerror = function () { s.parentNode.removeChild(s); rej(new Error("Scanner files aren't saved yet — connect once and tap “Make the scanner work offline”")); };
    document.head.appendChild(s);
  });
}
var workerP = null, workerLang = null, progFn = null;
function getWorker(lang, progress) { // one worker at a time (phones are short on memory); scans are serialised by scanSeq/busy
  progFn = progress || null;
  if (workerP && workerLang === lang) return workerP;
  var old = workerP; workerLang = lang;
  var p = workerP = loadScript("vendor/tesseract/tesseract.min.js").then(function () {
    return old ? old.then(function (w) { return w.terminate(); }).catch(function () {}) : null;
  }).then(function () {
    var base = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
    return new Promise(function (res, rej) {
      var settled = false, timer = null;
      function fail(e) { if (settled) return; settled = true; clearTimeout(timer); rej(e instanceof Error ? e : new Error(String(e && e.message || e || "scanner failed to start"))); }
      function arm() { if (settled) return; clearTimeout(timer); timer = setTimeout(function () { fail(new Error(navigator.onLine ? "The scanner is taking too long to load — try again" : "Scanner data isn't downloaded yet — connect to the internet once")); }, 30000); }
      arm();
      Tesseract.createWorker(lang, 1, {
        workerPath: base + "vendor/tesseract/worker.min.js", corePath: base + "vendor/tesseract/core", langPath: base + "vendor/tesseract/lang",
        gzip: true, workerBlobURL: false, cacheMethod: "write",
        logger: function (m) { arm(); if (progFn && m && typeof m.progress === "number") progFn(m.status, m.progress); },
        errorHandler: fail // without it a failed data download never settles (and throws uncaught)
      }).then(function (w) { if (settled) { w.terminate(); return; } settled = true; clearTimeout(timer); res(w); }, fail);
    });
  });
  p.catch(function () { if (workerP === p) { workerP = null; workerLang = null; } });
  return p;
}
function prefetchVert() { // vertical menus need jpn_vert too: fetch it quietly once we're online
  if (!navigator.onLine || !window.caches) return;
  var u = OCR_FILES[3];
  caches.match(u).then(function (h) { if (!h) return fetch(u); }).catch(function () {});
}
function checkOCRReady() {
  var b = $("#prefetchOCR"); if (!b || !window.caches) return Promise.resolve(false);
  return Promise.all(OCR_FILES.map(function (u) { return caches.match(u); })).then(function (r) {
    var ok = r.every(Boolean);
    if (ok) return caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) { return caches.open(n).then(function (c) { return c.keys(); }); })).then(function (lists) {
        return lists.some(function (l) { return l.some(function (q) { return /\/core\/tesseract-core/.test(q.url); }); });
      });
    });
    return false;
  }).then(function (ok) {
    if (!b.classList.contains("loading")) b.textContent = ok ? "✅ Scanner works offline" : "⬇ Make the scanner work offline (~6 MB)";
    b.classList.toggle("done", ok); return ok;
  }).catch(function () { return false; });
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
  function energy(a) { // text rows line up -> a spiky row profile -> high sum of squares
    var r = a * Math.PI / 180, sn = Math.sin(r), cs = Math.cos(r), bins = new Float32Array(H * 2), sc = 0;
    for (i = 0; i < pts.length; i += 2) { var yy = Math.round(pts[i + 1] * cs - pts[i] * sn + H / 2); if (yy >= 0 && yy < bins.length) bins[yy]++; }
    for (i = 0; i < bins.length; i++) sc += bins[i] * bins[i];
    return sc;
  }
  var zero = energy(0), best = 0, bestScore = zero;
  for (var a = -10; a <= 10; a += 0.5) { if (!a) continue; var sc = energy(a); if (sc > bestScore) { bestScore = sc; best = a; } }
  return bestScore > zero * 1.1 ? best : 0; // straight photos stay untouched
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
var HAS_AR = !!(window.CSS && CSS.supports && CSS.supports("aspect-ratio", "1"));
function setCamRatio(w, h) { // older iOS has no aspect-ratio: fall back to padding-top
  var c = $("#cam");
  if (!w) { c.style.aspectRatio = ""; c.style.paddingTop = ""; return; }
  if (HAS_AR) c.style.aspectRatio = w + " / " + h; else c.style.paddingTop = (h / w * 100) + "%";
}
function camMsg(t) { var m = $("#camMsg"); m.textContent = t || ""; m.style.display = t ? "" : "none"; }
function liveTrack() { var tr = stream && stream.getVideoTracks()[0]; return tr && tr.readyState === "live" ? tr : null; }
function startCam() {
  camWanted = true;
  if (stream && liveTrack()) return Promise.resolve();
  if (stream) stopCam(true);
  if (camPending) return camPending;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camMsg("Camera not available here — use 🖼 to pick a photo"); return Promise.resolve(); }
  camMsg("Starting camera…");
  camPending = navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }).then(function (s) {
    camPending = null;
    if (!camWanted || stream) { s.getTracks().forEach(function (t) { t.stop(); }); return; } // user left the tab / took a photo meanwhile
    stream = s; var v = $("#video"); v.srcObject = s; v.setAttribute("playsinline", ""); v.muted = true;
    var tr = s.getVideoTracks()[0];
    if (tr) tr.onended = function () { if (stream === s) { stopCam(true); camMsg("Camera paused — tap the shutter"); } }; // iOS ends the track when the app is backgrounded
    var caps = tr && tr.getCapabilities ? tr.getCapabilities() : {};
    $("#torchBtn").style.visibility = caps && caps.torch ? "visible" : "hidden";
    return v.play().then(function () { if (stream === s) camMsg(""); }, function () { if (stream === s) camMsg("Tap the shutter to start the camera"); });
  }).catch(function () { camPending = null; if (camWanted) camMsg("Camera blocked — allow it in settings, or use 🖼 to pick a photo"); });
  return camPending;
}
function stopCam(keepWanted) {
  if (!keepWanted) camWanted = false;
  if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  var v = $("#video"); if (v) v.srcObject = null;
  torch = false; $("#torchBtn").classList.remove("on");
}
var torch = false;
on($("#torchBtn"), "click", function () { var tr = liveTrack(); if (!tr) return; torch = !torch; tr.applyConstraints({ advanced: [{ torch: torch }] }).catch(function () {}); $("#torchBtn").classList.toggle("on", torch); });
function showLive() {
  setCamRatio(0); $("#cam").classList.remove("shot", "done", "scanning");
  $("#shot").removeAttribute("src"); $("#ar").innerHTML = ""; $("#ar").classList.remove("off"); $("#retake").style.display = "none";
}
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { if (stream) stopCam(true); }
  else if (active && camWanted && !$("#cam").classList.contains("shot")) startCam();
});

on($("#shutter"), "click", function () {
  if (busy) return;
  var v = $("#video"), tr = liveTrack();
  if ($("#cam").classList.contains("shot")) { showLive(); $("#scanResults").innerHTML = ""; startCam(); return; }
  if (!tr || tr.muted || !v.videoWidth) { if (stream) stopCam(true); startCam(); return; } // dead or frozen camera: restart instead of scanning a stale frame
  try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
  var c = toCanvas(v, 2000, 0);
  $("#cam").classList.add("flash"); setTimeout(function () { $("#cam").classList.remove("flash"); }, 300);
  process(c);
});
function hold() { if (UI()) UI().toast("Hang on — still reading the last one 📖"); }
on($("#upBtn"), "click", function () { if (busy) return hold(); $("#fileIn").click(); });
on($("#fileIn"), "change", function () {
  var f = $("#fileIn").files && $("#fileIn").files[0]; $("#fileIn").value = ""; if (!f) return;
  if (busy) return hold();
  var img = new Image(), url = URL.createObjectURL(f);
  img.onload = function () { URL.revokeObjectURL(url); process(toCanvas(img, 2000, 0)); };
  img.onerror = function () { URL.revokeObjectURL(url); if (UI()) UI().toast("Can't open that photo (HEIC?) — use the camera or pick a JPEG"); };
  img.src = url;
});
on($("#retake"), "click", function () {
  scanSeq++; busy = false; lastItems = [];
  if (aiAbort) { try { aiAbort.abort(); } catch (e) {} aiAbort = null; }
  setProg(0); showLive(); $("#scanResults").innerHTML = ""; startCam();
});

/* ---------------------------------------------------------------- pipeline */
function setProg(p, label) { $("#scanFill").style.width = Math.round(p * 100) + "%"; if (label) camMsg(label); }
function process(colorCanvas) {
  var my = ++scanSeq; busy = true; lastItems = []; lastImg = colorCanvas;
  function alive() { return my === scanSeq; }
  stopCam();
  $("#shot").src = colorCanvas.toDataURL("image/jpeg", 0.9);
  setCamRatio(colorCanvas.width, colorCanvas.height);
  $("#cam").classList.remove("done"); $("#cam").classList.add("shot", "scanning"); $("#ar").innerHTML = ""; $("#ar").classList.remove("off"); $("#retake").style.display = "";
  $("#scanResults").innerHTML = '<div class="empty-note"><div class="dots"><i></i><i></i><i></i></div></div>';
  if (UI()) UI().say(UI().line("scan"));
  var useAI = aiReady() && navigator.onLine && store.get("aiAuto", true);
  Promise.resolve().then(function () { return useAI ? aiScan(colorCanvas, alive) : ocrScan(colorCanvas, alive); }).then(function (items) {
    if (!alive()) return;
    $("#cam").classList.remove("scanning"); $("#cam").classList.add("done"); setProg(1); camMsg(""); setTimeout(function () { if (alive()) setProg(0); }, 600);
    lastItems = items; render(items, lastImg);
    if (UI()) {
      if (!items.length) UI().say(["うーん…読めないわ", "Hmm, I can't read that one. Get closer & hold steady?"]);
      else if (items.some(function (it) { return it.tags.indexOf("alcohol") >= 0; })) UI().say(UI().line("alcohol"));
      else if (items.some(function (it) { return it.tags.indexOf("spicy") >= 0; })) UI().say(UI().line("spicy"));
      else UI().say(UI().line("scanDone"));
    }
  }).catch(function (err) {
    if (!alive()) return;
    $("#cam").classList.remove("scanning"); setProg(0); camMsg("");
    $("#scanResults").innerHTML = '<div class="empty-note">Scan failed: ' + esc(err && err.message || err) + "</div>";
  }).then(function () { if (alive()) busy = false; });
}

function ocrScan(colorCanvas, alive) {
  // 1) straighten  2) high-contrast b/w  3) OCR horizontal (sparse) and/or vertical (per column)  4) rebuild menu rows
  alive = alive || function () { return true; };
  function check(v) { if (!alive()) throw new Error("cancelled"); return v; }
  var firstLoad = !workerP;
  setProg(0.03, "Straightening photo…");
  var small = toCanvas(colorCanvas, 2000, 1200);
  var ang = skewAngle(small), rot = Math.abs(ang) >= 0.75 ? -ang : 0;
  var straight = rotateCanvas(small, rot);
  if (rot) { lastImg = straight; $("#shot").src = straight.toDataURL("image/jpeg", 0.9); setCamRatio(straight.width, straight.height); }
  DBG.angle = ang;
  var B = binarize(straight), W = straight.width, H = straight.height;
  function prog(base, span) {
    return function (status, p) {
      if (!alive()) return;
      if (/recogniz/.test(status)) setProg(base + p * span, "Reading the menu… " + Math.round((base + p * span) * 100) + "%");
      else setProg(Math.min(base, 0.3) * p, firstLoad ? "Loading scanner (first time only)…" : "Warming up…");
    };
  }
  function horizontal() {
    return getWorker("jpn", prog(0.1, 0.55)).then(check).then(function (w) {
      if (navigator.onLine) prefetchVert();
      return w.setParameters({ tessedit_pageseg_mode: "11" }).then(function () { return w.recognize(B.canvas, {}, { blocks: true }); });
    }).then(check).then(function (r) { DBG.data = r.data; return mergeRows(piecesOf(r.data)); });
  }
  function vertical() {
    var colSum = new Float32Array(W), x, y;
    for (x = 0; x < W; x++) { var s = 0; for (y = 0; y < H; y++) s += B.ink[y * W + x]; colSum[x] = s; }
    var cols = runs(colSum, Math.max(1, H / 400), Math.max(4, Math.round(W / 140)), Math.max(8, Math.round(W / 90))).reverse(); // right -> left
    var out = [], chain = getWorker("jpn_vert", prog(0.1, 0.05));
    out.vert = true;
    cols.forEach(function (c, ci) {
      chain = chain.then(check).then(function (w) {
        var rowSum = new Float32Array(H); for (y = 0; y < H; y++) { var s2 = 0; for (x = c[0]; x <= c[1]; x++) s2 += B.ink[y * W + x]; rowSum[y] = s2; }
        var span = runs(rowSum, 0, H, 4)[0]; if (!span) return w;
        var pad = Math.round((c[1] - c[0]) * 0.4);
        var strip = crop(B.canvas, c[0], span[0], c[1], span[1], pad);
        return w.setParameters({ tessedit_pageseg_mode: "5" }).then(function () { return w.recognize(strip); }).then(function (r) {
          if (alive()) setProg(0.15 + 0.8 * (ci + 1) / cols.length, "Reading vertical columns… " + (ci + 1) + "/" + cols.length);
          var t = cleanLine((r.data.text || "").replace(/\s+/g, ""));
          if (t) out.push({ text: t, conf: r.data.confidence, box: { x0: c[0], y0: span[0], x1: c[1], y1: span[1] } });
          return w;
        });
      });
    });
    return chain.then(function () { return out; });
  }
  function score(lines) { // real dishes and priced names count; raw character soup doesn't
    return lines.reduce(function (a, l) {
      var n = stripName(l.text), c = cjkCount(n), m = c ? matchDish(n) : null;
      return a + (m && !m.fuzzy ? 4 : 0) + (c && parsePrice(l.text) ? 2 : 0) + c * Math.max(0.1, l.conf / 100) * 0.25;
    }, 0);
  }
  var p;
  if (dirMode === "v") p = vertical();
  else if (dirMode === "h") p = horizontal();
  else p = horizontal().then(function (h) {
    var priced = h.filter(function (l) { return parsePrice(l.text) && cjkCount(stripName(l.text)) >= 2; }).length;
    var avg = h.length ? h.reduce(function (a, l) { return a + l.conf; }, 0) / h.length : 0;
    if (priced >= 2 || (score(h) >= 14 && avg >= 60)) return h;
    return vertical().then(function (v) { return score(v) > score(h) * 1.2 ? v : h; }, function (e) { if (!alive()) throw e; return h; });
  });
  return p.then(check).then(function (lines) { return toItems(lines, W, H, !!lines.vert); }).then(onlineBoost);
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
function mergeRows(pieces) { // pieces on the same text row -> menu lines ("name … price"), one per column
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
      // a far-away *name* starts another column; a far-away price still belongs to this name
      if (seg && gap > hgt * 6 && cjkCount(stripName(p.text)) > 0 && cjkCount(stripName(seg.text)) > 0) { out.push(seg); seg = null; }
      if (!seg) seg = { text: p.text, confs: [p.conf], box: { x0: p.box.x0, y0: p.box.y0, x1: p.box.x1, y1: p.box.y1 } };
      else { seg.text += " " + p.text; seg.confs.push(p.conf); seg.box.x0 = Math.min(seg.box.x0, p.box.x0); seg.box.y0 = Math.min(seg.box.y0, p.box.y0); seg.box.x1 = Math.max(seg.box.x1, p.box.x1); seg.box.y1 = Math.max(seg.box.y1, p.box.y1); }
      if (parsePrice(p.text) && PRICE_END.test(p.text)) { out.push(seg); seg = null; } // a price closes the item (two-column rows)
    });
    if (seg) out.push(seg);
  });
  out.forEach(function (s) { s.conf = s.confs.reduce(function (a, b) { return a + b; }, 0) / s.confs.length; s.text = cleanLine(s.text); });
  return out;
}
function orderByColumns(lines, W) { // two-column menus: read the left column top-to-bottom, then the right one
  var named = lines.filter(function (l) { return l.box && cjkCount(stripName(l.text)) > 0; });
  var side = named.filter(function (l) { return !(l.box.x0 < W * 0.45 && l.box.x1 > W * 0.55); });
  var xs = side.map(function (l) { return l.box.x0; }).sort(function (a, b) { return a - b; });
  if (xs.length < 4) return lines;
  var gap = 0, split = 0, i;
  for (i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > gap) { gap = xs[i] - xs[i - 1]; split = (xs[i] + xs[i - 1]) / 2; }
  if (gap < W * 0.18) return lines;
  var left = side.filter(function (l) { return l.box.x0 < split; }), right = side.filter(function (l) { return l.box.x0 >= split; });
  if (left.length < 2 || right.length < 2) return lines;
  function span(a) { return [Math.min.apply(null, a.map(function (l) { return l.box.y0; })), Math.max.apply(null, a.map(function (l) { return l.box.y1; }))]; }
  var sl = span(left), sr = span(right), ov = Math.min(sl[1], sr[1]) - Math.max(sl[0], sr[0]);
  if (ov < 0.5 * Math.min(sl[1] - sl[0], sr[1] - sr[0])) return lines; // not side by side
  var top = Math.min(sl[0], sr[0]), before = [], after = [], rest = [];
  lines.forEach(function (l) {
    if (left.indexOf(l) >= 0 || right.indexOf(l) >= 0) return;
    if (l.box && cjkCount(stripName(l.text)) > 0) (l.box.y1 <= top ? before : after).push(l); else rest.push(l); // titles above, footers below; loose prices are placed by position later
  });
  return before.concat(left, right, after, rest);
}
function toItems(lines, W, H, vert) {
  var items = [], section = "", pending = [], hs = [], named = 0, priced = 0;
  lines.forEach(function (l) {
    var c = cjkCount(stripName(l.text)); if (!c) return;
    named++; if (parsePrice(l.text)) priced++;
    if (!vert && l.box && l.box.x1 - l.box.x0 > l.box.y1 - l.box.y0) hs.push(l.box.y1 - l.box.y0);
  });
  hs.sort(function (a, b) { return a - b; });
  var medH = hs.length >= 3 ? hs[hs.length >> 1] : 0, mostlyPriced = named >= 3 && priced / named >= 0.5;
  if (!vert) lines = orderByColumns(lines, W);
  lines.forEach(function (l) {
    var price = parsePrice(l.text), name = stripName(l.text), cj = cjkCount(name);
    if (cj === 0) { if (price) pending.push({ price: price, box: l.box }); return; }
    if (l.conf < 30 && cj < 3) return;
    if (isLeaderJunk(name)) return;
    var sk = key(name);
    if (!sk) return;
    if (!price) { // headings: known section words, or bigger text without a price
      var tall = !!(medH && l.box && (l.box.y1 - l.box.y0) >= medH * 1.12 && cj <= 8);
      var sec = sectionOf(sk, tall || mostlyPriced), label = "";
      if (sec) label = sec.en + " · " + (sec.exact ? name : sec.jp); // misread heading (リンク): show the real word (ドリンク)
      else if (tall) { var he = describe(name).en.replace(/ \(.*$/, ""); label = he && he !== name ? he + " · " + name : name; }
      if (label) { section = label; return; }
    }
    var note = "", base = name, pm = name.match(/\s*[（(]\s*([^()（）]{1,10}?)\s*[)）]?\s*$/);
    if (pm && cjkCount(name.slice(0, pm.index)) >= 1) { note = pm[1].replace(/\s+/g, ""); base = name.slice(0, pm.index).trim(); } // 餃子（6個） -> 餃子 + "6 pcs"
    var d = describe(base);
    if (!d.en && cj < 2) return;
    var jp = d.fix || base, ne = note ? noteEn(note) : "";
    items.push({ jp: jp, raw: d.fix ? base : "", note: note, ro: romajiOf(jp), en: d.en ? d.en + (ne ? " (" + ne + ")" : "") : "", desc: d.desc, ing: d.ing, tags: d.tags, price: price, sure: d.sure, box: l.box, section: section, conf: l.conf, W: W, H: H });
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
  "List every food and drink item you can read, in menu order (for multi-column menus, finish one column before the next). For each item give: the Japanese name exactly as written (jp), Hepburn romaji, " +
  "a natural English menu name (en), a one-sentence description of what it actually is, the typical main ingredients (short list), " +
  "dietary tags chosen only from the allowed list (include every allergen-relevant tag that typically applies: soy sauce, miso and tare contain wheat; dashi is fish; soba is buckwheat unless it's 中華そば/焼きそば/沖縄そば), the price in yen as an integer (0 if not shown), " +
  "and the menu section heading in English (empty string if none). Expand abbreviations (e.g. 生 at a bar = draft beer). " +
  "In notes, add short useful tips for ordering (cover charges like お通し, set inclusions, sizes, spiciness levels) or say what you couldn't read. " +
  "If the photo isn't a menu, return an empty items list and explain in notes.";
function aiKey() { return store.get("claudeKey", ""); }
function aiReady() { return !!aiKey(); }
var SDK_URL = "vendor/anthropic/anthropic-sdk-0.129.0.mjs", sdkPromise = null;
function loadSDK() {
  // self-hosted ESM bundle (same origin, cached for offline by the service worker); dynamic import via Function so older browsers can still parse this file
  if (!sdkPromise) sdkPromise = new Function("u", "return import(u)")(new URL(SDK_URL, location.href).href)
    .then(function (m) { return m.default || m.Anthropic; })
    .catch(function (e) { sdkPromise = null; throw e; }); // a failed load must not disable AI for the whole session
  return sdkPromise;
}
function aiScan(colorCanvas, alive) {
  alive = alive || function () { return true; };
  setProg(0.1, "Sending to AI ✨ (needs internet)…");
  var c = toCanvas(colorCanvas, 1568, 0), data = c.toDataURL("image/jpeg", 0.85).split(",")[1];
  var t0 = Date.now(), tick = setInterval(function () { if (!alive()) return clearInterval(tick); var p = Math.min(0.92, 0.1 + (Date.now() - t0) / 40000); setProg(p, "AI is reading every dish… " + Math.round((Date.now() - t0) / 1000) + "s"); }, 400);
  var ctl = typeof AbortController !== "undefined" ? new AbortController() : null; aiAbort = ctl;
  var job = Promise.resolve().then(loadSDK).then(function (Anthropic) {
    var client = new Anthropic({ apiKey: aiKey(), dangerouslyAllowBrowser: true, timeout: 60000, maxRetries: 1 });
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
    }, ctl ? { signal: ctl.signal } : undefined);
  });
  var deadline = new Promise(function (res, rej) { setTimeout(function () { rej(new Error("no answer after 90 s (bad connection?)")); }, 90000); });
  return Promise.race([job, deadline]).then(function (resp) {
    clearInterval(tick); if (aiAbort === ctl) aiAbort = null;
    if (resp.stop_reason === "refusal") throw new Error("the AI declined this image");
    if (resp.stop_reason === "max_tokens") throw new Error("menu too long for one AI pass — scan half of it");
    var txt = resp.content.filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
    var j = JSON.parse(txt);
    var items = (j.items || []).map(function (it) {
      return { jp: it.jp, ro: it.romaji, en: it.en, desc: it.description, ing: (it.ingredients || []).join(", "), tags: it.tags || [], price: it.price_yen || null, sure: 4, box: null, section: it.section || "", ai: true };
    });
    items.notes = j.notes || "";
    return items;
  }).catch(function (err) {
    clearInterval(tick);
    if (ctl) { try { ctl.abort(); } catch (e) {} }
    if (aiAbort === ctl) aiAbort = null;
    if (!alive()) throw new Error("cancelled");
    var msg = String(err && (err.status === 401 ? "API key rejected" : err.message) || err);
    if (UI()) UI().toast("AI scan failed — using offline scanner");
    console.warn("AI scan failed:", msg);
    return ocrScan(colorCanvas, alive).then(function (items) { items.notes = "AI scan failed (" + msg + "), these are offline results."; return items; });
  });
}

/* ---------------------------------------------------------------- render */
function tagChips(tags, sure) {
  var hasAnimal = tags.some(function (t) { return ANIMAL.indexOf(t) >= 0; });
  return tags.filter(function (t) { return FOOD_TAGS[t] && !(t === "veg" && (hasAnimal || sure <= 1)); }).map(function (t) {
    return '<span class="ftag' + (avoid.indexOf(t) >= 0 ? " bad" : "") + '">' + FOOD_TAGS[t][0] + " " + FOOD_TAGS[t][1] + "</span>";
  }).join("");
}
var JP_ALLERGEN = { pork: "豚肉", beef: "牛肉", chicken: "鶏肉", fish: "魚", shellfish: "エビ・カニ・貝", egg: "卵", dairy: "乳製品", wheat: "小麦", buckwheat: "そば", soy: "大豆", nuts: "ナッツ・ごま", alcohol: "お酒", spicy: "辛いもの", raw: "生もの", veg: "野菜", sweet: "砂糖", drink: "" };
function jpAllergen(t) { return JP_ALLERGEN[t] || t; }
function askPhrase() { // built from the whole avoid list: the dish may contain things the scanner didn't see
  var al = avoid.filter(function (t) { return t !== "spicy" && t !== "alcohol" && t !== "raw" && FOOD_TAGS[t]; });
  var jp = [], en = [];
  if (al.length) {
    jp.push(al.map(jpAllergen).join("・") + "のアレルギーがあります。これに" + al.map(jpAllergen).join("や") + "は入っていますか？");
    var names = al.map(function (t) { return FOOD_TAGS[t][1].replace(/ \(.*\)$/, "").toLowerCase(); });
    en.push("I'm allergic to " + names.join(", ") + ". Does this contain " + names.join(" or ") + "?");
  }
  if (avoid.indexOf("raw") >= 0) { jp.push("これは生ですか？"); en.push("Is this raw?"); }
  if (avoid.indexOf("spicy") >= 0) { jp.push("これは辛いですか？"); en.push("Is this spicy?"); }
  if (avoid.indexOf("alcohol") >= 0) { jp.push("これにお酒は入っていますか？"); en.push("Does this contain alcohol?"); }
  return jp.length ? { jp: jp.join(""), en: en.join(" ") } : { jp: "これには何が入っていますか？", en: "What's in this?" };
}
function render(items, colorCanvas) {
  var box = $("#scanResults"), ar = $("#ar");
  ar.innerHTML = ""; box.innerHTML = ""; ar.classList.remove("off");
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
    var ro = (it.ro || "") + (it.note ? (it.ro ? " · " : "") + "（" + it.note + "）" : "");
    d.innerHTML = '<div class="dish-top"><div class="dish-jp">' + esc(it.jp) + "</div>" + (it.price ? '<div class="price">¥' + it.price.toLocaleString("en-US") + "</div>" : "") + "</div>" +
      (ro ? '<div class="dish-ro">' + esc(ro) + "</div>" : "") +
      '<div class="dish-en">' + esc(it.en || "(unknown — tap 🔍)") + (it.sure === 1 ? ' <span class="mut small">· best guess</span>' : "") + "</div>" +
      (it.raw ? '<div class="mut small">📷 read as 「' + esc(it.raw) + "」</div>" : "") +
      (it.online ? '<div class="mut small">🌐 ' + esc(it.online) + "</div>" : "") +
      (it.desc ? '<div class="dish-desc">' + esc(it.desc) + "</div>" : "") +
      (it.ing ? '<div class="dish-ing"><b>Ingredients:</b> ' + esc(it.ing) + "</div>" : "") +
      (bad.length ? '<div class="dish-bad">⚠️ Contains ' + bad.map(function (t) { return FOOD_TAGS[t][1].toLowerCase(); }).join(", ") + "</div>" : "") +
      (!it.ai && it.sure <= 1 ? '<div class="dish-unsure">Allergens not verified — tap ❓ Ask</div>' : "") +
      '<div class="ftags">' + tagChips(it.tags, it.sure) + "</div>" +
      '<div class="actions"><button class="act" data-a="order">🙋 Order this</button><button class="act" data-a="say">🔊</button><button class="act" data-a="ask">❓ Ask</button><button class="act" data-a="tr">🔍 Translate</button><button class="act" data-a="fav">⭐</button></div>';
    on(d.querySelector('[data-a="order"]'), "click", function () { var u = UI(), q = it.jp + "を一つください"; u.showBig(q, "", "One " + (it.en || it.jp) + ", please"); u.speak(q); });
    on(d.querySelector('[data-a="say"]'), "click", function () { UI().speak(it.jp); });
    on(d.querySelector('[data-a="ask"]'), "click", function () { var u = UI(), q = askPhrase(); u.showBig(q.jp, "", q.en); u.speak(q.jp); });
    on(d.querySelector('[data-a="tr"]'), "click", function () { UI().translateText(it.jp); });
    on(d.querySelector('[data-a="fav"]'), "click", function (e) { UI().addFav({ jp: it.jp, en: (it.en || "") + (it.price ? " · ¥" + it.price : ""), ro: it.ro || "" }); e.currentTarget.textContent = "✅"; UI().toast("Saved ⭐"); });
    box.appendChild(d);
    if (it.box && colorCanvas) {
      var b = it.box, lab = document.createElement("button"); lab.className = "arlab" + (bad.length ? " bad" : "");
      var IW = it.W || colorCanvas.width, IH = it.H || colorCanvas.height, vertical = (b.y1 - b.y0) > (b.x1 - b.x0) * 1.6;
      var left = b.x0 / IW * 100, top = b.y0 / IH * 100, w;
      if (vertical) { // vertical menus: a slim label running down its own column
        lab.classList.add("v"); w = 6;
        lab.style.maxHeight = Math.max(12, (b.y1 - b.y0) / IH * 100) + "%";
      } else {
        w = Math.min(96, Math.max(18, (b.x1 - b.x0) / IW * 100 + 10));
        if (left + w > 99) left = Math.max(1, 99 - w);
        lab.style.maxWidth = w + "%";
      }
      if (top < 9 && left + w > 62) top = 9; // keep clear of the "New scan" button
      lab.style.left = Math.min(left, 99 - (vertical ? 5 : 0)) + "%"; lab.style.top = Math.min(top, 96) + "%";
      lab.style.animationDelay = 200 + Math.min(i, 15) * 60 + "ms";
      lab.textContent = (bad.length ? "⚠️ " : "") + (it.en || it.jp) + (it.price ? " ¥" + it.price : "");
      on(lab, "click", function () { var el = $("#dish" + i); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("ping"); void el.offsetWidth; el.classList.add("ping"); });
      ar.appendChild(lab);
    }
  });
  on($("#arToggle"), "click", function () { var hidden = ar.classList.toggle("off"); $("#arToggle").textContent = "Labels on photo: " + (hidden ? "off" : "on"); });
}

/* ---------------------------------------------------------------- controls */
function paintAvoid() {
  var el = $("#avoid"); el.innerHTML = "";
  ["pork", "beef", "chicken", "fish", "shellfish", "egg", "dairy", "wheat", "buckwheat", "soy", "nuts", "alcohol", "raw", "spicy"].forEach(function (t) {
    var b = document.createElement("button"); b.className = "cchip small" + (avoid.indexOf(t) >= 0 ? " on" : ""); b.textContent = FOOD_TAGS[t][0] + " " + FOOD_TAGS[t][1];
    on(b, "click", function () { var i = avoid.indexOf(t); if (i >= 0) avoid.splice(i, 1); else avoid.push(t); store.set("avoid", avoid); paintAvoid(); if (lastItems.length && !busy) render(lastItems, lastImg); });
    el.appendChild(b);
  });
}
function paintDir() { $$("#scanDir button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === dirMode); }); }
$$("#scanDir button").forEach(function (b) { on(b, "click", function () { dirMode = b.getAttribute("data-v"); store.set("scanDir", dirMode); paintDir(); }); });
function paintAI() { var b = $("#aiChip"); b.style.display = aiReady() ? "" : "none"; b.classList.toggle("on", store.get("aiAuto", true)); }
on($("#aiChip"), "click", function () { store.set("aiAuto", !store.get("aiAuto", true)); paintAI(); UI().toast(store.get("aiAuto", true) ? "✨ AI scan on (when online)" : "AI off — offline scanner only"); });
on($("#prefetchOCR"), "click", function () {
  var b = $("#prefetchOCR");
  if (busy) return hold();
  if (!navigator.onLine) { UI().toast("Connect to the internet first"); return; }
  b.classList.add("loading"); b.textContent = "Downloading…";
  getWorker("jpn", function (s, p) { b.textContent = "Downloading… " + Math.round(p * 100) + "%"; })
    .then(function () { return Promise.all(OCR_FILES.map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); }); })); })
    .then(function () { b.classList.remove("loading"); return checkOCRReady(); })
    .then(function (ok) { if (!ok && !window.caches) b.textContent = "✅ Downloaded"; })
    .catch(function () { b.classList.remove("loading"); b.textContent = "Download failed — try again online"; });
});

window.HanaScan = {
  enter: function () { active = true; paintAvoid(); paintDir(); paintAI(); checkOCRReady(); if (!$("#cam").classList.contains("shot")) startCam(); },
  leave: function () { active = false; stopCam(); },
  refreshAI: paintAI,
  _test: { dbg: DBG, describe: describe, cleanLine: cleanLine, parsePrice: parsePrice, stripName: stripName, matchDish: matchDish, toItems: toItems, process: process, glyphSim: glyphSim, skewAngle: skewAngle }
};
})();
