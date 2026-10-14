(() => {
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let tone = store.get("tone", "casual");
let dir = "en-ja"; // or ja-en
let last = null;   // {src, jp, ro, en}
let curCat = "basics";

const ALL = [];
for (const [key, c] of Object.entries(PHRASES))
  for (const p of c.items) ALL.push({ cat: key, en: p[0], cas: p[1], ro: p[2], pol: p[3] || p[1] });

const isJP = t => /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(t);
const norm = t => t.toLowerCase().replace(/[?!.,。、？！~～\s]/g, "");
const jpOf = p => tone === "polite" ? p.pol : p.cas;

// ---------- network ----------
const net = $("#net");
const updNet = () => { net.textContent = navigator.onLine ? "online" : "offline"; net.classList.toggle("on", navigator.onLine); };
addEventListener("online", updNet); addEventListener("offline", updNet); updNet();

// ---------- tone ----------
function setTone(t) {
  tone = t; store.set("tone", t);
  document.querySelectorAll(".toggle button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  renderList();
}
document.querySelectorAll(".toggle button").forEach(b => b.onclick = () => { setTone(b.dataset.t); if ($("#inp").value.trim()) translate(); });
setTone(tone);

// ---------- direction ----------
function setDir(d) {
  dir = d;
  $("#fromL").textContent = d === "en-ja" ? "English" : "日本語";
  $("#toL").textContent = d === "en-ja" ? "日本語" : "English";
}
$("#swap").onclick = () => {
  setDir(dir === "en-ja" ? "ja-en" : "en-ja");
  if (last) { $("#inp").value = dir === "en-ja" ? last.en : last.jp; translate(); }
};

// ---------- casual-izers ----------
function casualEN(s) {
  if (tone === "polite") return s;
  const rep = [[/\bI am\b/g,"I'm"],[/\bdo not\b/gi,"don't"],[/\bdoes not\b/gi,"doesn't"],[/\bcannot\b/gi,"can't"],[/\bis not\b/gi,"isn't"],[/\bare not\b/gi,"aren't"],[/\bwill not\b/gi,"won't"],[/\bI will\b/g,"I'll"],[/\byou are\b/gi,"you're"],[/\bit is\b/gi,"it's"],[/\bthat is\b/gi,"that's"],[/\bwhat is\b/gi,"what's"],[/\bgoing to\b/g,"gonna"],[/\bwant to\b/g,"wanna"],[/\bThank you very much\b/gi,"Thanks so much"],[/\bThank you\b/g,"Thanks"],[/\bExcuse me\b/g,"Hey, sorry"],[/\bvery\b/g,"really"]];
  for (const [a,b] of rep) s = s.replace(a,b);
  return s;
}
function casualJP(s) {
  if (tone === "polite") return s;
  const rep = [["ありがとうございます","ありがと"],["ありがとうございました","ありがとね"],["おはようございます","おはよ"],["ごめんなさい","ごめん"],["本当に","マジで"],["とても","めっちゃ"],["すごく","めっちゃ"],["わかりません","わかんない"],["わかりました","わかった"],["ありますか？","ある？"],["ありますか","ある？"],["ですか？","？"],["ですか","？"],["ません","ない"],["でした","だった"],["ましょう","よう"],["ください","て"],["です。","。"],["です","だよ"],["私は","俺は"],["あなた","君"]];
  for (const [a,b] of rep) s = s.split(a).join(b);
  return s;
}

// ---------- offline engine ----------
function lookup(text) {
  const n = norm(text);
  if (!n) return null;
  const jp = isJP(text);
  let best = null, score = 0;
  for (const p of ALL) {
    const keys = jp ? [p.cas, p.pol] : [p.en, p.ro];
    for (const k of keys) for (const part of k.split("/")) {
      const kn = norm(part.replace(/\(.*?\)/g, ""));
      if (!kn) continue;
      let s = 0;
      if (kn === n) s = 100;
      else if (kn.replace(/_+/g,"").length > 2 && (n.includes(kn) || kn.includes(n))) s = 60 * Math.min(kn.length, n.length) / Math.max(kn.length, n.length);
      if (s > score) { score = s; best = p; }
    }
  }
  return score >= 45 ? best : null;
}
function wordByWord(text) {
  const words = text.toLowerCase().replace(/[^a-z'\s]/g, " ").split(/\s+/).filter(Boolean);
  const jp = [], ro = [];
  for (const w of words) { const d = DICT[w] || DICT[w.replace(/s$/,"")]; if (d) { jp.push(d[0]); ro.push(d[1]); } }
  return jp.length ? { jp: jp.join(" "), ro: ro.join(" ") } : null;
}
function jpWordsToEN(text) {
  const hits = [];
  for (const [en, [j]] of Object.entries(DICT)) for (const v of j.split("/")) if (v.length > 1 && text.includes(v)) hits.push(`${v} = ${en}`);
  return [...new Set(hits)].slice(0, 12);
}

// ---------- online engine ----------
async function online(text, sl, tl) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 7000);
  try {
    const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
    const r = await fetch(u, { signal: ctrl.signal }); const j = await r.json();
    const out = j[0].filter(x => x[0]).map(x => x[0]).join("");
    const rom = j[0].map(x => x[2] || x[3]).filter(Boolean).join(" ");
    return { text: out, rom };
  } catch {
    try {
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`, { signal: ctrl.signal });
      const j = await r.json(); return { text: j.responseData.translatedText, rom: "" };
    } catch { return null; }
  } finally { clearTimeout(to); }
}

// ---------- translate ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
async function translate() {
  const text = $("#inp").value.trim();
  if (!text) return;
  if (isJP(text) && dir === "en-ja") setDir("ja-en");
  else if (!isJP(text) && dir === "ja-en") setDir("en-ja");
  const out = $("#out");
  const hit = lookup(text);
  if (hit) return show({ src: "phrasebook", jp: jpOf(hit), ro: hit.ro, en: hit.en, other: tone === "casual" ? hit.pol : hit.cas });
  out.innerHTML = `<span class="note">Translating…</span>`;
  if (navigator.onLine) {
    const r = dir === "en-ja" ? await online(text, "en", "ja") : await online(text, "ja", "en");
    if (r) {
      if (dir === "en-ja") { const romR = r.rom; return show({ src: "online", jp: casualJP(r.text), ro: romR, en: text, raw: r.text }); }
      return show({ src: "online", jp: text, ro: r.rom, en: casualEN(r.text) });
    }
  }
  if (dir === "en-ja") {
    const w = wordByWord(text);
    if (w) return show({ src: "offline words", jp: w.jp, ro: w.ro, en: text, warn: "Offline word-by-word — rough. Connect for full sentences." });
  } else {
    const h = jpWordsToEN(text);
    if (h.length) { out.innerHTML = `<div class="sub">Offline — words found:</div><div>${h.map(esc).join("<br>")}</div>`; return; }
  }
  out.innerHTML = `<span class="note">No offline match. Try the Phrases tab, or connect to the internet for full translation.</span>`;
  $("#outBtns").style.display = "none";
}
function show(r) {
  last = r;
  const main = dir === "en-ja"
    ? `<div class="jp">${esc(r.jp)}</div>${r.ro ? `<div class="ro">${esc(r.ro)}</div>` : ""}`
    : `<div class="jp" style="font-size:21px">${esc(r.en)}</div>${r.ro ? `<div class="ro">${esc(r.ro)}</div>` : ""}`;
  let extra = "";
  if (r.other && r.other !== r.jp) extra += `<div class="sub">${tone === "casual" ? "Polite" : "Casual"}: ${esc(r.other)}</div>`;
  if (r.raw && r.raw !== r.jp) extra += `<div class="sub">Original MT: ${esc(r.raw)}</div>`;
  if (r.warn) extra += `<div class="sub">⚠️ ${esc(r.warn)}</div>`;
  $("#out").innerHTML = main + extra + `<div class="sub">via ${r.src}</div>`;
  $("#outBtns").style.display = "flex";
  const h = store.get("hist", []).filter(x => x.jp !== r.jp);
  h.unshift({ jp: r.jp, en: r.en, ro: r.ro || "" }); store.set("hist", h.slice(0, 50));
}
$("#go").onclick = translate;
$("#inp").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); translate(); } });
$("#clr").onclick = () => { $("#inp").value = ""; $("#out").innerHTML = ""; $("#outBtns").style.display = "none"; $("#inp").focus(); };

// ---------- speech ----------
function speak(text, lang = "ja-JP") {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, "、")); u.lang = lang; u.rate = .9;
  const v = speechSynthesis.getVoices().find(v => v.lang.replace("_","-").startsWith(lang.slice(0,2)));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
$("#say").onclick = () => last && (dir === "en-ja" ? speak(last.jp) : speak(last.en, "en-US"));
$("#copy").onclick = () => last && navigator.clipboard?.writeText(dir === "en-ja" ? last.jp : last.en);
$("#fav").onclick = () => last && addFav(last);
$("#showBtn").onclick = () => last && showBig(last.jp, last.en);

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$("#mic").onclick = () => {
  if (!SR) return alert("Voice input isn't supported in this browser.");
  const r = new SR(); r.lang = dir === "en-ja" ? "en-US" : "ja-JP"; r.interimResults = false;
  $("#mic").textContent = "⏺";
  r.onresult = e => { $("#inp").value = e.results[0][0].transcript; translate(); };
  r.onend = () => $("#mic").textContent = "🎤";
  r.start();
};

function showBig(jp, en) { $("#showBig").textContent = jp; $("#showSmall").textContent = en; $("#show").classList.remove("hide"); }
$("#showX").onclick = () => $("#show").classList.add("hide");

// ---------- phrases ----------
function catButtons(el, onPick) {
  el.innerHTML = "";
  for (const [k, c] of Object.entries(PHRASES)) {
    const b = document.createElement("button"); b.className = "cat" + (el.id === "cats" && k === curCat ? " on" : "");
    b.innerHTML = `<span>${c.icon}</span>${c.name}`; b.onclick = () => onPick(k); el.appendChild(b);
  }
}
const phRow = p => {
  const d = document.createElement("div"); d.className = "ph";
  d.innerHTML = `<div class="t"><div class="j">${esc(jpOf(p))}</div><div class="ro">${esc(p.ro)}</div><div class="en">${esc(p.en)}</div></div>
    <button class="ic" data-a="s">🔊</button><button class="ic" data-a="b">🖥</button><button class="ic" data-a="f">⭐</button>`;
  d.querySelector(".t").onclick = () => speak(jpOf(p));
  d.querySelector('[data-a="s"]').onclick = () => speak(jpOf(p));
  d.querySelector('[data-a="b"]').onclick = () => showBig(jpOf(p), p.en);
  d.querySelector('[data-a="f"]').onclick = e => { addFav({ jp: jpOf(p), en: p.en, ro: p.ro }); e.target.textContent = "✅"; };
  return d;
};
function renderList() {
  const list = $("#list"); if (!list) return;
  const q = norm($("#q").value || "");
  const items = q ? ALL.filter(p => norm(p.en + p.cas + p.pol + p.ro).includes(q)) : ALL.filter(p => p.cat === curCat);
  list.innerHTML = q ? `<b>${items.length} results</b>` : `<b>${PHRASES[curCat].icon} ${PHRASES[curCat].name}</b>`;
  items.forEach(p => list.appendChild(phRow(p)));
}
const pickCat = k => { curCat = k; $("#q").value = ""; catButtons($("#cats"), pickCat); renderList(); };
catButtons($("#cats"), pickCat);
catButtons($("#quickCats"), k => { tab("ph"); pickCat(k); });
$("#q").oninput = renderList;
renderList();

// ---------- saved / history ----------
function addFav(r) { const f = store.get("fav", []).filter(x => x.jp !== r.jp); f.unshift({ jp: r.jp, en: r.en, ro: r.ro || "" }); store.set("fav", f); renderSaved(); }
function renderSaved() {
  const mk = (arr, el, key) => {
    el.innerHTML = arr.length ? "" : `<div class="note" style="padding:8px 0">Nothing yet.</div>`;
    arr.forEach((r, i) => {
      const d = document.createElement("div"); d.className = "ph";
      d.innerHTML = `<div class="t"><div class="j">${esc(r.jp)}</div><div class="ro">${esc(r.ro)}</div><div class="en">${esc(r.en)}</div></div><button class="ic">🔊</button><button class="ic">🖥</button><button class="ic">✕</button>`;
      const [s, b, x] = d.querySelectorAll("button");
      s.onclick = () => speak(r.jp); b.onclick = () => showBig(r.jp, r.en);
      x.onclick = () => { const a = store.get(key, []); a.splice(i, 1); store.set(key, a); renderSaved(); };
      el.appendChild(d);
    });
  };
  mk(store.get("fav", []), $("#saved"), "fav");
  mk(store.get("hist", []), $("#hist"), "hist");
}
$("#clrH").onclick = () => { store.set("hist", []); renderSaved(); };

// ---------- tabs ----------
function tab(t) {
  for (const s of ["tr", "ph", "sv"]) $("#tab-" + s).classList.toggle("hide", s !== t);
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  if (t === "sv") renderSaved();
  scrollTo(0, 0);
}
document.querySelectorAll("nav button").forEach(b => b.onclick = () => tab(b.dataset.tab));

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
