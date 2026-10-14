/* Hana — UI. Conservative JS (no ?., ??, bare catch) so older phones run it. */
(function () {
"use strict";
var E = window.HanaEngine;
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt || false); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
var store = {
  get: function (k, d) { try { var v = JSON.parse(localStorage.getItem("hana." + k)); return v == null ? d : v; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem("hana." + k, JSON.stringify(v)); } catch (e) {} }
};
var S = store.get("settings", {});
var DEF = { tone: "casual", me: "俺", mode: "auto", rate: 0.9, anim: true, chat: true };
Object.keys(DEF).forEach(function (k) { if (S[k] === undefined) S[k] = DEF[k]; });
function saveS() { store.set("settings", S); E.opts.tone = S.tone; E.opts.me = S.me; }
saveS();
var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function animOn() { return S.anim && !reduce; }
function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} }

/* ---------------------------------------------------------------- mascot */
var MASCOT_SVG = "";
function fillMascots() { $$("[data-mascot]").concat([$("#mascotHead")]).forEach(function (el) { if (el && MASCOT_SVG) el.innerHTML = MASCOT_SVG; }); }
fetch("img/hana.svg").then(function (r) { return r.text(); }).then(function (t) {
  MASCOT_SVG = t.replace(/<\?xml[^>]*>/, "").replace(/id="([^"]+)"/g, function (m, id) { return 'id="' + id + '"'; });
  fillMascots();
}).catch(function () {});
var bubbleT = null;
function say(jp, en, force) {
  if (jp && typeof jp === "object") { force = en; en = jp[1]; jp = jp[0]; }
  if (!jp || (!S.chat && !force)) return;
  var b = $("#bubble");
  b.innerHTML = esc(jp) + (en ? "<small>" + esc(en) + "</small>" : "");
  b.classList.add("show");
  var av = $("#mascotBtn"); av.classList.remove("happy"); void av.offsetWidth; av.classList.add("happy");
  clearTimeout(bubbleT); bubbleT = setTimeout(function () { b.classList.remove("show"); }, 2800);
}
var LINES = [["やっほー！", "Heyy! Ready to translate?"], ["何でも聞いて！", "Ask me anything!"], ["日本楽しんでね！", "Enjoy Japan!"], ["ラーメン食べた？", "Had ramen yet?"], ["オフラインでも任せて💪", "I work offline too!"], ["単語帳で練習しよ！", "Practice in the word book!"], ["ガンバ！", "You got this!"]];
on($("#mascotBtn"), "click", function () { var l = LINES[Math.floor(Math.random() * LINES.length)]; say(l[0], l[1], true); sparkle($("#mascotBtn")); vibrate(10); });

/* ---------------------------------------------------------------- fx */
function ripple(e) {
  if (!animOn()) return;
  var t = e.currentTarget, r = t.getBoundingClientRect(), d = Math.max(r.width, r.height);
  var s = document.createElement("span"); s.className = "rip";
  var x = (e.clientX || r.left + r.width / 2) - r.left - d / 2, y = (e.clientY || r.top + r.height / 2) - r.top - d / 2;
  s.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + x + "px;top:" + y + "px";
  t.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
}
function addRipples(root) { $$((root || "") + " .go, " + (root || "") + " .btn, " + (root || "") + " .act, " + (root || "") + " .qcat").forEach(function (b) { if (!b._rip) { b._rip = 1; on(b, "pointerdown", ripple); } }); }
function sparkle(el, n, chars) {
  if (!animOn() || !el) return;
  var r = el.getBoundingClientRect(); n = n || 8; chars = chars || ["✨", "🌸", "💖", "⭐"];
  for (var i = 0; i < n; i++) {
    var s = document.createElement("div"); s.className = "spark"; s.textContent = chars[i % chars.length];
    var a = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 50;
    s.style.left = (r.left + r.width / 2 - 9) + "px"; s.style.top = (r.top + r.height / 2 - 9) + "px";
    s.style.setProperty("--dx", Math.cos(a) * dist + "px"); s.style.setProperty("--dy", Math.sin(a) * dist + "px"); s.style.setProperty("--r", (Math.random() * 120 - 60) + "deg");
    document.body.appendChild(s);
    (function (x) { setTimeout(function () { if (x.parentNode) x.parentNode.removeChild(x); }, 950); })(s);
  }
}
var toastT = null;
function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 1700); }

/* sakura petals */
(function petals() {
  var c = $("#sakura"), ctx = c.getContext && c.getContext("2d"); if (!ctx) return;
  var W = 0, H = 0, P = [], dpr = Math.min(2, window.devicePixelRatio || 1);
  function size() { W = window.innerWidth; H = window.innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size(); on(window, "resize", size);
  for (var i = 0; i < 16; i++) P.push(make(true));
  function make(init) { return { x: Math.random() * W, y: init ? Math.random() * H : -20, s: 6 + Math.random() * 8, vx: -0.3 + Math.random() * 0.8, vy: 0.4 + Math.random() * 0.8, r: Math.random() * 6.28, vr: -0.02 + Math.random() * 0.04, w: Math.random() * 6.28, o: 0.35 + Math.random() * 0.45 }; }
  function draw(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.cos(p.w)) * 0.6 + 0.4); ctx.globalAlpha = p.o;
    ctx.beginPath(); ctx.moveTo(0, -p.s / 2); ctx.bezierCurveTo(p.s * 0.6, -p.s * 0.6, p.s * 0.55, p.s * 0.35, 0, p.s / 2); ctx.bezierCurveTo(-p.s * 0.55, p.s * 0.35, -p.s * 0.6, -p.s * 0.6, 0, -p.s / 2);
    var g = ctx.createLinearGradient(0, -p.s / 2, 0, p.s / 2); g.addColorStop(0, "#ffd6ea"); g.addColorStop(1, "#ff8cc6"); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }
  function tick() {
    if (animOn() && !document.hidden) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < P.length; i++) { var p = P[i]; p.x += p.vx + Math.sin(p.w) * 0.4; p.y += p.vy; p.r += p.vr; p.w += 0.02; if (p.y > H + 20 || p.x < -30 || p.x > W + 30) P[i] = make(false); draw(P[i]); }
    } else ctx.clearRect(0, 0, W, H);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ---------------------------------------------------------------- segmented controls */
function setupSeg(el, value, onPick) {
  var btns = el.querySelectorAll("button"), thumb = el.querySelector(".seg-thumb");
  function paint(v) {
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], is = b.getAttribute("data-v") === v;
      b.classList.toggle("on", is);
      if (is && thumb) { thumb.style.width = b.offsetWidth + "px"; thumb.style.transform = "translateX(" + (b.offsetLeft - 3) + "px)"; }
    }
  }
  for (var i = 0; i < btns.length; i++) (function (b) { on(b, "click", function () { paint(b.getAttribute("data-v")); onPick(b.getAttribute("data-v")); vibrate(6); }); })(btns[i]);
  paint(value); setTimeout(function () { paint(value); }, 300); on(window, "resize", function () { paint(el.querySelector("button.on") ? el.querySelector("button.on").getAttribute("data-v") : value); });
  el._paint = paint;
}
setupSeg($("#tone"), S.tone, function (v) { S.tone = v; saveS(); if ($("#setTone")._paint) $("#setTone")._paint(v); if ($("#inp").value.trim()) translate(); renderList(); });

/* ---------------------------------------------------------------- network + dictionary */
function updNet() {
  var dict = E.ready();
  $("#netDot").classList.toggle("on", navigator.onLine);
  $("#netTxt").textContent = (navigator.onLine ? "online" : "offline") + " · " + (dict ? "offline engine ready ⚡" : "loading dictionary…");
}
on(window, "online", updNet); on(window, "offline", updNet); updNet();
function loadDict() {
  $("#mascotBtn").classList.add("loading");
  var fill = $("#ldFill"), txt = $("#ldTxt");
  function done(data) {
    E.load(data);
    $("#loader").classList.add("done"); $("#mascotBtn").classList.remove("loading");
    $("#dictInfo").textContent = data.e.length.toLocaleString() + " words · works fully offline ✓";
    updNet();
    if (pendingTranslate) { pendingTranslate = false; translate(); }
    if ($("#wq").value) renderWords();
  }
  fetch("data/dict.json?v=5").then(function (res) {
    var total = +res.headers.get("Content-Length") || 5800000;
    if (!res.body || !res.body.getReader || !window.TextDecoder) return res.json().then(done);
    var reader = res.body.getReader(), chunks = [], got = 0;
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          var all = new Uint8Array(got), off = 0;
          chunks.forEach(function (c) { all.set(c, off); off += c.length; });
          txt.textContent = "Unpacking…";
          setTimeout(function () { done(JSON.parse(new TextDecoder("utf-8").decode(all))); }, 20);
          return;
        }
        chunks.push(r.value); got += r.value.length;
        var pct = Math.min(99, Math.round(got / total * 100));
        fill.style.width = pct + "%"; txt.textContent = "Loading dictionary " + pct + "%";
        return pump();
      });
    }
    return pump();
  }).catch(function () {
    txt.textContent = "Dictionary not cached yet — connect once"; $("#mascotBtn").classList.remove("loading");
  });
}

/* ---------------------------------------------------------------- phrasebook data */
var ALL = [];
Object.keys(PHRASES).forEach(function (key) { PHRASES[key].items.forEach(function (p) { ALL.push({ cat: key, en: p[0], cas: p[1], ro: p[2], pol: p[3] || p[1] }); }); });
function jpOf(p) { return S.tone === "polite" ? p.pol : p.cas; }
function roOf(p) {
  if (S.tone !== "polite" || p.pol === p.cas) return p.ro;
  if (E.ready()) { var r = E.jaToEn(p.pol); if (r && r.ro) return r.ro; }
  return "";
}
function norm(t) { return String(t).toLowerCase().replace(/[?!.,。、？！~～\s'’]/g, ""); }
function phraseLookup(text) {
  var n = norm(text); if (!n) return null;
  var jp = E.isJP(text), best = null, score = 0;
  ALL.forEach(function (p) {
    var keys = jp ? [p.cas, p.pol] : [p.en, p.ro];
    keys.forEach(function (k) {
      k.split("/").forEach(function (part) {
        if (part.indexOf("___") >= 0) return;
        var kn = norm(part.replace(/\(.*?\)/g, "")); if (!kn) return;
        var s = kn === n ? 100 : (kn.length > 4 && (n.indexOf(kn) >= 0 || kn.indexOf(n) >= 0)) ? 60 * Math.min(kn.length, n.length) / Math.max(kn.length, n.length) : 0;
        if (s > score) { score = s; best = p; }
      });
    });
  });
  return score >= 50 ? best : null;
}

/* ---------------------------------------------------------------- online + casual helpers */
function fetchJSON(url, ms) {
  return new Promise(function (res, rej) {
    var done = false, t = setTimeout(function () { done = true; rej(new Error("timeout")); }, ms);
    fetch(url).then(function (r) { return r.json(); }).then(function (j) { if (!done) { clearTimeout(t); res(j); } }, function (e) { if (!done) { clearTimeout(t); rej(e); } });
  });
}
function online(text, sl, tl) {
  var u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sl + "&tl=" + tl + "&dt=t&dt=rm&q=" + encodeURIComponent(text);
  return fetchJSON(u, 6000).then(function (j) {
    var out = j[0].filter(function (x) { return x[0]; }).map(function (x) { return x[0]; }).join("");
    var rom = j[0].map(function (x) { return x[2] || x[3]; }).filter(Boolean).join(" ");
    return out ? { text: out, rom: rom } : null;
  }).catch(function () {
    return fetchJSON("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + sl + "|" + tl, 6000)
      .then(function (j) { return { text: j.responseData.translatedText, rom: "" }; }).catch(function () { return null; });
  });
}
function casualEN(s) {
  if (S.tone === "polite") return s;
  [[/\bI am\b/g, "I'm"], [/\bdo not\b/gi, "don't"], [/\bdoes not\b/gi, "doesn't"], [/\bcannot\b/gi, "can't"], [/\bis not\b/gi, "isn't"], [/\bare not\b/gi, "aren't"], [/\bwill not\b/gi, "won't"], [/\bI will\b/g, "I'll"], [/\byou are\b/gi, "you're"], [/\bit is\b/gi, "it's"], [/\bIt is\b/g, "It's"], [/\bthat is\b/gi, "that's"], [/\bwhat is\b/gi, "what's"], [/\bWhat is\b/g, "What's"], [/\bWhere is\b/g, "Where's"], [/\bgoing to\b/g, "gonna"], [/\bwant to\b/g, "wanna"], [/\bThank you very much\b/gi, "Thanks so much"], [/\bThank you\b/g, "Thanks"]].forEach(function (r) { s = s.replace(r[0], r[1]); });
  return s;
}
function casualJP(s) {
  if (S.tone === "polite") return s;
  [["ありがとうございました", "ありがとね"], ["ありがとうございます", "ありがと"], ["おはようございます", "おはよ"], ["ごめんなさい", "ごめん"], ["本当に", "マジで"], ["とても", "めっちゃ"], ["わかりません", "わかんない"], ["わかりました", "わかった"], ["ありますか？", "ある？"], ["ですか？", "？"], ["ませんでした", "なかった"], ["ません", "ない"], ["でした", "だった"], ["ましょう", "よう"], ["ください", "て"], ["です。", "。"], ["私は", S.me + "は"], ["あなた", "君"]].forEach(function (r) { s = s.split(r[0]).join(r[1]); });
  return s;
}

/* ---------------------------------------------------------------- translate */
var dir = "en-ja", last = null, reqId = 0, pendingTranslate = false;
function setDir(d, animate) {
  if (d === dir && !animate) return;
  dir = d;
  var a = d === "en-ja" ? ["🇬🇧", "English", "🇯🇵", "日本語"] : ["🇯🇵", "日本語", "🇬🇧", "English"];
  $("#fromL").innerHTML = '<span class="flag">' + a[0] + "</span><span>" + a[1] + "</span>";
  $("#toL").innerHTML = '<span class="flag">' + a[2] + "</span><span>" + a[3] + "</span>";
  var lb = $(".langbar"); lb.classList.remove("flip"); void lb.offsetWidth; lb.classList.add("flip");
}
on($("#swap"), "click", function () {
  var b = $("#swap"); b.classList.toggle("spin"); vibrate(8);
  setDir(dir === "en-ja" ? "ja-en" : "en-ja", true);
  if (last) { $("#inp").value = dir === "en-ja" ? last.en : last.jp; autosize(); translate(); }
});
function autosize() { var t = $("#inp"); t.style.height = "auto"; t.style.height = Math.min(240, t.scrollHeight) + "px"; }
on($("#inp"), "input", autosize);
on($("#inp"), "keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); translate(); } });
on($("#go"), "click", function () { translate(); $("#inp").blur(); });
on($("#clr"), "click", function () { $("#inp").value = ""; autosize(); showEmpty(); $("#inp").focus(); });
on($("#paste"), "click", function () {
  if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { $("#inp").value = t; autosize(); translate(); }).catch(function () { toast("Long-press the box to paste"); });
  else toast("Long-press the box to paste");
});
function showEmpty() {
  var r = $("#result"); r.className = "glass card result empty";
  r.innerHTML = '<div class="empty-state"><div class="mascot mini" data-mascot></div><p><b>Type anything</b> — sentences, slang, menus.<br>Works <b>offline</b> with my built-in dictionary ✨</p></div>';
  fillMascots();
}
function translate() {
  var text = $("#inp").value.trim();
  if (!text) return;
  var my = ++reqId, isJ = E.isJP(text);
  setDir(isJ ? "ja-en" : "en-ja");
  var go = $("#go"); go.classList.add("busy"); setTimeout(function () { go.classList.remove("busy"); }, 600);
  var hit = phraseLookup(text);
  if (hit) {
    var other = S.tone === "casual" ? hit.pol : hit.cas;
    show({ src: "phrase", jp: jpOf(hit), ro: roOf(hit), en: hit.en, alt: other !== jpOf(hit) ? { label: S.tone === "casual" ? "Polite" : "Casual", jp: other } : null, words: wordsFor(text, isJ) });
    say(pick([["フレーズ帳にあったよ！", "Found it in the phrasebook!"], ["これ使えるよ〜", "This one's handy!"]]));
    return;
  }
  var off = null;
  if (E.ready()) off = isJ ? E.jaToEn(text) : E.enToJa(text, S.tone);
  else pendingTranslate = true;
  if (off) {
    var res = isJ ? { src: "offline", jp: text, ro: off.ro, en: casualEN(off.en), words: off.words } : { src: "offline", jp: off.jp, ro: off.ro, en: text, words: wordsFor(text, false), unknown: off.unknown };
    show(res);
  } else {
    $("#result").className = "glass card result filled"; $("#result").innerHTML = '<div class="dots"><i></i><i></i><i></i></div>';
  }
  if (navigator.onLine && S.mode === "auto") {
    online(text, isJ ? "ja" : "en", isJ ? "en" : "ja").then(function (r) {
      if (my !== reqId || !r || !r.text) { if (!off && my === reqId) offlineFail(); return; }
      var offRes = last && last.src === "offline" ? last : null;
      var res2 = isJ ? { src: "online", jp: text, ro: (offRes && offRes.ro) || r.rom, en: casualEN(r.text), words: offRes ? offRes.words : [] }
                     : { src: "online", jp: casualJP(r.text), ro: r.rom ? r.rom.toLowerCase() : "", en: text, words: offRes ? offRes.words : wordsFor(text, false) };
      if (offRes) res2.alt = { label: "⚡ Offline engine", jp: isJ ? offRes.en : offRes.jp, ro: isJ ? "" : offRes.ro };
      show(res2, !!offRes);
    });
  } else if (!off && !E.ready()) {
    say("辞書を読み込み中…", "Loading my dictionary, one sec!");
  } else {
    say(pick([["オフラインでもバッチリ！", "Offline and still on it!"], ["できた！✨", "Done!"], ["どうぞ〜", "Here you go~"]]));
  }
}
function offlineFail() { $("#result").className = "glass card result"; $("#result").innerHTML = '<p class="empty-note">Couldn\'t translate that one. Try the Phrases tab or simpler words.</p>'; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function wordsFor(text, isJ) {
  if (!E.ready()) return [];
  if (isJ) { var r = E.jaToEn(text); return r ? r.words : []; }
  return E.enWords(text);
}
function show(r, quiet) {
  last = r;
  var box = $("#result"), isJ = dir === "ja-en";
  var main = isJ ? r.en : r.jp;
  var badge = r.src === "phrase" ? '<span class="badge phrase">📗 Phrasebook</span>' : r.src === "online" ? '<span class="badge online">🌐 Online</span>' : '<span class="badge offline">⚡ Offline</span>';
  var html = '<div class="res-head">' + badge + '<span class="mut small">' + (S.tone === "polite" ? "🙇 polite" : "😎 casual") + "</span></div>";
  html += '<div class="out-main' + (isJ ? " en" : "") + '" id="outMain">' + splitChars(main, quiet) + "</div>";
  if (r.ro) html += '<div class="out-ro">' + esc(r.ro) + "</div>";
  html += '<div class="out-src">' + esc(isJ ? r.jp : r.en) + "</div>";
  if (r.alt && r.alt.jp) html += '<div class="alt"><b>' + esc(r.alt.label) + "</b>" + esc(r.alt.jp) + (r.alt.ro ? '<div class="ro">' + esc(r.alt.ro) + "</div>" : "") + "</div>";
  if (r.unknown && r.unknown.length && r.src === "offline") html += '<div class="alt"><b>Guessed (not in dictionary)</b>' + esc(r.unknown.join(", ")) + " → written phonetically in katakana</div>";
  html += '<div class="actions">' +
    '<button class="act" data-a="say">🔊 Listen</button><button class="act" data-a="show">🖥 Show</button>' +
    '<button class="act" data-a="copy">📋 Copy</button><button class="act" data-a="fav">⭐ Save</button><button class="act" data-a="book">📒 Word book</button></div>';
  var ws = (r.words || []).filter(function (w) { return w.jp && w.en; });
  if (ws.length) {
    html += '<div class="chips-label">Word by word · tap to learn</div><div class="chips">' + ws.slice(0, 18).map(function (w, i) {
      return '<button class="chip' + (w.guess || w.unknown ? " guess" : "") + '" data-i="' + i + '" style="animation-delay:' + (animOn() ? 120 + i * 45 : 0) + 'ms"><b>' + esc(w.jp) + "</b>" + esc(w.en) + "</button>";
    }).join("") + "</div>";
  }
  box.className = "glass card result filled" + (quiet ? "" : " pop");
  box.innerHTML = html;
  $$("#result .act").forEach(function (b) { on(b, "pointerdown", ripple); on(b, "click", function () { act(b.getAttribute("data-a"), b); }); });
  $$("#result .chip").forEach(function (c) { on(c, "click", function () { openWord(ws[+c.getAttribute("data-i")]); }); });
  addHistory({ jp: r.jp, en: r.en, ro: r.ro || "" });
  renderRecent();
  if (!quiet) { var av = $("#mascotBtn"); av.classList.remove("happy"); void av.offsetWidth; av.classList.add("happy"); }
}
function splitChars(s, quiet) {
  if (!animOn() || quiet || s.length > 80) return esc(s);
  var out = "", chars = Array.from ? Array.from(s) : s.split("");
  for (var i = 0; i < chars.length; i++) out += '<span class="ch" style="animation-delay:' + (i * 28) + 'ms">' + esc(chars[i]) + "</span>";
  return out;
}
function act(a, btn) {
  if (!last) return;
  var isJ = dir === "ja-en";
  vibrate(8);
  if (a === "say") { if (isJ) speak(last.en, "en-US"); else speak(last.jp); }
  if (a === "show") showBig(last.jp, last.ro, last.en);
  if (a === "copy") { var t = isJ ? last.en : last.jp; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Copied 📋"); }, function () { toast("Copy failed"); }); btn.classList.add("done"); }
  if (a === "fav") { addFav({ jp: last.jp, en: last.en, ro: last.ro || "" }); btn.classList.add("done"); btn.textContent = "⭐ Saved"; sparkle(btn, 6, ["⭐", "✨"]); say("保存したよ！", "Saved it!"); }
  if (a === "book") { addMyWord({ jp: last.jp, en: last.en, ro: last.ro || "" }); btn.classList.add("done"); btn.textContent = "📒 Added"; sparkle(btn, 6, ["📒", "✨"]); }
}

/* ---------------------------------------------------------------- speech */
var voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) {} }
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text, lang) {
  lang = lang || "ja-JP";
  if (!("speechSynthesis" in window)) { toast("No voice on this device"); return; }
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(String(text).replace(/\s*\/\s*/g, "、").replace(/_+/g, "なになに")); u.lang = lang; u.rate = +S.rate || 0.9;
  var vs = voices.filter(function (v) { return v.lang.replace("_", "-").indexOf(lang.slice(0, 2)) === 0; });
  var pref = vs.filter(function (v) { return /Kyoko|O-ren|Nanami|Google 日本語|Haruka|Ayumi|Samantha|Google US/.test(v.name); });
  if (pref.length) u.voice = pref[0]; else if (vs.length) u.voice = vs[0];
  speechSynthesis.speak(u);
}
var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
on($("#mic"), "click", function () {
  if (!SR) { toast("Voice input isn't supported here"); return; }
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = dir === "en-ja" ? "en-US" : "ja-JP"; rec.interimResults = true;
  $("#mic").classList.add("rec"); vibrate(15);
  say(dir === "en-ja" ? "聞いてるよ…" : "聞いてるよ…", dir === "en-ja" ? "Listening (English)…" : "Listening (Japanese)…");
  rec.onresult = function (e) { var t = ""; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; $("#inp").value = t; autosize(); if (e.results[e.results.length - 1].isFinal) translate(); };
  rec.onend = function () { $("#mic").classList.remove("rec"); rec = null; };
  rec.onerror = function () { $("#mic").classList.remove("rec"); rec = null; };
  try { rec.start(); } catch (e) { $("#mic").classList.remove("rec"); rec = null; }
});

/* ---------------------------------------------------------------- show big */
function showBig(jp, ro, en) { $("#showBig").textContent = jp; $("#showRo").textContent = ro || ""; $("#showEn").textContent = en || ""; $("#show").classList.add("open"); }
on($("#showX"), "click", function () { $("#show").classList.remove("open"); });
on($("#showSay"), "click", function () { speak($("#showBig").textContent); });
on($("#show"), "click", function (e) { if (e.target === $("#show")) $("#show").classList.remove("open"); });

/* ---------------------------------------------------------------- sheets */
var openSheet = null;
function sheet(id) {
  if (openSheet) openSheet.classList.remove("open");
  openSheet = id ? $(id) : null;
  $("#backdrop").classList.toggle("open", !!openSheet);
  if (openSheet) openSheet.classList.add("open");
}
on($("#backdrop"), "click", function () { sheet(null); });
$$(".sheet").forEach(function (sh) {
  var y0 = null, dy = 0;
  on(sh, "touchstart", function (e) { if (sh.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  on(sh, "touchmove", function (e) { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transition = "none"; sh.style.transform = "translate(-50%," + dy + "px)"; }, { passive: true });
  on(sh, "touchend", function () { sh.style.transition = ""; sh.style.transform = ""; if (dy > 90) sheet(null); y0 = null; });
});
var wordCur = null;
function openWord(w) {
  if (!w) return;
  wordCur = { jp: w.base && w.base !== w.jp ? w.base : w.jp, en: w.en, ro: w.ro || (w.r ? E.romaji(w.r) : "") };
  $("#wsJp").textContent = wordCur.jp; $("#wsRo").textContent = wordCur.ro + (w.r && w.r !== wordCur.jp ? "  ·  " + w.r : ""); $("#wsEn").textContent = w.en;
  var add = $("#wsAdd"); add.textContent = "📒 Add"; add.classList.remove("done");
  sheet("#wordSheet"); speak(wordCur.jp);
}
on($("#wsSay"), "click", function () { if (wordCur) speak(wordCur.jp); });
on($("#wsShow"), "click", function () { if (wordCur) { sheet(null); showBig(wordCur.jp, wordCur.ro, wordCur.en); } });
on($("#wsAdd"), "click", function () { if (wordCur) { addMyWord(wordCur); $("#wsAdd").textContent = "✅ Added"; sparkle($("#wsAdd"), 6, ["📒", "✨"]); } });

/* settings */
on($("#settingsBtn"), "click", function () { sheet("#settings"); setTimeout(function () { $("#setTone")._paint(S.tone); $("#setMode")._paint(S.mode); }, 60); });
on($("#closeSettings"), "click", function () { sheet(null); });
setupSeg($("#setTone"), S.tone, function (v) { S.tone = v; saveS(); $("#tone")._paint(v); renderList(); });
setupSeg($("#setMode"), S.mode, function (v) { S.mode = v; saveS(); toast(v === "offline" ? "Offline engine only ⚡" : "Auto: offline + online 🌐"); });
function paintMe() { $$("#setMe button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === S.me); }); }
$$("#setMe button").forEach(function (b) { on(b, "click", function () { S.me = b.getAttribute("data-v"); saveS(); paintMe(); vibrate(6); }); });
paintMe();
$("#setRate").value = S.rate; $("#rateTxt").textContent = (+S.rate).toFixed(1) + "×";
on($("#setRate"), "input", function () { S.rate = +$("#setRate").value; saveS(); $("#rateTxt").textContent = S.rate.toFixed(1) + "×"; });
on($("#setRate"), "change", function () { speak("こんにちは！"); });
$("#setAnim").checked = !!S.anim; $("#setChat").checked = !!S.chat;
function applyAnim() { document.body.classList.toggle("calm", !animOn()); }
applyAnim();
on($("#setAnim"), "change", function () { S.anim = $("#setAnim").checked; saveS(); applyAnim(); });
on($("#setChat"), "change", function () { S.chat = $("#setChat").checked; saveS(); });
on($("#resetBtn"), "click", function () { if (confirm("Delete favourites, history, your words and flashcard progress?")) { ["fav", "hist", "mywords", "boxes"].forEach(function (k) { store.set(k, k === "boxes" ? {} : []); }); renderSaved(); renderRecent(); toast("Cleared 🧹"); } });

/* ---------------------------------------------------------------- storage helpers */
function addFav(r) { var f = store.get("fav", []).filter(function (x) { return x.jp !== r.jp; }); f.unshift(r); store.set("fav", f.slice(0, 300)); }
function addHistory(r) { var h = store.get("hist", []).filter(function (x) { return x.jp !== r.jp; }); h.unshift(r); store.set("hist", h.slice(0, 80)); }
function myWords() { return store.get("mywords", []); }
function addMyWord(w) { var m = myWords().filter(function (x) { return x.jp !== w.jp; }); m.unshift({ jp: w.jp, en: w.en, ro: w.ro || "" }); store.set("mywords", m); toast("Added to your word book 📒"); }

/* ---------------------------------------------------------------- list rows */
function row(o) { // {jp, ro, en, onFav, onDel, idx}
  var d = document.createElement("div"); d.className = "item";
  if (animOn()) d.style.animationDelay = Math.min(o.idx || 0, 14) * 35 + "ms"; else d.style.opacity = 1;
  d.innerHTML = '<div class="t"><div class="j">' + esc(o.jp) + (o.tag ? '<span class="tag">' + esc(o.tag) + "</span>" : "") + '</div>' + (o.ro ? '<div class="ro">' + esc(o.ro) + "</div>" : "") + '<div class="en">' + esc(o.en) + '</div></div><div class="side"><button class="ib" aria-label="Listen">🔊</button><button class="ib" aria-label="Show">🖥</button>' + (o.onFav ? '<button class="ib" aria-label="Save">☆</button>' : "") + (o.onDel ? '<button class="ib" aria-label="Remove">✕</button>' : "") + "</div>";
  var bs = d.querySelectorAll(".ib");
  on(d.querySelector(".t"), "click", function () { speak(o.jp); d.classList.remove("tap"); });
  on(bs[0], "click", function () { speak(o.jp); });
  on(bs[1], "click", function () { showBig(o.jp, o.ro, o.en); });
  if (o.onFav) on(bs[2], "click", function () { o.onFav(); bs[2].textContent = "⭐"; bs[2].classList.add("on"); sparkle(bs[2], 5, ["⭐", "✨"]); vibrate(10); });
  if (o.onDel) on(bs[bs.length - 1], "click", function () { o.onDel(); });
  return d;
}

/* ---------------------------------------------------------------- quick cats + phrases */
var CAT_COL = ["#ff5fa8", "#a855f7", "#22d3ee", "#ffcf4d", "#3ee6a0", "#ff8a5b", "#7c9cff", "#ff5fa8", "#c084fc", "#22d3ee", "#ff6b6b"];
var curCat = "basics";
function renderQuick() {
  var el = $("#quickCats"); el.innerHTML = "";
  Object.keys(PHRASES).forEach(function (k, i) {
    var c = PHRASES[k], b = document.createElement("button"); b.className = "qcat";
    b.style.setProperty("--c", "linear-gradient(145deg," + CAT_COL[i % CAT_COL.length] + ", transparent 90%)");
    if (animOn()) b.style.animationDelay = i * 50 + "ms"; else b.style.opacity = 1;
    b.innerHTML = '<span class="em">' + c.icon + "</span><span>" + esc(c.name) + "<small>" + c.items.length + " phrases</small></span>";
    on(b, "pointerdown", ripple);
    on(b, "click", function () { curCat = k; $("#q").value = ""; tab("ph"); drawCats(); renderList(); });
    el.appendChild(b);
  });
}
function drawCats() {
  var el = $("#cats"); el.innerHTML = "";
  Object.keys(PHRASES).forEach(function (k) {
    var b = document.createElement("button"); b.className = "cchip" + (k === curCat ? " on" : "");
    b.textContent = PHRASES[k].icon + " " + PHRASES[k].name;
    on(b, "click", function () { curCat = k; $("#q").value = ""; drawCats(); renderList(); vibrate(5); b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); });
    el.appendChild(b);
  });
}
function renderList() {
  var list = $("#list"); if (!list) return;
  var q = norm($("#q").value || "");
  var items = q ? ALL.filter(function (p) { return norm(p.en + p.cas + p.pol + p.ro).indexOf(q) >= 0; }) : ALL.filter(function (p) { return p.cat === curCat; });
  list.innerHTML = "";
  if (!items.length) { list.innerHTML = '<div class="empty-note">No phrases found — try the Translate tab 🌸</div>'; return; }
  items.forEach(function (p, i) {
    list.appendChild(row({ jp: jpOf(p), ro: roOf(p), en: p.en, idx: i, onFav: function () { addFav({ jp: jpOf(p), en: p.en, ro: roOf(p) }); toast("Saved ⭐"); } }));
  });
}
on($("#q"), "input", renderList);

/* ---------------------------------------------------------------- word book */
var VOCAB = [];
Object.keys(WORDS).forEach(function (cat) {
  WORDS[cat].split("\n").forEach(function (line) { var a = line.split("|"); if (a.length === 3) VOCAB.push({ cat: cat, en: a[0].trim(), jp: a[1].trim(), ro: a[2].trim() }); });
});
var MYCAT = "⭐ My words";
function allVocab() { return VOCAB.concat(myWords().map(function (w) { return { cat: MYCAT, en: w.en, jp: w.jp, ro: w.ro || "" }; })); }
var curWordCat = Object.keys(WORDS)[0];
function wordCats() { var o = Object.keys(WORDS); if (myWords().length) o = [MYCAT].concat(o); return o; }
function drawWordCats() {
  var el = $("#wcats"); el.innerHTML = "";
  wordCats().forEach(function (k) {
    var b = document.createElement("button"); b.className = "cchip" + (k === curWordCat ? " on" : ""); b.textContent = k;
    on(b, "click", function () { curWordCat = k; $("#wq").value = ""; drawWordCats(); renderWords(); stopCards(); updateRing(); vibrate(5); });
    el.appendChild(b);
  });
}
var wTimer = null;
on($("#wq"), "input", function () { clearTimeout(wTimer); wTimer = setTimeout(renderWords, 180); });
function renderWords() {
  if (wordCats().indexOf(curWordCat) < 0) curWordCat = Object.keys(WORDS)[0];
  var q = ($("#wq").value || "").trim(), el = $("#wlist"), box = store.get("boxes", {});
  el.innerHTML = "";
  var items;
  if (q) {
    var nq = norm(q);
    items = allVocab().filter(function (w) { return norm(w.en + w.jp + w.ro).indexOf(nq) >= 0; }).map(function (w) { return { jp: w.jp, ro: w.ro, en: w.en, mine: w.cat === MYCAT }; });
    if (E.ready()) {
      var seen = {}; items.forEach(function (w) { seen[w.jp] = 1; });
      E.search(q, 40).forEach(function (r) { if (!seen[r.jp]) { seen[r.jp] = 1; items.push({ jp: r.jp, ro: r.ro, en: r.en, dict: true, r: r.r }); } });
    }
  } else items = allVocab().filter(function (w) { return w.cat === curWordCat; }).map(function (w) { return { jp: w.jp, ro: w.ro, en: w.en, mine: w.cat === MYCAT }; });
  if (!items.length) { el.innerHTML = '<div class="empty-note">' + (E.ready() ? "No words found 🌸" : "Dictionary still loading…") + "</div>"; return; }
  items.slice(0, 120).forEach(function (w, i) {
    el.appendChild(row({ jp: w.jp, ro: w.ro + (w.r && w.r !== w.jp ? " · " + w.r : ""), en: w.en, idx: i, tag: (box[w.jp] || 0) >= 3 ? "learned" : "",
      onFav: w.mine ? null : function () { addMyWord({ jp: w.jp, en: w.en.split(",")[0], ro: w.ro }); },
      onDel: w.mine ? function () { store.set("mywords", myWords().filter(function (x) { return x.jp !== w.jp; })); drawWordCats(); renderWords(); } : null }));
  });
}

/* flashcards (Leitner boxes 0-4; lower box = shown more often) */
var card = null, streak = 0;
function pool() { var p = allVocab().filter(function (w) { return w.cat === curWordCat; }); return p.length ? p : allVocab(); }
function updateRing() {
  var p = pool(), box = store.get("boxes", {}), n = p.filter(function (w) { return (box[w.jp] || 0) >= 3; }).length;
  var pct = p.length ? Math.round(n / p.length * 100) : 0;
  $("#ringFg").style.strokeDashoffset = 97.4 * (1 - pct / 100); $("#ringTxt").textContent = pct + "%";
  $("#fcStat").textContent = curWordCat + " · learned " + n + "/" + p.length;
}
function nextCard() {
  var p = pool(), box = store.get("boxes", {}), weighted = [];
  p.forEach(function (w) { var b = box[w.jp] || 0; for (var i = 0; i < 5 - b; i++) weighted.push(w); });
  var c, guard = 0;
  do { c = weighted[Math.floor(Math.random() * weighted.length)]; guard++; } while (card && c && c.jp === card.jp && guard < 8);
  card = c; card.jpFirst = Math.random() < 0.5;
  var f = $("#flash"); f.classList.remove("flipped", "out-l", "out-r"); void f.offsetWidth; f.classList.add("in");
  setTimeout(function () { f.classList.remove("in"); }, 500);
  $("#fcFront").textContent = card.jpFirst ? card.jp : card.en;
  $("#fcHint").textContent = card.jpFirst ? "what does this mean?" : "how do you say this in Japanese?";
  $("#fcBack").textContent = card.jpFirst ? card.en : card.jp;
  $("#fcBackRo").textContent = card.jpFirst ? card.jp + " · " + card.ro : card.ro;
  updateRing();
}
function stopCards() { $(".practice").classList.remove("running"); card = null; $("#flash").classList.remove("flipped"); $("#fcFront").textContent = "Ready?"; $("#fcHint").textContent = "tap start, then tap the card to flip"; }
on($("#fcStart"), "click", function () { $(".practice").classList.add("running"); streak = 0; nextCard(); });
on($("#flash"), "click", function () { if (!card) return; var f = $("#flash"); var was = f.classList.contains("flipped"); f.classList.toggle("flipped"); if (!was) speak(card.jp); vibrate(6); });
function grade(ok) {
  if (!card) return;
  var box = store.get("boxes", {}), b = box[card.jp] || 0;
  box[card.jp] = ok ? Math.min(4, b + 1) : 0; store.set("boxes", box);
  var f = $("#flash"); f.classList.add(ok ? "out-r" : "out-l");
  if (ok) { streak++; if (streak % 3 === 0) { sparkle(f, 12); say(pick([["すごい！🔥", streak + " in a row!"], ["天才！", "Genius!"], ["その調子！", "Keep it up!"]])); } }
  else { streak = 0; if (Math.random() < 0.4) say("ドンマイ！", "No worries, again!"); }
  vibrate(ok ? 12 : 25);
  setTimeout(nextCard, 330);
}
on($("#fcYes"), "click", function () { grade(true); });
on($("#fcNo"), "click", function () { grade(false); });
(function swipe() {
  var f = $("#flash"), x0 = null, dx = 0;
  on(f, "touchstart", function (e) { if (!card || !f.classList.contains("flipped")) return; x0 = e.touches[0].clientX; dx = 0; }, { passive: true });
  on(f, "touchmove", function (e) { if (x0 === null) return; dx = e.touches[0].clientX - x0; $("#flashInner").style.transform = "rotateY(180deg) translateX(" + (-dx) + "px) rotate(" + (-dx / 20) + "deg)"; }, { passive: true });
  on(f, "touchend", function () { $("#flashInner").style.transform = ""; if (x0 !== null && Math.abs(dx) > 70) grade(dx > 0); x0 = null; });
})();

/* ---------------------------------------------------------------- saved */
function renderSaved() {
  function mk(key, el, emptyMsg) {
    var arr = store.get(key, []); el.innerHTML = "";
    if (!arr.length) { el.innerHTML = '<div class="empty-note">' + emptyMsg + "</div>"; return; }
    arr.forEach(function (r, i) { el.appendChild(row({ jp: r.jp, ro: r.ro, en: r.en, idx: i, onDel: function () { var a = store.get(key, []); a.splice(i, 1); store.set(key, a); renderSaved(); renderRecent(); } })); });
  }
  mk("fav", $("#saved"), "Tap ⭐ on anything to keep it here");
  mk("hist", $("#hist"), "Your translations will show up here");
}
function renderRecent() {
  var h = store.get("hist", []).slice(0, 3), el = $("#recent"); el.innerHTML = "";
  $("#recentTitle").style.display = h.length ? "" : "none";
  h.forEach(function (r, i) { var d = row({ jp: r.jp, ro: r.ro, en: r.en, idx: i }); on(d.querySelector(".t"), "click", function () { $("#inp").value = E.isJP(r.jp) && dir === "ja-en" ? r.jp : r.en; autosize(); translate(); window.scrollTo(0, 0); }); el.appendChild(d); });
}
on($("#clrH"), "click", function () { store.set("hist", []); renderSaved(); renderRecent(); });

/* ---------------------------------------------------------------- tabs */
var TABS = ["tr", "ph", "wd", "sv"], curTab = "tr";
function tab(t) {
  if (t === curTab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  curTab = t;
  TABS.forEach(function (s) { $("#page-" + s).classList.toggle("active", s === t); });
  $$("#tabbar button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === t); });
  $("#tabInd").style.transform = "translateX(" + (TABS.indexOf(t) * 100) + "%)";
  if (t === "sv") renderSaved();
  if (t === "wd") { drawWordCats(); renderWords(); updateRing(); }
  if (t === "ph") { drawCats(); renderList(); }
  window.scrollTo(0, 0); vibrate(5);
}
$$("#tabbar button").forEach(function (b) { on(b, "click", function () { tab(b.getAttribute("data-tab")); }); });
$$("[data-goto]").forEach(function (b) { on(b, "click", function () { tab(b.getAttribute("data-goto")); }); });

/* ---------------------------------------------------------------- boot */
renderQuick(); drawCats(); renderList(); renderRecent(); addRipples();
setTimeout(function () { say("やっほー！Hanaだよ🌸", "Hi! I'm Hana — type anything, I'll translate!"); }, 900);
loadDict();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
