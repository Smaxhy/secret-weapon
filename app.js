// Written in conservative JS (no ?., ??, catch-without-binding) so older phones run it.
(function () {
"use strict";
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
var store = {
  get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

var tone = store.get("tone", "casual");
var dir = "en-ja";
var last = null;
var curCat = "basics";
var curWordCat = Object.keys(WORDS)[0];

// ---------- data ----------
var ALL = [];
Object.keys(PHRASES).forEach(function (key) {
  PHRASES[key].items.forEach(function (p) { ALL.push({ cat: key, en: p[0], cas: p[1], ro: p[2], pol: p[3] || p[1] }); });
});
var VOCAB = [];
Object.keys(WORDS).forEach(function (cat) {
  WORDS[cat].split("\n").forEach(function (line) {
    var a = line.split("|"); if (a.length === 3) VOCAB.push({ cat: cat, en: a[0].trim(), jp: a[1].trim(), ro: a[2].trim() });
  });
});
function myWords() { return store.get("mywords", []); }
function allVocab() { return VOCAB.concat(myWords().map(function (w) { return { cat: "⭐ My words", en: w.en, jp: w.jp, ro: w.ro || "" }; })); }
var EN2JP = {};
VOCAB.forEach(function (w) { if (!EN2JP[w.en]) EN2JP[w.en] = w; });
var JPLIST = [];
VOCAB.forEach(function (w) { w.jp.split(" / ").forEach(function (j) { if (j.length) JPLIST.push({ j: j, w: w }); }); });
JPLIST.sort(function (a, b) { return b.j.length - a.j.length; });

function isJP(t) { return /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(t); }
function norm(t) { return String(t).toLowerCase().replace(/[?!.,。、？！~～\s'’]/g, ""); }
function jpOf(p) { return tone === "polite" ? p.pol : p.cas; }

// ---------- network pill ----------
function updNet() { var n = $("#net"); n.textContent = navigator.onLine ? "online" : "offline"; n.className = "pill" + (navigator.onLine ? " on" : ""); }
on(window, "online", updNet); on(window, "offline", updNet); updNet();

// ---------- tone ----------
function setTone(t) {
  tone = t; store.set("tone", t);
  $$(".toggle button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-t") === t); });
  renderList();
}
$$(".toggle button").forEach(function (b) {
  on(b, "click", function () { setTone(b.getAttribute("data-t")); if ($("#inp").value.trim()) translate(); });
});

// ---------- direction ----------
function setDir(d) {
  dir = d;
  $("#fromL").textContent = d === "en-ja" ? "English" : "日本語";
  $("#toL").textContent = d === "en-ja" ? "日本語" : "English";
}
on($("#swap"), "click", function () {
  setDir(dir === "en-ja" ? "ja-en" : "en-ja");
  if (last) { $("#inp").value = dir === "en-ja" ? last.en : last.jp; translate(true); }
});

// ---------- casual-izers ----------
function casualEN(s) {
  if (tone === "polite") return s;
  var rep = [[/\bI am\b/g, "I'm"], [/\bdo not\b/gi, "don't"], [/\bdoes not\b/gi, "doesn't"], [/\bcannot\b/gi, "can't"], [/\bis not\b/gi, "isn't"], [/\bare not\b/gi, "aren't"], [/\bwill not\b/gi, "won't"], [/\bI will\b/g, "I'll"], [/\byou are\b/gi, "you're"], [/\bit is\b/gi, "it's"], [/\bthat is\b/gi, "that's"], [/\bwhat is\b/gi, "what's"], [/\bgoing to\b/g, "gonna"], [/\bwant to\b/g, "wanna"], [/\bThank you very much\b/gi, "Thanks so much"], [/\bThank you\b/g, "Thanks"], [/\bvery\b/g, "really"]];
  rep.forEach(function (r) { s = s.replace(r[0], r[1]); });
  return s;
}
function casualJP(s) {
  if (tone === "polite") return s;
  var rep = [["ありがとうございました", "ありがとね"], ["ありがとうございます", "ありがと"], ["おはようございます", "おはよ"], ["ごめんなさい", "ごめん"], ["本当に", "マジで"], ["とても", "めっちゃ"], ["すごく", "めっちゃ"], ["わかりません", "わかんない"], ["わかりました", "わかった"], ["ありますか？", "ある？"], ["ですか？", "？"], ["ませんでした", "なかった"], ["ません", "ない"], ["でした", "だった"], ["ましょう", "よう"], ["ください", "て"], ["です。", "。"], ["私は", "俺は"], ["あなた", "君"]];
  rep.forEach(function (r) { s = s.split(r[0]).join(r[1]); });
  return s;
}

// ---------- offline engine ----------
function lookup(text) {
  var n = norm(text); if (!n) return null;
  var jp = isJP(text), best = null, score = 0;
  ALL.forEach(function (p) {
    var keys = jp ? [p.cas, p.pol] : [p.en, p.ro];
    keys.forEach(function (k) {
      k.split("/").forEach(function (part) {
        var kn = norm(part.replace(/\(.*?\)/g, "")); if (!kn) return;
        var s = 0;
        if (kn === n) s = 100;
        else if (kn.replace(/_+/g, "").length > 3 && (n.indexOf(kn) >= 0 || kn.indexOf(n) >= 0)) s = 60 * Math.min(kn.length, n.length) / Math.max(kn.length, n.length);
        if (s > score) { score = s; best = p; }
      });
    });
  });
  return score >= 45 ? best : null;
}
function enWords(text) {
  var t = " " + text.toLowerCase().replace(/[^a-z'\s-]/g, " ").replace(/\s+/g, " ") + " ";
  var out = [];
  var words = t.trim().split(" "), i = 0;
  while (i < words.length) {
    var hit = null, len = 0;
    for (var L = 3; L >= 1 && !hit; L--) {
      var ph = words.slice(i, i + L).join(" ");
      var w = EN2JP[ph] || EN2JP[ph.replace(/s$/, "")] || EN2JP[ph.replace(/ing$/, "")] || EN2JP[ph.replace(/ed$/, "")];
      if (w) { hit = w; len = L; }
    }
    if (hit) { out.push(hit); i += len; } else i++;
  }
  return out;
}
function jpWords(text) {
  var found = [], rest = text;
  JPLIST.forEach(function (x) { if (x.j.length > 1 && rest.indexOf(x.j) >= 0) { found.push(x.w); rest = rest.split(x.j).join("　"); } });
  return found;
}

// ---------- online engine ----------
function fetchJSON(url, ms) {
  return new Promise(function (res, rej) {
    var done = false, t = setTimeout(function () { done = true; rej(new Error("timeout")); }, ms);
    fetch(url).then(function (r) { return r.json(); }).then(function (j) { if (!done) { clearTimeout(t); res(j); } }, function (e) { if (!done) { clearTimeout(t); rej(e); } });
  });
}
function online(text, sl, tl) {
  var u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sl + "&tl=" + tl + "&dt=t&dt=rm&q=" + encodeURIComponent(text);
  return fetchJSON(u, 7000).then(function (j) {
    var out = j[0].filter(function (x) { return x[0]; }).map(function (x) { return x[0]; }).join("");
    var rom = j[0].map(function (x) { return x[2] || x[3]; }).filter(Boolean).join(" ");
    return { text: out, rom: rom };
  }).catch(function () {
    return fetchJSON("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + sl + "|" + tl, 7000)
      .then(function (j) { return { text: j.responseData.translatedText, rom: "" }; })
      .catch(function () { return null; });
  });
}

// ---------- translate ----------
function wordChips(list) {
  if (!list.length) return "";
  return '<div class="sub">Words:</div><div class="chips">' + list.slice(0, 15).map(function (w) {
    return '<span class="chip"><b>' + esc(w.jp) + "</b> " + esc(w.en) + "</span>";
  }).join("") + "</div>";
}
var reqId = 0;
function translate() {
  var my = ++reqId;
  var text = $("#inp").value.trim();
  if (!text) return;
  if (isJP(text)) setDir("ja-en"); else setDir("en-ja");
  var out = $("#out");
  var hit = lookup(text);
  if (hit) return show({ src: "phrasebook (offline)", jp: jpOf(hit), ro: hit.ro, en: hit.en, other: tone === "casual" ? hit.pol : hit.cas });
  var words = dir === "en-ja" ? enWords(text) : jpWords(text);
  out.innerHTML = '<span class="note">Translating…</span>';
  var go = navigator.onLine ? (dir === "en-ja" ? online(text, "en", "ja") : online(text, "ja", "en")) : Promise.resolve(null);
  go.then(function (r) {
    if (my !== reqId) return;
    if (r && r.text) {
      if (dir === "en-ja") return show({ src: "online", jp: casualJP(r.text), ro: r.rom, en: text, raw: r.text, words: words });
      return show({ src: "online", jp: text, ro: r.rom, en: casualEN(r.text), words: words });
    }
    if (words.length) {
      if (dir === "en-ja") return show({ src: "offline word-by-word", jp: words.map(function (w) { return w.jp.split(" / ")[0]; }).join(" "), ro: words.map(function (w) { return w.ro.split(" / ")[0]; }).join(" "), en: text, words: words, warn: "No internet: rough word-by-word. Full sentences need a connection." });
      return show({ src: "offline word-by-word", jp: text, ro: words.map(function (w) { return w.ro; }).join(" "), en: words.map(function (w) { return w.en; }).join(" · "), words: words, warn: "No internet: these are the words I recognise." });
    }
    out.innerHTML = '<span class="note">No offline match. Check the Phrases / Words tabs, or connect to the internet for full translation.</span>';
    $("#outBtns").style.display = "none";
  });
}
function show(r) {
  last = r;
  var main = dir === "en-ja"
    ? '<div class="jp">' + esc(r.jp) + "</div>" + (r.ro ? '<div class="ro">' + esc(r.ro) + "</div>" : "")
    : '<div class="jp" style="font-size:21px">' + esc(r.en) + "</div>" + (r.ro ? '<div class="ro">' + esc(r.ro) + "</div>" : "");
  var extra = "";
  if (r.other && r.other !== r.jp) extra += '<div class="sub">' + (tone === "casual" ? "Polite" : "Casual") + ": " + esc(r.other) + "</div>";
  if (r.raw && r.raw !== r.jp) extra += '<div class="sub">Polite version: ' + esc(r.raw) + "</div>";
  if (r.warn) extra += '<div class="sub">⚠️ ' + esc(r.warn) + "</div>";
  if (r.words && r.src === "online") extra += wordChips(r.words);
  $("#out").innerHTML = main + extra + '<div class="sub">via ' + esc(r.src) + "</div>";
  $("#outBtns").style.display = "flex";
  var h = store.get("hist", []).filter(function (x) { return x.jp !== r.jp; });
  h.unshift({ jp: r.jp, en: r.en, ro: r.ro || "" }); store.set("hist", h.slice(0, 60));
}
on($("#go"), "click", translate);
on($("#inp"), "keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); translate(); } });
on($("#clr"), "click", function () { $("#inp").value = ""; $("#out").innerHTML = ""; $("#outBtns").style.display = "none"; $("#inp").focus(); });

// ---------- speech ----------
function speak(text, lang) {
  lang = lang || "ja-JP";
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(String(text).replace(/\s*\/\s*/g, "、").replace(/_+/g, "")); u.lang = lang; u.rate = 0.9;
  var vs = speechSynthesis.getVoices().filter(function (v) { return v.lang.replace("_", "-").indexOf(lang.slice(0, 2)) === 0; });
  if (vs.length) u.voice = vs[0];
  speechSynthesis.speak(u);
}
on($("#say"), "click", function () { if (last) dir === "en-ja" ? speak(last.jp) : speak(last.en, "en-US"); });
on($("#copy"), "click", function () {
  if (!last) return; var t = dir === "en-ja" ? last.jp : last.en;
  if (navigator.clipboard) navigator.clipboard.writeText(t);
  $("#copy").textContent = "✅ Copied"; setTimeout(function () { $("#copy").textContent = "📋 Copy"; }, 1200);
});
on($("#fav"), "click", function () { if (last) { addFav(last); $("#fav").textContent = "✅ Saved"; setTimeout(function () { $("#fav").textContent = "⭐ Save"; }, 1200); } });
on($("#addWord"), "click", function () {
  if (!last) return;
  var m = myWords().filter(function (w) { return w.jp !== last.jp; });
  m.unshift({ jp: last.jp, en: last.en, ro: last.ro || "" }); store.set("mywords", m);
  $("#addWord").textContent = "✅ In word book"; setTimeout(function () { $("#addWord").textContent = "📒 Word book"; }, 1200);
});
on($("#showBtn"), "click", function () { if (last) showBig(last.jp, last.en); });

var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
on($("#mic"), "click", function () {
  if (!SR) { alert("Voice input isn't supported in this browser."); return; }
  var r = new SR(); r.lang = dir === "en-ja" ? "en-US" : "ja-JP"; r.interimResults = false;
  $("#mic").textContent = "⏺";
  r.onresult = function (e) { $("#inp").value = e.results[0][0].transcript; translate(); };
  r.onend = function () { $("#mic").textContent = "🎤"; };
  r.start();
});

function showBig(jp, en) { $("#showBig").textContent = jp; $("#showSmall").textContent = en; $("#show").className = "show-on"; }
function hideBig() { $("#show").className = ""; }
on($("#showX"), "click", hideBig);
on($("#show"), "click", hideBig);

// ---------- phrases ----------
function catButtons(el, obj, active, label, onPick) {
  el.innerHTML = "";
  Object.keys(obj).forEach(function (k) {
    var b = document.createElement("button");
    b.className = "cat" + (k === active ? " on" : "");
    b.innerHTML = label(k);
    on(b, "click", function () { onPick(k); });
    el.appendChild(b);
  });
}
function row(jp, ro, en, onFav) {
  var d = document.createElement("div"); d.className = "ph";
  d.innerHTML = '<div class="t"><div class="j">' + esc(jp) + '</div><div class="ro">' + esc(ro) + '</div><div class="en">' + esc(en) + "</div></div>" +
    '<button class="ic">🔊</button><button class="ic">🖥</button><button class="ic">' + (onFav ? "⭐" : "✕") + "</button>";
  var bs = d.querySelectorAll("button");
  on(d.querySelector(".t"), "click", function () { speak(jp); });
  on(bs[0], "click", function () { speak(jp); });
  on(bs[1], "click", function () { showBig(jp, en); });
  return { el: d, btn: bs[2] };
}
function phRow(p) {
  var r = row(jpOf(p), p.ro, p.en, true);
  on(r.btn, "click", function () { addFav({ jp: jpOf(p), en: p.en, ro: p.ro }); r.btn.textContent = "✅"; });
  return r.el;
}
function renderList() {
  var list = $("#list"); if (!list) return;
  var q = norm($("#q").value || "");
  var items = q ? ALL.filter(function (p) { return norm(p.en + p.cas + p.pol + p.ro).indexOf(q) >= 0; }) : ALL.filter(function (p) { return p.cat === curCat; });
  list.innerHTML = q ? "<b>" + items.length + " results</b>" : "<b>" + PHRASES[curCat].icon + " " + PHRASES[curCat].name + "</b>";
  items.forEach(function (p) { list.appendChild(phRow(p)); });
}
function pickCat(k) { curCat = k; $("#q").value = ""; drawCats(); renderList(); }
function drawCats() {
  catButtons($("#cats"), PHRASES, curCat, function (k) { return "<span>" + PHRASES[k].icon + "</span>" + PHRASES[k].name; }, pickCat);
  catButtons($("#quickCats"), PHRASES, null, function (k) { return "<span>" + PHRASES[k].icon + "</span>" + PHRASES[k].name; }, function (k) { tab("ph"); pickCat(k); });
}
on($("#q"), "input", renderList);

// ---------- word book ----------
function wordCats() { var o = {}; Object.keys(WORDS).forEach(function (k) { o[k] = 1; }); if (myWords().length) o["⭐ My words"] = 1; return o; }
function renderWords() {
  var cats = wordCats();
  if (!cats[curWordCat]) curWordCat = Object.keys(WORDS)[0];
  catButtons($("#wcats"), cats, curWordCat, function (k) { var i = k.indexOf(" "); return "<span>" + k.slice(0, i) + "</span>" + k.slice(i + 1); }, function (k) { curWordCat = k; $("#wq").value = ""; renderWords(); });
  var q = norm($("#wq").value || "");
  var items = q ? allVocab().filter(function (w) { return norm(w.en + w.jp + w.ro).indexOf(q) >= 0; }) : allVocab().filter(function (w) { return w.cat === curWordCat; });
  var box = store.get("boxes", {});
  var el = $("#wlist");
  el.innerHTML = "<b>" + (q ? items.length + " results" : esc(curWordCat) + " · " + items.length + " words") + "</b>";
  items.forEach(function (w) {
    var mine = w.cat === "⭐ My words";
    var r = row(w.jp, w.ro + (box[w.jp] >= 3 ? "  ✅ learned" : ""), w.en, !mine);
    on(r.btn, "click", function () {
      if (mine) { store.set("mywords", myWords().filter(function (x) { return x.jp !== w.jp; })); renderWords(); }
      else { addFav(w); r.btn.textContent = "✅"; }
    });
    el.appendChild(r.el);
  });
}
on($("#wq"), "input", renderWords);

// Flashcards: simple Leitner boxes (0-4). Lower box = shown more often.
var card = null, flipped = false;
function nextCard() {
  var pool = curWordCat ? allVocab().filter(function (w) { return w.cat === curWordCat; }) : allVocab();
  if (!pool.length) pool = allVocab();
  var box = store.get("boxes", {});
  var weighted = [];
  pool.forEach(function (w) { var b = box[w.jp] || 0; for (var i = 0; i < 5 - b; i++) weighted.push(w); });
  var c; do { c = weighted[Math.floor(Math.random() * weighted.length)]; } while (weighted.length > 1 && card && c.jp === card.jp && Math.random() < 0.9);
  card = c; flipped = false;
  var jpFirst = Math.random() < 0.5;
  $("#fcFront").textContent = jpFirst ? card.jp : card.en;
  $("#fcBack").innerHTML = jpFirst ? esc(card.en) + '<div class="ro">' + esc(card.ro) + "</div>" : esc(card.jp) + '<div class="ro">' + esc(card.ro) + "</div>";
  $("#fcBack").style.visibility = "hidden";
  $("#fcBtns").style.display = "none";
  $("#fcHint").style.display = "block";
  var learned = pool.filter(function (w) { return (box[w.jp] || 0) >= 3; }).length;
  $("#fcStat").textContent = esc(curWordCat) + " — learned " + learned + " / " + pool.length;
}
on($("#fc"), "click", function () {
  if (!card || flipped) return;
  flipped = true; $("#fcBack").style.visibility = "visible"; $("#fcBtns").style.display = "flex"; $("#fcHint").style.display = "none"; speak(card.jp);
});
function grade(ok) {
  var box = store.get("boxes", {}); var b = box[card.jp] || 0;
  box[card.jp] = ok ? Math.min(4, b + 1) : 0; store.set("boxes", box); nextCard();
}
on($("#fcYes"), "click", function () { grade(true); });
on($("#fcNo"), "click", function () { grade(false); });
on($("#fcStart"), "click", function () { $("#fcWrap").style.display = "block"; $("#fcStart").style.display = "none"; nextCard(); });

// ---------- saved / history ----------
function addFav(r) { var f = store.get("fav", []).filter(function (x) { return x.jp !== r.jp; }); f.unshift({ jp: r.jp, en: r.en, ro: r.ro || "" }); store.set("fav", f); }
function renderSaved() {
  function mk(key, el) {
    var arr = store.get(key, []);
    el.innerHTML = arr.length ? "" : '<div class="note" style="padding:8px 0">Nothing yet.</div>';
    arr.forEach(function (r, i) {
      var x = row(r.jp, r.ro, r.en, false);
      on(x.btn, "click", function () { var a = store.get(key, []); a.splice(i, 1); store.set(key, a); renderSaved(); });
      el.appendChild(x.el);
    });
  }
  mk("fav", $("#saved")); mk("hist", $("#hist"));
}
on($("#clrH"), "click", function () { store.set("hist", []); renderSaved(); });

// ---------- tabs ----------
function tab(t) {
  ["tr", "ph", "wd", "sv"].forEach(function (s) { $("#tab-" + s).style.display = s === t ? "block" : "none"; });
  $$("nav button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === t); });
  if (t === "sv") renderSaved();
  if (t === "wd") renderWords();
  window.scrollTo(0, 0);
}
$$("nav button").forEach(function (b) { on(b, "click", function () { tab(b.getAttribute("data-tab")); }); });

drawCats();
setTone(tone);
tab("tr");
$("#count").textContent = ALL.length + " phrases · " + VOCAB.length + " words offline";
})();
