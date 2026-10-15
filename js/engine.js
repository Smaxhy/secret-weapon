/* Hana offline translation engine — rule-based EN⇄JP, no AI, no network.
 * Uses data/dict.json (JMdict, CC BY-SA 4.0, EDRDG) + hand-picked overrides.
 * Written in conservative JS so older phones can run it. Works in browser and Node. */
(function (root) {
"use strict";

var E = {};
var D = null, JPMAP = null, CACHE = {}, CORE = {};
E.opts = { tone: "casual", me: "俺" };
E.load = function (data) {
  D = data; CACHE = {}; JPMAP = Object.create(null); CORE = {};
  (D.core || []).forEach(function (k) { CORE[k] = 1; });
  for (var i = 0; i < D.e.length; i++) {
    var row = D.e[i], forms = row[0].split(",");
    forms.push(row[1].replace(/\|/g, ""));
    for (var j = 0; j < forms.length; j++) {
      var f = forms[j]; if (!f) continue;
      var l = JPMAP[f] || (JPMAP[f] = []);
      if (l.indexOf(i) < 0) l.push(i);
    }
  }
};
E.ready = function () { return !!D; };
E.size = function () { return D ? D.e.length : 0; };

function ent(i) {
  if (CACHE[i]) return CACHE[i];
  var row = D.e[i], forms = row[0].split(",");
  var c = { i: i, w: forms[0], alts: forms.slice(1), r: row[1], p: row[2] ? row[2].split(",") : [], g: row[3] };
  CACHE[i] = c; return c;
}
function has(arr, x) { return arr.indexOf(x) >= 0; }
function vclass(e) {
  for (var k = 0; k < e.p.length; k++) {
    var p = e.p[k];
    if (p === "v1" || p === "vk") return p;
    if (p.indexOf("v5") === 0) return p;
    if (p === "vs-i" || p === "vs-s") return "vs";
  }
  return null;
}
function aclass(e) {
  var order = ["adj-ix", "adj-i", "adj-na", "adj-no", "adj-pn"];
  for (var k = 0; k < order.length; k++) if (has(e.p, order[k])) return order[k];
  return null;
}
function isNounish(e) { return !vclass(e) && !has(e.p, "st") && !has(e.p, "prt"); }
function firstGloss(e) {
  var g = e.g.split("|")[0].split(";")[0];
  return g.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ kana / romaji */
function toHira(s) { return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }); }
function toKata(s) { return s.replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }); }
var R2 = { "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo", "しゃ": "sha", "しゅ": "shu", "しょ": "sho", "しぇ": "she", "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho", "ちぇ": "che",
  "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo", "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo", "みゃ": "mya", "みゅ": "myu", "みょ": "myo", "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
  "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo", "じゃ": "ja", "じゅ": "ju", "じょ": "jo", "じぇ": "je", "びゃ": "bya", "びゅ": "byu", "びょ": "byo", "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
  "てぃ": "ti", "でぃ": "di", "とぅ": "tu", "どぅ": "du", "でゅ": "dyu", "てゅ": "tyu", "ふぁ": "fa", "ふぃ": "fi", "ふぇ": "fe", "ふぉ": "fo", "ふゅ": "fyu",
  "うぃ": "wi", "うぇ": "we", "うぉ": "wo", "ゔぁ": "va", "ゔぃ": "vi", "ゔぇ": "ve", "ゔぉ": "vo", "つぁ": "tsa", "つぃ": "tsi", "つぇ": "tse", "つぉ": "tso", "いぇ": "ye", "くぁ": "kwa" };
var R1 = { "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o", "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko", "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
  "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to", "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no", "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
  "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo", "や": "ya", "ゆ": "yu", "よ": "yo", "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro", "わ": "wa", "ゐ": "i", "ゑ": "e", "を": "o", "ん": "n",
  "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go", "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo", "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
  "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo", "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po", "ゔ": "vu",
  "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o", "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゎ": "wa", "ゕ": "ka", "ゖ": "ke" };
function romaji(kana) {
  var s = toHira(kana), out = "", i = 0;
  while (i < s.length) {
    var two = s.substr(i, 2), c = s[i], r;
    if (c === "っ") {
      var nx = R2[s.substr(i + 1, 2)] || R1[s[i + 1]] || "";
      out += nx ? (nx.indexOf("ch") === 0 ? "t" : nx[0]) : "";
      i++; continue;
    }
    if (c === "ー") { var m = out.match(/[aeiou]$/); out += m ? m[0] : ""; i++; continue; }
    if (R2[two]) { r = R2[two]; i += 2; }
    else if (c === "を") { r = " o "; i++; }
    else if (c === "|") { r = " "; i++; }
    else if (R1[c]) { r = R1[c]; i++; if (c === "ん" && /^[aeiouy]/.test(R1[s[i]] || "") && s[i] !== "を") r = "n'"; }
    else { r = c; i++; }
    out += r;
  }
  return out.replace(/\s+/g, " ").trim();
}
E.romaji = romaji;

/* ------------------------------------------------------------------ English -> katakana (unknown words) */
var KROW = { "": ["ア", "イ", "ウ", "エ", "オ"], k: ["カ", "キ", "ク", "ケ", "コ"], g: ["ガ", "ギ", "グ", "ゲ", "ゴ"], s: ["サ", "シ", "ス", "セ", "ソ"], z: ["ザ", "ジ", "ズ", "ゼ", "ゾ"],
  t: ["タ", "ティ", "トゥ", "テ", "ト"], d: ["ダ", "ディ", "ドゥ", "デ", "ド"], n: ["ナ", "ニ", "ヌ", "ネ", "ノ"], h: ["ハ", "ヒ", "フ", "ヘ", "ホ"], f: ["ファ", "フィ", "フ", "フェ", "フォ"],
  b: ["バ", "ビ", "ブ", "ベ", "ボ"], v: ["バ", "ビ", "ブ", "ベ", "ボ"], p: ["パ", "ピ", "プ", "ペ", "ポ"], m: ["マ", "ミ", "ム", "メ", "モ"], y: ["ヤ", "イ", "ユ", "イェ", "ヨ"],
  r: ["ラ", "リ", "ル", "レ", "ロ"], l: ["ラ", "リ", "ル", "レ", "ロ"], w: ["ワ", "ウィ", "ウ", "ウェ", "ウォ"], j: ["ジャ", "ジ", "ジュ", "ジェ", "ジョ"],
  sh: ["シャ", "シ", "シュ", "シェ", "ショ"], ch: ["チャ", "チ", "チュ", "チェ", "チョ"], ts: ["ツァ", "ツィ", "ツ", "ツェ", "ツォ"] };
var LONE = { k: "ク", g: "グ", s: "ス", z: "ズ", t: "ト", d: "ド", h: "", f: "フ", b: "ブ", v: "ブ", p: "プ", m: "ム", y: "イ", r: "ー", l: "ル", w: "ウ", j: "ジ", sh: "シュ", ch: "チ", ts: "ツ", n: "ン" };
function katakana(word) {
  var w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return word;
  var rules = [[/tion/g, "shon"], [/sion/g, "jon"], [/ture/g, "chaa"], [/ph/g, "f"], [/ck/g, "kk"], [/qu/g, "kw"], [/x/g, "kus"], [/wh/g, "w"], [/th/g, "s"],
    [/ee|ea/g, "ii"], [/oo/g, "uu"], [/ou/g, "au"], [/ow$/g, "ou"], [/oa/g, "oo"], [/ai|ay/g, "ei"], [/ey$/g, "ii"], [/([^aeiou])y$/g, "$1ii"], [/(er|or|ar|ir|ur)$/g, "aa"],
    [/(ar|ir|ur|er)(?=[^aeiou])/g, "aa"], [/or(?=[^aeiou])/g, "oo"], [/le$/g, "ru"], [/ce$/g, "su"], [/ge$/g, "ji"], [/([^aeiou])e$/g, "$1"], [/c(?=[eiy])/g, "s"], [/c/g, "k"],
    [/dg/g, "j"], [/g(?=[ei])/g, "j"], [/y(?![aeiou])/g, "i"], [/a(?=[^aeiou][aeiou])/g, "ei"]];
  for (var i = 0; i < rules.length; i++) w = w.replace(rules[i][0], rules[i][1]);
  var V = "aiueo", out = "", p = 0, prevV = "";
  while (p < w.length) {
    var ch = w[p];
    if (V.indexOf(ch) >= 0) {
      if (ch === prevV) { out += "ー"; p++; continue; }
      out += KROW[""][V.indexOf(ch)]; prevV = ch; p++; continue;
    }
    var cons = w.substr(p, 2) === "sh" || w.substr(p, 2) === "ch" || w.substr(p, 2) === "ts" ? w.substr(p, 2) : ch;
    var after = w[p + cons.length];
    if (cons.length === 1 && after === ch && ch !== "n") { out += "ッ"; p++; continue; }
    if (after && V.indexOf(after) >= 0 && KROW[cons]) {
      out += KROW[cons][V.indexOf(after)]; prevV = after; p += cons.length + 1;
      if (cons === "t" && after === "u") out = out.slice(0, -2) + "トゥ";
      continue;
    }
    if (cons === "n") { out += "ン"; p++; prevV = ""; continue; }
    if (cons === "r" && !prevV) { out += "ル"; p++; continue; }
    out += LONE[cons] !== undefined ? LONE[cons] : ""; prevV = ""; p += cons.length;
  }
  return out.replace(/ーー+/g, "ー");
}
E.katakana = katakana;

/* ------------------------------------------------------------------ Japanese conjugation */
var GODAN = { "う": ["わ", "い", "え", "お", "って", "った"], "く": ["か", "き", "け", "こ", "いて", "いた"], "ぐ": ["が", "ぎ", "げ", "ご", "いで", "いだ"],
  "す": ["さ", "し", "せ", "そ", "して", "した"], "つ": ["た", "ち", "て", "と", "って", "った"], "ぬ": ["な", "に", "ね", "の", "んで", "んだ"],
  "ぶ": ["ば", "び", "べ", "ぼ", "んで", "んだ"], "む": ["ま", "み", "め", "も", "んで", "んだ"], "る": ["ら", "り", "れ", "ろ", "って", "った"] };
function cut(s, n) { return s.slice(0, s.length - n); }
function W(w, r, c, extra) { var o = { w: w, r: r, c: c }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
function map2(x, f) { return { w: f(x.w), r: f(x.r) }; }
function add(x, w, r) { return { w: x.w + w, r: x.r + (r === undefined ? w : r) }; }
// row: 0=a 1=i 2=e 3=o 4=te 5=ta
function vstem(x, row) {
  var c = x.c;
  if (c === "v1") return map2(x, function (s) { return cut(s, 1) + ["", "", "れ", "よ", "て", "た"][row]; });
  if (c === "vk") return { w: /来る$/.test(x.w) ? cut(x.w, 1) + ["", "", "れ", "よ", "て", "た"][row] : cut(x.w, 2) + ["こ", "き", "くれ", "こよ", "きて", "きた"][row],
    r: cut(x.r, 2) + ["こ", "き", "くれ", "こよ", "きて", "きた"][row] };
  if (c === "vs") return map2(x, function (s) { return cut(s, 2) + ["し", "し", "すれ", "しよ", "して", "した"][row]; });
  return map2(x, function (s) {
    var last = s[s.length - 1], g = GODAN[last];
    if (!g) return s;
    if (c === "v5k-s" && row >= 4) return cut(s, 1) + ["って", "った"][row - 4];
    if (c === "v5aru" && row === 1) return cut(s, 1) + "い";
    if (c === "v5r-i" && row === 0) return cut(s, 2);
    return cut(s, 1) + g[row];
  });
}
function verbForm(x, f) {
  switch (f) {
    case "dict": return { w: x.w, r: x.r };
    case "neg": return x.c === "v5r-i" ? add(vstem(x, 0), "ない") : add(vstem(x, 0), "ない");
    case "past": return vstem(x, 5);
    case "pastneg": return add(vstem(x, 0), "なかった");
    case "te": return vstem(x, 4);
    case "negte": return add(vstem(x, 0), "ないで");
    case "masu": return add(vstem(x, 1), "ます");
    case "masen": return add(vstem(x, 1), "ません");
    case "mashita": return add(vstem(x, 1), "ました");
    case "masendeshita": return add(vstem(x, 1), "ませんでした");
    case "mashou": return add(vstem(x, 1), "ましょう");
    case "vol": return add(vstem(x, 3), "う");
    case "cond": return add(vstem(x, 2), "ば");
    case "stem": return vstem(x, 1);
    case "must": return add(vstem(x, 0), "なきゃ");
    case "mustp": return add(vstem(x, 0), "ないといけません");
    case "caus": return x.c === "v1" ? map2(x, function (s) { return cut(s, 1) + "させて"; }) : x.c === "vs" ? map2(x, function (s) { return cut(s, 2) + "させて"; }) : add(vstem(x, 0), "せて");
  }
  return { w: x.w, r: x.r };
}
function adjStem(x) { return x.c === "adj-ix" ? map2(x, function (s) { return cut(s, 2) + "よ"; }) : map2(x, function (s) { return cut(s, 1); }); }
function toTai(x) { var s = add(vstem(x, 1), "たい"); return W(s.w, s.r, "adj-i", { tai: true }); }
function toPot(x, casual) {
  var s;
  if (x.c === "v1") s = map2(x, function (t) { return cut(t, 1) + (casual ? "れる" : "られる"); });
  else if (x.c === "vk") s = /来る$/.test(x.w) ? { w: cut(x.w, 1) + (casual ? "れる" : "られる"), r: cut(x.r, 2) + (casual ? "これる" : "こられる") } : map2(x, function (t) { return cut(t, 2) + (casual ? "これる" : "こられる"); });
  else if (x.c === "vs") s = map2(x, function (t) { return cut(t, 2) + "できる"; });
  else if (x.c === "v5r-i") return x;
  else s = add(vstem(x, 2), "る");
  return W(s.w, s.r, "v1", { pot: true });
}
function toTe(x, aux, auxR) { var s = add(vstem(x, 4), aux, auxR); return W(s.w, s.r, "v1", { prog: aux === "いる" }); }

/* ------------------------------------------------------------------ English helpers */
var IRREG = { went: "go", gone: "go", goes: "go", ate: "eat", eaten: "eat", bought: "buy", saw: "see", seen: "see", came: "come", took: "take", taken: "take", got: "get", gotten: "get",
  gave: "give", given: "give", made: "make", said: "say", told: "tell", thought: "think", knew: "know", known: "know", found: "find", lost: "lose", left: "leave", met: "meet",
  paid: "pay", slept: "sleep", drank: "drink", drunk: "drink", spoke: "speak", spoken: "speak", wrote: "write", written: "write", ran: "run", sat: "sit", stood: "stand",
  felt: "feel", heard: "hear", held: "hold", kept: "keep", sent: "send", spent: "spend", taught: "teach", brought: "bring", caught: "catch", fell: "fall", flew: "fly",
  forgot: "forget", forgotten: "forget", broke: "break", broken: "break", chose: "choose", chosen: "choose", drove: "drive", driven: "drive", sang: "sing", sung: "sing",
  swam: "swim", wore: "wear", worn: "wear", won: "win", understood: "understand", began: "begin", begun: "begin", did: "do", done: "do", does: "do", had: "have", has: "have",
  was: "be", were: "be", been: "be", became: "become", woke: "wake", threw: "throw", thrown: "throw", grew: "grow", built: "build", sold: "sell", hid: "hide", meant: "mean",
  rode: "ride", ridden: "ride", shook: "shake", shot: "shoot", shown: "show", stole: "steal", tore: "tear", hung: "hang", led: "lead", fed: "feed", fought: "fight", dug: "dig",
  bit: "bite", blew: "blow", drew: "draw", froze: "freeze", lit: "light", slid: "slide", spun: "spin", swore: "swear", wept: "weep", lay: "lie", laid: "lay", dying: "die", lying: "lie" };
var PAST = { go: "went", eat: "ate", buy: "bought", see: "saw", come: "came", take: "took", get: "got", give: "gave", make: "made", say: "said", tell: "told", think: "thought",
  know: "knew", find: "found", lose: "lost", leave: "left", meet: "met", pay: "paid", sleep: "slept", drink: "drank", speak: "spoke", write: "wrote", run: "ran", sit: "sat",
  stand: "stood", feel: "felt", hear: "heard", hold: "held", keep: "kept", send: "sent", spend: "spent", teach: "taught", bring: "brought", catch: "caught", fall: "fell",
  fly: "flew", forget: "forgot", break: "broke", choose: "chose", drive: "drove", sing: "sang", swim: "swam", wear: "wore", win: "won", understand: "understood", begin: "began",
  do: "did", have: "had", be: "was", become: "became", wake: "woke", throw: "threw", grow: "grew", build: "built", sell: "sold", read: "read", put: "put", cut: "cut", hit: "hit",
  let: "let", shut: "shut", ride: "rode", fight: "fought", mean: "meant", lie: "lay", hang: "hung", lend: "lent", light: "lit", cost: "cost", hurt: "hurt", set: "set" };
function enKey(k) { return D.en[k] !== undefined ? D.en[k] : -1; }
function verbLemmas(w) {
  var c = [w];
  if (IRREG[w]) c.unshift(IRREG[w]);
  if (/ies$/.test(w)) c.push(w.slice(0, -3) + "y");
  if (/ied$/.test(w)) c.push(w.slice(0, -3) + "y");
  if (/es$/.test(w)) c.push(w.slice(0, -2));
  if (/s$/.test(w)) c.push(w.slice(0, -1));
  if (/ed$/.test(w)) { c.push(w.slice(0, -2)); c.push(w.slice(0, -1)); if (/(.)\1ed$/.test(w)) c.push(w.slice(0, -3)); }
  if (/ing$/.test(w)) { c.push(w.slice(0, -3)); c.push(w.slice(0, -3) + "e"); if (/(.)\1ing$/.test(w)) c.push(w.slice(0, -4)); if (/ying$/.test(w)) c.push(w.slice(0, -4) + "ie"); }
  return c;
}
function isPastForm(w) { return (IRREG[w] && w !== IRREG[w] + "s" && !/s$/.test(w) && !/ing$/.test(w)) || /ed$/.test(w); }
function nounForms(w) { var c = [w]; if (/ies$/.test(w)) c.push(w.slice(0, -3) + "y"); if (/(ches|shes|xes|ses)$/.test(w)) c.push(w.slice(0, -2)); if (/s$/.test(w)) c.push(w.slice(0, -1)); return c; }
function english3(v) { return /(s|sh|ch|x|o)$/.test(v) ? v + "es" : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + "ies" : v === "have" ? "has" : v + "s"; }
function englishPast(v) { if (PAST[v]) return PAST[v]; if (/e$/.test(v)) return v + "d"; if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ied"; if (/^[^aeiou]*[aeiou][bdgmnpt]$/.test(v)) return v + v[v.length - 1] + "ed"; return v + "ed"; }
function englishIng(v) { if (v === "be") return "being"; if (/ie$/.test(v)) return v.slice(0, -2) + "ying"; if (/[^e]e$/.test(v)) return v.slice(0, -1) + "ing"; if (/^[^aeiou]*[aeiou][bdgmnpt]$/.test(v)) return v + v[v.length - 1] + "ing"; return v + "ing"; }

/* ------------------------------------------------------------------ EN -> JP */
var PRON = {
  i: { s: "me" }, me: { s: "me", obj: true }, my: { poss: "me" }, mine: { s: "me" }, myself: { s: "me" },
  you: { s: "you" }, your: { poss: "you" }, yours: { s: "you" },
  he: { s: "he" }, him: { s: "he", obj: true }, his: { poss: "he" },
  she: { s: "she" }, her: { s: "she", obj: true, poss2: true },
  we: { s: "we" }, us: { s: "we", obj: true }, our: { poss: "we" },
  they: { s: "they" }, them: { s: "they", obj: true }, their: { poss: "they" },
  it: { s: "it" }, this: { s: "this" }, that: { s: "that" }, these: { s: "these" }, those: { s: "those" }
};
function pronJP(who, casual) {
  var me = E.opts.me || "俺";
  var T = { me: casual ? [me, me === "俺" ? "おれ" : me === "僕" ? "ぼく" : me === "うち" ? "うち" : "わたし"] : ["私", "わたし"],
    you: casual ? ["君", "きみ"] : ["あなた", "あなた"], he: ["彼", "かれ"], she: ["彼女", "かのじょ"], we: casual ? [me === "私" ? "私たち" : me + "たち", me === "私" ? "わたしたち" : (me === "俺" ? "おれ" : me === "僕" ? "ぼく" : "うち") + "たち"] : ["私たち", "わたしたち"],
    they: casual ? ["あいつら", "あいつら"] : ["彼ら", "かれら"], it: ["それ", "それ"], this: ["これ", "これ"], that: ["それ", "それ"], these: ["これ", "これ"], those: ["それ", "それ"] };
  var t = T[who] || ["それ", "それ"];
  return { w: t[0], r: t[1] };
}
var DET = { a: 1, an: 1, the: 1, some: 1, any: 1, every: 1, each: 1, another: 1, other: 1, all: 1, no: 1, much: 1, many: 1, few: 1, more: 1, most: 1, few: 1, several: 1 };
var PREP = ["in front of", "next to", "close to", "because of", "instead of", "on top of", "out of", "in", "on", "at", "to", "into", "onto", "from", "with", "without", "for", "by", "near",
  "about", "after", "before", "until", "till", "behind", "under", "over", "above", "inside", "outside", "around", "during", "like", "than", "via", "through", "of", "beside", "towards", "toward"];
var NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, hundred: 100, thousand: 1000 };
var NUMJ = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
var TSU = ["", "一つ", "二つ", "三つ", "四つ", "五つ", "六つ", "七つ", "八つ", "九つ", "十"];
var TSUR = ["", "ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ", "とお"];
var NINR = ["", "ひとり", "ふたり", "さんにん", "よにん", "ごにん", "ろくにん", "ななにん", "はちにん", "きゅうにん", "じゅうにん"];
var NUMR = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう", "じゅう"];
var MAIR = ["", "いちまい", "にまい", "さんまい", "よんまい", "ごまい", "ろくまい", "ななまい", "はちまい", "きゅうまい", "じゅうまい"];
var TIME = { today: ["今日", "きょう"], tomorrow: ["明日", "あした"], yesterday: ["昨日", "きのう"], tonight: ["今夜", "こんや"], now: ["今", "いま"], later: ["後で", "あとで"],
  soon: ["すぐ", "すぐ"], "right now": ["今すぐ", "いますぐ"], "this morning": ["今朝", "けさ"], "this evening": ["今晩", "こんばん"], "this weekend": ["今週末", "こんしゅうまつ"],
  "next week": ["来週", "らいしゅう"], "last week": ["先週", "せんしゅう"], "this week": ["今週", "こんしゅう"], "next month": ["来月", "らいげつ"], "last night": ["昨日の夜", "きのうのよる"],
  "every day": ["毎日", "まいにち"], everyday: ["毎日", "まいにち"], "tomorrow morning": ["明日の朝", "あしたのあさ"], "tomorrow night": ["明日の夜", "あしたのよる"], "this year": ["今年", "ことし"], "next year": ["来年", "らいねん"], "last year": ["去年", "きょねん"],
  "in the morning": ["朝", "あさ"], "at night": ["夜", "よる"], "in the evening": ["夕方", "ゆうがた"], "in the afternoon": ["午後", "ごご"], "on the weekend": ["週末", "しゅうまつ"], "at the weekend": ["週末", "しゅうまつ"] };
var ADV = { // english -> [casual, polite, reading casual, reading polite]
  very: ["めっちゃ", "とても", "めっちゃ", "とても"], really: ["マジで", "本当に", "まじ|で", "ほんとう|に"], so: ["めっちゃ", "とても", "めっちゃ", "とても"], super: ["超", "とても", "ちょう", "とても"],
  again: ["また", "もう一度", "また", "もう|いちど"], together: ["一緒に", "一緒に", "いっしょ|に", "いっしょ|に"], slowly: ["ゆっくり", "ゆっくり", "ゆっくり", "ゆっくり"],
  quickly: ["早く", "早く", "はやく", "はやく"], already: ["もう", "もう", "もう", "もう"], still: ["まだ", "まだ", "まだ", "まだ"], yet: ["まだ", "まだ", "まだ", "まだ"],
  "a little": ["ちょっと", "少し", "ちょっと", "すこし"], "a bit": ["ちょっと", "少し", "ちょっと", "すこし"], "a lot": ["めっちゃ", "たくさん", "めっちゃ", "たくさん"], lots: ["いっぱい", "たくさん", "いっぱい", "たくさん"],
  maybe: ["たぶん", "たぶん", "たぶん", "たぶん"], probably: ["たぶん", "たぶん", "たぶん", "たぶん"], always: ["いつも", "いつも", "いつも", "いつも"], often: ["よく", "よく", "よく", "よく"],
  usually: ["普段", "普段", "ふだん", "ふだん"], sometimes: ["たまに", "時々", "たまに", "ときどき"], first: ["まず", "まず", "まず", "まず"], definitely: ["絶対", "絶対", "ぜったい", "ぜったい"],
  actually: ["実は", "実は", "じつ|は", "じつ|は"], seriously: ["マジで", "本当に", "まじ|で", "ほんとう|に"], alone: ["一人で", "一人で", "ひとり|で", "ひとり|で"], just: ["ちょっと", "ちょっと", "ちょっと", "ちょっと"],
  well: ["上手に", "上手に", "じょうず|に", "じょうず|に"], here: ["ここ", "ここ", "ここ", "ここ"], there: ["そこ", "そこ", "そこ", "そこ"], "over there": ["あそこ", "あそこ", "あそこ", "あそこ"],
  home: ["家", "家", "いえ", "いえ"], fast: ["早く", "早く", "はやく", "はやく"], almost: ["ほぼ", "ほとんど", "ほぼ", "ほとんど"], only: ["だけ", "だけ", "だけ", "だけ"], also: ["も", "も", "も", "も"], too: ["も", "も", "も", "も"],
  never: ["絶対", "絶対", "ぜったい", "ぜったい"], slower: ["もっとゆっくり", "もっとゆっくり", "もっと|ゆっくり", "もっと|ゆっくり"], louder: ["もっと大きい声で", "もっと大きい声で", "もっと|おおきい|こえ|で", "もっと|おおきい|こえ|で"], faster: ["もっと速く", "もっと速く", "もっと|はやく", "もっと|はやく"], ever: ["", "", "", ""], immediately: ["すぐ", "すぐに", "すぐ", "すぐに"], straight: ["まっすぐ", "まっすぐ", "まっすぐ", "まっすぐ"]
};
var INTERJ = { hey: ["ねえ", "すみません"], hi: ["やあ", "こんにちは"], hello: ["やあ", "こんにちは"], yo: ["よっ", "こんにちは"], sorry: ["ごめん", "すみません"], oh: ["あ", "あ"], wow: ["わあ", "わあ"],
  um: ["えっと", "えっと"], uh: ["えっと", "えっと"], well: ["まあ", "まあ"], ok: ["オッケー", "はい"], okay: ["オッケー", "はい"], yes: ["うん", "はい"], yeah: ["うん", "はい"], yep: ["うん", "はい"],
  no: ["ううん", "いいえ"], nope: ["ううん", "いいえ"], thanks: ["ありがと", "ありがとうございます"], "thank you": ["ありがと", "ありがとうございます"], "excuse me": ["すみません", "すみません"],
  please: ["", ""], so: ["で", "では"], lol: ["笑", "笑"], damn: ["くそ", "くそ"], man: ["", ""], dude: ["", ""], bro: ["", ""], omg: ["やばい", "えっ"] };
var INTERJ_R = { "ねえ": "ねえ", "すみません": "すみません", "やあ": "やあ", "こんにちは": "こんにちは", "よっ": "よっ", "ごめん": "ごめん", "あ": "あ", "わあ": "わあ", "えっと": "えっと", "まあ": "まあ",
  "オッケー": "おっけー", "はい": "はい", "うん": "うん", "ううん": "ううん", "いいえ": "いいえ", "ありがと": "ありがと", "ありがとうございます": "ありがとうございます", "で": "で", "では": "では", "笑": "わら", "くそ": "くそ", "やばい": "やばい", "えっ": "えっ" };
var PEOPLE = /^(friend|friends|mom|mother|dad|father|brother|sister|girlfriend|boyfriend|wife|husband|family|teacher|doctor|person|people|guy|girl|boy|man|woman|kid|everyone|someone|staff|he|she|they|you|me|we)$/;
var MOTION = ["行く", "来る", "帰る", "戻る", "着く", "入る", "乗る", "出かける", "引っ越す", "向かう"];
var EXIST = ["いる", "ある", "住む", "泊まる", "置く", "残る", "座る", "立つ"];
var STATEV = { "知る": 1, "住む": 1, "持つ": 1, "覚える": 1, "結婚する": 1, "着る": 1, "付き合う": 1, "愛する": 1 };
var REQUEST_VERBS = /^(help|take|show|tell|give|wait|open|close|stop|call|send|bring|carry|write|say|repeat|check|turn|pass|lend|teach|explain|recommend|translate|come|go|let|pick|put|make|cook|buy|get|hold|keep|text|contact|look|clean|fix|wake|book|reserve|order|charge|print|change|exchange|cancel)$/;
var NOOBJ_ME = /^(give|show|tell|send|teach|call|help|text|wait|buy|bring|lend|pass|get|let|take|wake|contact|ask|follow)$/;

function isStopWordStrict(w) { return /^(is|are|am|was|were|be|do|does|did|not|please|and|or|but|to|the|a|an|of|,|'s)$/.test(w); }
function lookupNoun(words) { // words: array -> {entry, n} longest match
  if (!words.length || !words[0] || isStopWordStrict(words[0])) return null;
  for (var L = Math.min(4, words.length); L >= 1; L--) {
    var phrase = words.slice(0, L), last = phrase[L - 1], forms = nounForms(last);
    for (var f = 0; f < forms.length; f++) {
      var key = phrase.slice(0, L - 1).concat([forms[f]]).join(" ");
      var i = enKey(key);
      if (i >= 0 && L > 1 && !CORE[key] && phrase.slice(1).some(function (x) { return SMALL.test(x); })) i = -1;
      if (i >= 0) return { e: ent(i), n: L };
    }
  }
  return null;
}
function lookupAdj(w) {
  var cand = [w];
  if (/ier$/.test(w)) cand.push(w.slice(0, -3) + "y");
  if (/er$/.test(w)) { cand.push(w.slice(0, -2)); cand.push(w.slice(0, -1)); if (/(.)\1er$/.test(w)) cand.push(w.slice(0, -3)); }
  if (/iest$/.test(w)) cand.push(w.slice(0, -4) + "y");
  if (/est$/.test(w)) { cand.push(w.slice(0, -3)); cand.push(w.slice(0, -2)); if (/(.)\1est$/.test(w)) cand.push(w.slice(0, -4)); }
  for (var k = 0; k < cand.length; k++) {
    var i = enKey(cand[k]);
    if (i >= 0) { var e = ent(i); if (aclass(e) || has(e.p, "st")) return { e: e, cmp: k > 0 ? (/est$/.test(w) ? "most" : "more") : null }; }
  }
  return null;
}
var SMALL = /^(to|at|in|on|for|with|from|a|an|the|my|your|me|you|it|this|that|by|of|into|about)$/;
function lookupVerb(words) { // longest multiword verb, first word lemmatized
  if (!words.length || !words[0] || isStopWordStrict(words[0])) return null;
  var lem = verbLemmas(words[0]);
  for (var L = Math.min(5, words.length); L >= 1; L--) {
    for (var k = 0; k < lem.length; k++) {
      var key = "to " + [lem[k]].concat(words.slice(1, L)).join(" ");
      var i = enKey(key);
      if (i >= 0 && L > 1 && !CORE[key] && words.slice(1, L).some(function (x) { return SMALL.test(x); })) i = -1;
      if (i >= 0) { var e = ent(i); if (vclass(e)) return { e: e, n: L, lemma: lem[k], past: isPastForm(words[0]), ing: /ing$/.test(words[0]) && lem[k] !== words[0] }; }
    }
  }
  return null;
}
function wordOf(e) { var c = vclass(e) || aclass(e) || (has(e.p, "st") ? "st" : "n"); var w = W(e.w, e.r, c); if (has(e.p, "st")) { w.st = true; w.c = e.p[1] === "v1" ? "v1" : e.p[1]; } return w; }

// ---- tokenizer
function normalizeEN(s) {
  s = " " + s.toLowerCase().replace(/[’`]/g, "'") + " ";
  var rep = [[/\bi'm\b/g, "i am"], [/\bim\b/g, "i am"], [/\bcan't\b/g, "can not"], [/\bcant\b/g, "can not"], [/\bcannot\b/g, "can not"], [/\bwon't\b/g, "will not"], [/\bdont\b/g, "do not"], [/\bdoesnt\b/g, "does not"], [/\bdidnt\b/g, "did not"],
    [/\b(\w+)n't\b/g, "$1 not"], [/'re\b/g, " are"], [/'ve\b/g, " have"], [/'ll\b/g, " will"], [/'d like\b/g, " would like"], [/'d\b/g, " would"], [/\blet's\b/g, "let us"], [/\blets\b/g, "let us"],
    [/\b(it|that|what|where|how|who|there|here|he|she|this|everything|nothing|when|why)'s\b/g, "$1 is"], [/\bwhats\b/g, "what is"], [/\bwheres\b/g, "where is"], [/\bthats\b/g, "that is"], [/\bhows\b/g, "how is"],
    [/\bwanna\b/g, "want to"], [/\bgonna\b/g, "going to"], [/\bgotta\b/g, "have to"], [/\bgimme\b/g, "give me"], [/\blemme\b/g, "let me"], [/\bu\b/g, "you"], [/\bur\b/g, "your"], [/\br\b/g, "are"],
    [/\b(pls|plz|plez)\b/g, "please"], [/\b(thx|ty|thnx)\b/g, "thanks"], [/\bppl\b/g, "people"], [/\b(bc|cuz|cos|coz)\b/g, "because"], [/\btmrw\b/g, "tomorrow"], [/\brn\b/g, "right now"], [/\bidk\b/g, "i do not know"],
    [/\bgonna\b/g, "going to"], [/\bok\b/g, "okay"], [/\bbarbeque\b/g, "barbecue"], [/\bwifi\b/g, "wifi"]];
  for (var i = 0; i < rep.length; i++) s = s.replace(rep[i][0], rep[i][1]);
  return s.trim();
}
function tokens(s) {
  return s.replace(/'s\b/g, " 's").replace(/[^a-z0-9'\-, ]/g, " ").replace(/,/g, " , ").split(/\s+/).filter(Boolean);
}
function matchSeq(t, i, list) { // longest phrase from list starting at i
  var best = null;
  for (var k = 0; k < list.length; k++) {
    var p = list[k].split(" ");
    if (t.slice(i, i + p.length).join(" ") === list[k] && (!best || p.length > best.split(" ").length)) best = list[k];
  }
  return best;
}
var TIME_KEYS = Object.keys(TIME), ADV_KEYS = Object.keys(ADV), INTERJ_KEYS = Object.keys(INTERJ);

// ---- noun phrase
function parseNP(t, i, stop) {
  var np = { parts: [], i: i, num: null, poss: null, det: null, adjs: [], unknown: [], person: false };
  var start = i;
  while (i < t.length && t[i] === ",") i++;
  if (i >= t.length) return null;
  var w = t[i];
  if (PRON[w] && !PRON[w].poss && !(w === "her" && t[i + 1] && !PREP_START(t, i + 1) && lookupNoun(t.slice(i + 1)))) {
    if ((w === "this" || w === "that" || w === "these" || w === "those") && t[i + 1] && !isStopWord(t[i + 1]) && lookupNoun(t.slice(i + 1)) && !isVerbStart(t, i + 1) && !(stop && i + 2 >= t.length && (lookupAdj(t[i + 1]) || i > 0))) { np.det = w; i++; }
    else { np.pron = PRON[w].s; np.person = /^(me|you|he|she|we|they)$/.test(np.pron); np.i = i + 1; np.end = i + 1; return np; }
  }
  for (; i < t.length; i++) {
    w = t[i];
    if (PRON[w] && (PRON[w].poss || w === "her")) { np.poss = PRON[w].poss || "she"; continue; }
    if (DET[w] && !(w === "no" && np.parts.length)) { np.det = np.det || w; if (w === "more" || w === "most") np.cmp = w; continue; }
    if (NUMS[w] || /^\d+$/.test(w)) { np.num = NUMS[w] || parseInt(w, 10); continue; }
    break;
  }
  if (i >= t.length) return null;
  // adjectives (only if followed by something nounish)
  while (i < t.length - 1) {
    if (t[i] === "too" || t[i] === "very" || t[i] === "really" || t[i] === "so") { np.intens = t[i]; i++; continue; }
    var adj = lookupAdj(t[i]);
    var nounHere = lookupNoun(t.slice(i));
    if (adj && (!nounHere || nounHere.n === 1) && (lookupNoun(t.slice(i + 1)) || /^[a-z]+$/.test(t[i + 1]) && !isStopWord(t[i + 1]))) {
      if (nounHere && nounHere.n > 1) break;
      np.adjs.push(adj); i++; continue;
    }
    break;
  }
  var count = 0;
  while (i < t.length && count < 3) {
    if (isStopWord(t[i]) || t[i] === ",") break;
    var hit = lookupNoun(t.slice(i));
    if (hit && !(count > 0 && lookupVerb(t.slice(i)) && !lookupNoun([t[i]]))) {
      np.parts.push(hit.e); i += hit.n; count++;
      if (t[i] === "'s") { np.parts.push("の"); i++; }
      continue;
    }
    if (count === 0 || (count > 0 && !lookupVerb(t.slice(i)) && !lookupAdj(t[i]))) {
      if (lookupVerb(t.slice(i)) && count === 0 && np.adjs.length === 0 && !np.det && !np.poss && !np.num) return null;
      np.parts.push({ unknown: t[i] }); np.unknown.push(t[i]); i++; count++;
      if (t[i] === "'s") { np.parts.push("の"); i++; }
      continue;
    }
    break;
  }
  if (!np.parts.length && !np.adjs.length) return null;
  if (!np.parts.length && np.adjs.length) { np.adjOnly = true; }
  // "B of A" -> A の B
  if (t[i] === "of" && t[i + 1] && !isVerbStart(t, i + 1)) {
    var inner = parseNP(t, i + 1);
    if (inner) { np.of = inner; i = inner.end; }
  }
  np.person = np.parts.some(function (p) { return p.w && PEOPLE.test(firstGloss(p)); });
  np.end = i;
  return np;
}
function PREP_START(t, i) { return !!matchSeq(t, i, PREP); }
function isStopWord(w) {
  return PREP.indexOf(w) >= 0 || w === "and" || w === "or" || w === "but" || w === "please" || w === "because" || w === "if" || w === "when" || w === "so" || w === "then" ||
    w === "is" || w === "are" || w === "am" || w === "was" || w === "were" || w === "do" || w === "does" || w === "did" || w === "can" || w === "could" || w === "will" || w === "would" ||
    w === "not" || w === "too" || w === "also" || w === "again" || w === "together" || w === "here" || w === "there" || w === "now" || w === "today" || w === "tomorrow" ||
    w === "yesterday" || w === "tonight" || w === "later" || w === "?" || w === "," || w === "to" || w === "should" || w === "must" || w === "have" || w === "has" || w === "want" || w === "need";
}
function isVerbStart(t, i) {
  var v = lookupVerb(t.slice(i)); if (!v) return false;
  if (CORE["to " + v.lemma] || v.n > 1) return !(CORE[t[i]] && !CORE["to " + v.lemma]);
  return !lookupNoun([t[i]]);
}

var UNIT = { // surface -> [unit, reading after a number, readings for 1-10]
  "分": ["分", "ふん", ["", "いっぷん", "にふん", "さんぷん", "よんぷん", "ごふん", "ろっぷん", "ななふん", "はっぷん", "きゅうふん", "じゅっぷん"]],
  "時間": ["時間", "じかん"], "秒": ["秒", "びょう"], "年": ["年", "ねん"], "週": ["週間", "しゅうかん"], "週間": ["週間", "しゅうかん"], "月": ["ヶ月", "かげつ"], "ヶ月": ["ヶ月", "かげつ"], "円": ["円", "えん"], "ドル": ["ドル", "どる"], "歳": ["歳", "さい"],
  "日": ["日", "にち", ["", "いちにち", "ふつか", "みっか", "よっか", "いつか", "むいか", "なのか", "ようか", "ここのか", "とおか"]],
  "泊": ["泊", "はく", ["", "いっぱく", "にはく", "さんぱく", "よんぱく", "ごはく", "ろっぱく", "ななはく", "はっぱく", "きゅうはく", "じゅっぱく"]]
};
function numJP(n, noun, casual) {
  var g = noun && noun.w ? firstGloss(noun) : "";
  if (/^(person|people|guy|friend|friends)$/.test(g) || noun === "people") return n <= 10 ? { w: NUMJ[n] + "人", r: NINR[n] } : { w: n + "人", r: n + "にん" };
  if (/^(ticket|shirt|t-shirt|paper|photo|picture|card|sheet)$/.test(g)) return n <= 10 ? { w: NUMJ[n] + "枚", r: MAIR[n] } : { w: n + "枚", r: n + "まい" };
  if (n <= 10) return { w: TSU[n], r: TSUR[n] };
  return { w: n + "個", r: n + "こ" };
}
var COLORN = { "赤い": ["赤", "あか"], "青い": ["青", "あお"], "黒い": ["黒", "くろ"], "白い": ["白", "しろ"], "黄色い": ["黄色", "きいろ"], "茶色い": ["茶色", "ちゃいろ"] };
function colorNoun(e) { var c = COLORN[e.w]; return c ? { w: c[0], r: c[1] } : aclass(e) === "adj-i" ? { w: e.w, r: e.r } : { w: e.w, r: e.r }; }
function adjAttr(a, casual) { // attributive form
  var e = a.e, c = aclass(e);
  if (has(e.p, "st")) { var x = wordOf(e); return verbForm(x, "past"); }
  if (c === "adj-na") return { w: e.w + "な", r: e.r + "な" };
  if (c === "adj-no" || !c) return { w: e.w + "の", r: e.r + "の" };
  return { w: e.w, r: e.r };
}
function renderNP(np, casual) {
  if (!np) return null;
  if (np.pron) { var p = pronJP(np.pron, casual); p.parts = [p]; return p; }
  var w = "", r = "", parts = [];
  if (np.raw) return { w: np.raw.w, r: np.raw.r, parts: [np.raw] };
  function push(x) { w += x.w; r += (r ? "|" : "") + x.r; parts.push(x); }
  if (np.of) { var o = renderNP(np.of, casual); push({ w: o.w + "の", r: o.r + "|の" }); }
  if (np.poss && np.poss !== "me") { var pp = pronJP(np.poss, casual); push({ w: pp.w + "の", r: pp.r + "|の" }); }
  if (np.det === "this" || np.det === "these") push({ w: "この", r: "この" });
  if (np.det === "that" || np.det === "those") push({ w: "その", r: "その" });
  if (np.det === "another") push({ w: "もう一つの", r: "もうひとつの" });
  if (np.det === "every") push({ w: "毎", r: "まい" });
  if (np.det === "all") push({ w: "全部の", r: "ぜんぶの" });
  if (np.det === "other") push({ w: "他の", r: "ほかの" });
  if (np.cmp === "more" || np.det === "more") push({ w: "もっと", r: "もっと" });
  np.adjs.forEach(function (a) {
    if (a.cmp === "more") push({ w: "もっと", r: "もっと" });
    if (a.cmp === "most") push({ w: "一番", r: "いちばん" });
    push(adjAttr(a, casual));
  });
  if (np.adjOnly) return { w: w, r: r, parts: parts };
  var nounParts = [];
  np.parts.forEach(function (p, idx) {
    if (p === "の") { push({ w: "の", r: "の" }); return; }
    if (p.unknown) { var k = katakana(p.unknown); push({ w: k, r: toHira(k), unknown: true }); return; }
    var x = { w: p.w, r: p.r };
    if (nounParts.length && /[㐀-鿿]$/.test(w) && /^[㐀-鿿]/.test(p.w) && !p.w.match(/^[゠-ヿ]/)) { /* kanji+kanji compounds join directly */ }
    push(x); nounParts.push(p);
  });
  if (np.num && !np.noNum) {
    var head = np.parts[np.parts.length - 1], un = head && head.w && UNIT[head.w];
    if (un) { // time / money units take the number directly: 10分, 2時間, 3泊
      w = w.slice(0, w.length - head.w.length); r = r.replace(/\|?[^|]*$/, ""); parts.pop();
      push({ w: np.num + un[0], r: (un[2] && np.num <= 10 ? un[2][np.num] : np.num + un[1]) });
    } else push(numJP(np.num, np.parts[0], casual));
  }
  return { w: w, r: r, parts: parts, head: np.parts[np.parts.length - 1] };
}

// ---- clause parsing
function parseClause(t) {
  var c = { interj: [], time: [], advs: [], pps: [], neg: false, past: false, q: false, modal: null, prog: false, cop: false, request: false, also: false, sugi: false, intens: null };
  var i = 0, m;
  // interjections
  for (;;) {
    while (t[i] === ",") i++;
    m = matchSeq(t, i, INTERJ_KEYS);
    if (!m) break;
    if (m === "no" && t[i + 1] && t[i + 1] !== ",") break;
    if (m === "so" && t[i + 1] && !/^(i|you|we|what|where|how)$/.test(t[i + 1])) break;
    if (m === "please") c.request = true; else c.interj.push(m);
    i += m.split(" ").length;
  }
  while (t[i] === ",") i++;
  // time at start
  m = matchSeq(t, i, TIME_KEYS); if (m) { c.time.push(m); i += m.split(" ").length; while (t[i] === ",") i++; }
  // question word
  var qw = matchSeq(t, i, ["how much", "how many", "how long", "how far", "how old", "what time", "what kind of", "which one", "what", "where", "when", "who", "why", "how", "which"]);
  if (qw) {
    c.qword = qw; c.q = true; i += qw.split(" ").length;
    if ((qw === "what" || qw === "which" || qw === "how many" || qw === "what kind of") && t[i] && !/^(is|are|was|were|do|does|did|can|could|will|would|should|time)$/.test(t[i])) {
      var qnp = parseNP(t, i); if (qnp && !qnp.pron) { c.qnp = qnp; i = qnp.end; }
    }
  }
  // inversion
  var AUXQ = ["do", "does", "did", "can", "could", "will", "would", "should", "shall", "may", "is", "are", "am", "was", "were", "have", "has"];
  if (AUXQ.indexOf(t[i]) >= 0 && (c.qword || i === 0 || c.interj.length || c.time.length)) {
    c.aux = t[i]; c.q = true; i++;
    if (t[i] === "not") { c.neg = true; i++; }
    if (/^(is|are|was|were)$/.test(c.aux) && t[i] === "there") { c.exist = true; i++; }
    else if (!(c.qword === "who" && !PRON[t[i]])) {
      var subj = parseNP(t, i, true);
      if (subj) { c.subj = subj; i = subj.end; }
    }
    if (/^(was|were|did)$/.test(c.aux)) c.past = true;
    if (/^(is|are|am|was|were)$/.test(c.aux)) { if (t[i] === "not") { c.neg = true; i++; } if (t[i] && /ing$/.test(t[i]) && lookupVerb(t.slice(i)) && !lookupAdj(t[i])) c.prog = true; else if (t[i] === "going" && t[i + 1] === "to" && isVerbStart(t, i + 2)) { c.modal = "will"; i += 2; } else c.cop = true; }
    if (/^(can|could)$/.test(c.aux)) c.modal = "can";
    if (/^(will|would)$/.test(c.aux)) { if (t[i] === "like") { c.modal = "wouldlike"; i++; if (t[i] === "to") i++; } else c.modal = "will"; }
    if (/^(should|shall)$/.test(c.aux)) c.modal = "should";
    if (/^(have|has)$/.test(c.aux) && !lookupVerb(t.slice(i))) { c.haveQ = true; }
  } else if (c.qword === "who" && /^(is|are|was|were)$/.test(t[i])) {
    c.cop = true; c.aux = t[i]; i++;
  } else if (!c.qword || c.qword) {
    // let's
    if (t[i] === "let" && t[i + 1] === "us") { c.modal = "lets"; i += 2; }
    else if (t[i] === "let" && t[i + 1] === "me") { c.modal = "letme"; i += 2; }
    else if (t[i] === "there" && /^(is|are|was|were)$/.test(t[i + 1])) { c.exist = true; c.past = /^(was|were)$/.test(t[i + 1]); i += 2; if (t[i] === "not" || t[i] === "no") { c.neg = true; if (t[i] === "not") i++; } }
    else if (t[i] === "never") { c.neg = true; c.advs.push("never"); i++; }
    else if (isVerbStart(t, i) && !PRON[t[i]] && !(t[i] === "have" || t[i] === "need" || t[i] === "want" || t[i] === "like" || t[i] === "love" || t[i] === "hate")) {
      c.imper = true; c.request = true;
    } else if (t[i] === "do" && t[i + 1] === "not" && isVerbStart(t, i + 2)) { c.imper = true; c.request = true; c.neg = true; i += 2; }
    else {
      var s2 = parseNP(t, i, true);
      if (s2) { c.subj = s2; i = s2.end; }
    }
  }
  // modal chain
  for (var guard = 0; guard < 8; guard++) {
    var w = t[i];
    if (!w) break;
    if (w === "not") { c.neg = true; i++; continue; }
    if (w === "please") { c.request = true; i++; continue; }
    if (w === "too" && t[i + 1] && lookupAdj(t[i + 1])) { break; }
    if (w === "never") { c.neg = true; c.advs.push("never"); i++; continue; }
    if (ADV[w] && /^(really|also|just|always|often|usually|still|already|actually|definitely|probably|maybe|seriously|sometimes|too)$/.test(w) && t[i + 1] && t[i + 1] !== "much") {
      if (w === "also" || w === "too") c.also = true; else c.advs.push(w); i++; continue;
    }
    if (w === "do" || w === "does") { i++; continue; }
    if (w === "did") { c.past = true; i++; continue; }
    if (w === "can" || w === "could") { c.modal = "can"; i++; continue; }
    if (w === "will" || w === "shall") { c.modal = c.modal || "will"; i++; continue; }
    if (w === "would" && t[i + 1] === "like") { c.modal = "wouldlike"; i += 2; if (t[i] === "to") i++; continue; }
    if (w === "would") { i++; continue; }
    if (w === "should") { c.modal = "should"; i++; continue; }
    if (w === "must") { c.modal = "must"; i++; continue; }
    if ((w === "have" || w === "has") && t[i + 1] === "to") { c.modal = "must"; i += 2; continue; }
    if ((w === "need" || w === "needs") && t[i + 1] === "to") { c.modal = "must"; i += 2; continue; }
    if ((w === "want" || w === "wants") && t[i + 1] === "to") { c.modal = "want"; i += 2; continue; }
    if (w === "wanted" && t[i + 1] === "to") { c.modal = "want"; c.past = true; i += 2; continue; }
    if ((w === "like" || w === "likes" || w === "love" || w === "loves") && t[i + 1] === "to") { c.modal = "like"; c.likeWord = w.replace(/s$/, ""); i += 2; continue; }
    if ((w === "try" || w === "tried" || w === "trying") && t[i + 1] === "to") { c.modal = "try"; if (w === "tried") c.past = true; i += 2; continue; }
    if (w === "able" && t[i + 1] === "to") { c.modal = "can"; i += 2; continue; }
    if (/^(am|is|are|was|were|be|been)$/.test(w)) {
      if (/^(was|were)$/.test(w)) c.past = true;
      i++;
      if (t[i] === "not") { c.neg = true; i++; }
      if (t[i] === "going" && t[i + 1] === "to" && isVerbStart(t, i + 2)) { c.modal = c.modal || "will"; i += 2; continue; }
      if (t[i] === "going") { c.prog = true; continue; }
      if (t[i] === "able" && t[i + 1] === "to") { c.modal = "can"; i += 2; continue; }
      if (t[i] && /ing$/.test(t[i]) && lookupVerb(t.slice(i)) && !lookupAdj(t[i])) { c.prog = true; continue; }
      c.cop = true; continue;
    }
    break;
  }
  // main verb
  if (!c.cop && !c.exist && t[i]) {
    var v = (t[i] === "have" || t[i] === "has" || t[i] === "had") && !lookupVerb(t.slice(i, i + 3)).n > 1 ? null : lookupVerb(t.slice(i));
    if ((t[i] === "have" || t[i] === "has" || t[i] === "had" || t[i] === "got") && !(v && v.n > 1)) { c.have = true; if (t[i] === "had") c.past = true; i++; if (t[i] === "got") i++; }
    else if (/^(want|wants|wanted)$/.test(t[i])) { c.wantNoun = true; if (t[i] === "wanted") c.past = true; i++; }
    else if (/^(need|needs|needed)$/.test(t[i])) { c.needNoun = true; if (t[i] === "needed") c.past = true; i++; }
    else if (/^(like|likes|liked|love|loves|loved|hate|hates|hated|enjoy)$/.test(t[i]) && !(t[i + 1] === "to")) {
      c.likeNoun = t[i].replace(/(s|d)$/, "").replace(/ed$/, "").replace(/^lov$/, "love").replace(/^hat$/, "hate").replace(/^lik$/, "like"); if (/d$/.test(t[i])) c.past = true; i++;
      if (t[i] && /ing$/.test(t[i]) && lookupVerb(t.slice(i))) { c.likeVerb = true; }
    }
    else if (/^(miss|missed)$/.test(t[i]) && /^(you|him|her|them|me|us)$/.test(t[i + 1] || "")) { c.missYou = true; i += 2; }
    if (!c.have && !c.wantNoun && !c.needNoun && (!c.likeNoun || c.likeVerb) && !c.missYou) {
      v = lookupVerb(t.slice(i));
      if (v) {
        c.verb = v; i += v.n;
        if (v.past && !c.modal && !c.prog) c.past = true;
        if (t[i] && /^(it|them|this|that)$/.test(t[i]) && /^(up|on|off|out|down|back)$/.test(t[i + 1] || "")) { var pv = lookupVerb([v.lemma, t[i + 1]]); if (pv) { c.verb = pv; c.verb.objPron = t[i]; i += 2; } }
        // "go shopping"
        if (/^(go|went|going)$/.test(t[i - 1]) && t[i] && /ing$/.test(t[i])) { var g2 = lookupVerb(t.slice(i)); if (g2) { c.goDo = g2; i += g2.n; } }
      }
    }
  }
  // indirect object me/us after verb
  if (c.verb && t[i] && PRON[t[i]] && PRON[t[i]].obj && NOOBJ_ME.test(c.verb.lemma)) { c.iobj = PRON[t[i]].s; i++; }
  if (c.verb && /^(help|wait)$/.test(c.verb.lemma) && t[i] === "for") { i++; }
  // predicate / object
  if (c.cop || c.exist) {
    if (t[i] === "too") { c.sugi = true; i++; }
    if (/^(very|really|so|super)$/.test(t[i] || "")) { c.intens = t[i]; i++; }
    var a = t[i] && lookupAdj(t[i]);
    var nounFirst = t[i] && lookupNoun(t.slice(i));
    if (a && !(nounFirst && nounFirst.n > 1) && !(t[i + 1] && lookupNoun(t.slice(i + 1)) && !isStopWord(t[i + 1]))) { c.padj = a; i++; }
    else if (t[i] === "here" || t[i] === "there" || t[i] === "home") { c.pplace = t[i]; i++; }
    else if (!PREP_START(t, i)) { var pn = parseNP(t, i); if (pn) { c.pnp = pn; i = pn.end; } }
  } else if (t[i] && !ADV[t[i]] && !PREP_START(t, i) && !isStopWord(t[i]) && !matchSeq(t, i, TIME_KEYS) || (t[i] && /^(it|this|that|them|me|you|him|her|us)$/.test(t[i]))) {
    var ob = parseNP(t, i);
    if (ob) { c.obj = ob; i = ob.end; }
    if (t[i] === "and" && t[i + 1] && !PRON[t[i + 1]] && !isVerbStart(t, i + 1)) { var ob2 = parseNP(t, i + 1); if (ob2) { c.obj2 = ob2; i = ob2.end; } }
  }
  // rest: PPs, adverbs, time, please
  for (guard = 0; guard < 20 && i < t.length; guard++) {
    if (t[i] === "," || t[i] === "and") { i++; continue; }
    if (t[i] === "please") { c.request = true; i++; continue; }
    m = matchSeq(t, i, TIME_KEYS); if (m) { c.time.push(m); i += m.split(" ").length; continue; }
    m = matchSeq(t, i, ["too much", "a little", "a bit", "a lot", "over there"]);
    if (m) { if (m === "too much") c.advs.push("toomuch"); else if (m === "over there") c.place = "over there"; else c.advs.push(m); i += m.split(" ").length; continue; }
    if (t[i] === "here" || t[i] === "there" || t[i] === "home") { c.place = t[i]; i++; continue; }
    if (t[i] === "too" || t[i] === "also") { c.also = true; i++; continue; }
    if (ADV[t[i]] && t[i] !== "so") { c.advs.push(t[i]); i++; continue; }
    m = matchSeq(t, i, PREP);
    if (m) {
      var j = i + m.split(" ").length;
      if (m === "at" && /^\d+$/.test(t[j] || "")) { c.time.push("at " + t[j] + (t[j + 1] === "pm" || t[j + 1] === "am" || t[j + 1] === "o'clock" ? " " + t[j + 1] : "")); i = j + 1 + (t[j + 1] && /^(am|pm|o'clock)$/.test(t[j + 1]) ? 1 : 0); continue; }
      var tm = matchSeq(t, j, TIME_KEYS);
      if (tm) { c.time.push(tm); i = j + tm.split(" ").length; continue; }
      if (t[j] === "here" || t[j] === "there") { c.pps.push({ prep: m, place: t[j] }); i = j + 1; continue; }
      var np2 = parseNP(t, j);
      if (np2) { c.pps.push({ prep: m, np: np2 }); i = np2.end; continue; }
      i = j; continue;
    }
    if (t[i] === "not") { c.neg = true; i++; continue; }
    var extra = parseNP(t, i);
    if (extra && extra.end > i) {
      if (!c.obj && !c.cop) c.obj = extra; else c.extra = (c.extra || []).concat([extra]);
      i = extra.end; continue;
    }
    i++;
  }
  return c;
}

function particleFor(pp, c, verbW) {
  var p = pp.prep, np = pp.np, head = np && np.parts && np.parts[np.parts.length - 1];
  var g = head && head.w ? firstGloss(head) : "";
  var vb = verbW ? verbW.w : "";
  var exist = c.cop || c.exist || EXIST.indexOf(vb) >= 0 || /住む$|泊まる$|いる$|ある$/.test(vb);
  var motion = MOTION.some(function (m) { return vb.indexOf(m) >= 0 || (verbW && verbW.r && verbW.r.indexOf(m) >= 0); }) || /行く$|来る$|帰る$|乗る$|着く$|入る$|戻る$/.test(vb);
  var vehicle = /^(train|bus|taxi|car|subway|plane|bike|bicycle|boat|ship|metro|bullet train|electric train)$/.test(g);
  var person = np && (np.person || np.pron);
  switch (p) {
    case "in": case "at": case "on": case "inside":
      if (vehicle && motion) return "で";
      if (exist || motion) return p === "inside" ? "の中に" : "に";
      return p === "inside" ? "の中で" : "で";
    case "to": case "into": case "onto": case "towards": case "toward": return motion ? "に" : (person ? "に" : "に");
    case "from": return "から";
    case "until": case "till": return "まで";
    case "with": return person ? "と" : (/^(card|chopsticks|cash|credit card|fork|spoon|hand|hands)$/.test(g) ? "で" : "と");
    case "without": return "なしで";
    case "for": return person ? "のために" : "に";
    case "by": return "で";
    case "about": return "について";
    case "near": case "close to": case "beside": return exist ? "の近くに" : "の近くで";
    case "next to": return exist ? "の隣に" : "の隣で";
    case "in front of": return exist ? "の前に" : "の前で";
    case "behind": return exist ? "の後ろに" : "の後ろで";
    case "under": return exist ? "の下に" : "の下で";
    case "over": case "above": case "on top of": return exist ? "の上に" : "の上で";
    case "outside": return exist ? "の外に" : "の外で";
    case "around": return "の周りで";
    case "after": return "の後で";
    case "before": return "の前に";
    case "during": return "中に";
    case "like": return "みたいな";
    case "than": return "より";
    case "via": case "through": return "を通って";
    case "because of": return "のせいで";
    case "instead of": return "の代わりに";
    case "out of": return "から";
    case "of": return "の";
  }
  return "で";
}
var PRT_R = { "は": "wa", "を": "o", "へ": "e" };
if (typeof Object.assign !== "function") Object.assign = function (t) { for (var k = 1; k < arguments.length; k++) { var s = arguments[k]; for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p]; } return t; };
function seg(w, r, kind) { return { w: w, r: r, kind: kind || "w" }; }

function placeWord(place, exist, motion) {
  var b = place === "here" ? ["ここ", "ここ"] : place === "there" ? ["そこ", "そこ"] : place === "over there" ? ["あそこ", "あそこ"] : ["家", "いえ"];
  return seg(b[0], b[1]).w ? [seg(b[0], b[1]), seg(exist || motion ? "に" : "で", exist || motion ? "に" : "で", "p")] : [];
}

function genClause(c, casual) {
  var out = [], notes = [], unknown = [];
  var polite = !casual;
  function pushNP(np) { var x = renderNP(np, casual); if (!x) return null; (np.unknown || []).forEach(function (u) { unknown.push(u); }); out.push(seg(x.w, x.r)); return x; }
  function prt(p) { out.push(seg(p, p, "p")); }
  // interjections
  c.interj.forEach(function (k) { var v = INTERJ[k]; var s = casual ? v[0] : v[1]; if (s) { out.push(seg(s, INTERJ_R[s] || s)); out.push(seg("、", "", "x")); } });
  // time
  c.time.forEach(function (k) {
    if (TIME[k]) { out.push(seg(TIME[k][0], TIME[k][1])); return; }
    var m = k.match(/^at (\d+)\s*(am|pm|o'clock)?$/);
    if (m) { var n = parseInt(m[1], 10); var pre = m[2] === "pm" ? ["午後", "ごご"] : m[2] === "am" ? ["午前", "ごぜん"] : ["", ""]; out.push(seg(pre[0] + n + "時", pre[1] + n + "じ")); prt("に"); }
  });

  // ---- normalisations
  if (c.q && !c.modal && c.verb && /^(speak|read|understand)$/.test(c.verb.lemma) && c.subj && c.subj.pron === "you") c.modal = "can";
  if (c.qword === "where" && c.cop && !c.pnp && !c.padj && c.subj && c.subj.pron && /^(you|he|she|they|we|me)$/.test(c.subj.pron)) { c.cop = false; c.existLoc = true; c.forceIru = true; }
  if (c.modal === "can" && c.subj && (c.subj.pron === "me" || c.subj.pron === "we") && (c.have || (c.verb && /^(have|get)$/.test(c.verb.lemma)))) { c.canHave = true; }
  if (c.have && c.modal === "will" && c.subj && c.subj.pron === "me" && c.obj) c.order = true;
  if (c.have && c.pps.length) c.pps = c.pps.filter(function (pp) {
    var colE = pp.np && (pp.np.adjOnly ? pp.np.adjs[0].e : (pp.np.parts.length === 1 && pp.np.parts[0].w && (aclass(pp.np.parts[0]) || /^(緑|紫|ピンク|オレンジ|グレー|金色|銀色|紺|ベージュ|水色)$/.test(pp.np.parts[0].w)) ? pp.np.parts[0] : null));
    if (pp.prep === "in" && colE) {
      var col = colorNoun(colE), base = c.obj ? renderNP(c.obj, casual) : null;
      c.obj = { raw: { w: (base ? base.w + "の" : "") + col.w, r: (base ? base.r + "|の|" : "") + col.r } };
      return false;
    }
    return true;
  });
  if (c.cop && !c.padj && !c.pnp && c.pps.length === 1 && c.pps[0].prep === "from" && c.pps[0].np) {
    var fx = renderNP(c.pps[0].np, casual); (c.pps[0].np.unknown || []).forEach(function (u) { unknown.push(u); });
    out.push(seg(fx.w + "出身", fx.r + "|しゅっしん"));
    if (c.q) out.push(seg(casual ? "？" : "ですか？", casual ? "" : "|ですか", casual ? "x" : "w")); else out.push(seg(casual ? "だよ" : "です", casual ? "だ|よ" : "です"));
    return { segs: out, unknown: unknown };
  }
  // ---- predicate word
  var V = null, kind = null; // kind: verb | adj | na | noun | st
  if (c.verb) { V = wordOf(c.verb.e); kind = "verb"; }
  if (c.goDo) { var gd = wordOf(c.goDo.e); var stem = gd.c === "vs" ? { w: cut(gd.w, 2), r: cut(gd.r, 2) } : verbForm(gd, "stem"); out.push(seg(stem.w + "に", stem.r + "に")); V = W("行く", "いく", "v5k-s"); kind = "verb"; }
  if (c.have) { var animate = c.obj && (c.obj.person || (c.obj.pron && /^(he|she|they|you|me|we)$/.test(c.obj.pron))); V = animate ? W("いる", "いる", "v1") : W("ある", "ある", "v5r-i"); kind = "verb"; c.ga = true; }
  if (c.forceIru) { V = W("いる", "いる", "v1"); kind = "verb"; }
  if (c.exist) { var anim2 = c.pnp && (c.pnp.person || c.pnp.pron); V = anim2 ? W("いる", "いる", "v1") : W("ある", "ある", "v5r-i"); kind = "verb"; }
  if (c.wantNoun) { V = W("欲しい", "ほしい", "adj-i"); kind = "adj"; c.ga = true; if (c.neg) { V = W("いる", "いる", "v5r"); kind = "verb"; } }
  if (c.needNoun) { V = W("必要", "ひつよう", "adj-na"); kind = "na"; c.ga = true; if (c.neg) { V = W("いる", "いる", "v5r"); kind = "verb"; } }
  if (c.likeNoun) { var L = { like: ["好き", "すき"], love: ["大好き", "だいすき"], hate: ["嫌い", "きらい"], enjoy: ["好き", "すき"] }[c.likeNoun] || ["好き", "すき"]; V = W(L[0], L[1], "adj-na"); kind = "na"; c.ga = true; }
  if (c.missYou) { c.subj = null; V = W("会う", "あう", "v5u"); kind = "verb"; c.modal = "want"; }
  if (c.cop && c.padj) { var ae = c.padj.e; if (has(ae.p, "st")) { V = wordOf(ae); kind = "st"; } else { var ac = aclass(ae); V = W(ae.w, ae.r, ac === "adj-ix" ? "adj-ix" : ac === "adj-i" ? "adj-i" : "adj-na"); kind = ac === "adj-i" || ac === "adj-ix" ? "adj" : "na"; if (vclass(ae)) { V = wordOf(ae); kind = "verb"; } } }
  if (c.cop && !c.padj && (c.pnp || c.qword === "what" || c.qword === "who" || c.qword === "where" || c.qword === "how much" || c.qword === "when" || c.qword === "how")) kind = kind || "noun";
  if (c.cop && !kind && (c.pplace || c.pps.length)) { V = (c.subj && (c.subj.person || c.subj.pron && c.subj.pron !== "it" && c.subj.pron !== "this" && c.subj.pron !== "that")) ? W("いる", "いる", "v1") : W("ある", "ある", "v5r-i"); kind = "verb"; c.existLoc = true; }
  if (c.verb && c.verb.lemma === "give" && c.iobj === "me") { V = W("くれる", "くれる", "v1"); }
  if (c.verb && c.verb.lemma === "tell" && c.iobj === "me") { V = W("教える", "おしえる", "v1"); }

  // ---- bare noun phrase requests: "water please", "I would like a coffee", "I'll have the ramen"
  var bare = !kind && !c.cop && !c.exist && (c.subj || c.obj) && !c.qword;
  if (c.order || bare) {
    var np0 = c.order ? c.obj : (c.obj || c.subj);
    var nx = renderNP(np0.num ? Object.assign({}, np0, { noNum: true }) : np0, casual);
    (np0.unknown || []).forEach(function (u) { unknown.push(u); });
    out.push(seg(nx.w, nx.r));
    if (c.order) { prt("に"); out.push(seg(casual ? "する" : "します", casual ? "する" : "します")); return { segs: out, unknown: unknown }; }
    if (!casual) prt("を");
    if (np0.num) { var nj = numJP(np0.num, np0.parts[0], casual); out.push(seg(nj.w, nj.r)); }
    if (c.request || c.modal === "wouldlike" || np0 === c.subj) out.push(seg(casual ? "お願い" : "お願いします", casual ? "おねがい" : "おねがいします"));
    return { segs: out, unknown: unknown };
  }
  // ---- subject
  var sj = c.subj, dropSubj = !sj || sj.pron === "me" || sj.pron === "it" || (c.modal === "should" && /^(we|you)$/.test(sj.pron || "")) || (c.modal === "lets") || (sj.pron === "you" && (c.q || kind !== "verb" || c.request));
  if (c.also && sj && (sj.pron === "me" || sj.pron === "you")) dropSubj = false;
  if (c.qword === "who" && !sj) { out.push(seg("誰", "だれ")); prt("が"); }
  if (!dropSubj && sj) {
    var sx = pushNP(sj);
    var topic = kind !== "verb" || c.neg || c.q || (sj.pron && sj.pron !== "it");
    if (c.also) prt("も");
    else if (casual && topic) { if (c.qword && /^(where|how much|when|how)$/.test(c.qword) && c.cop) prt("は"); }
    else prt(topic ? "は" : "が");
  }

  // ---- PPs & place
  var Vw = V;
  c.pps.forEach(function (pp) {
    if (pp.place) {
      var pw = placeWord(pp.place, c.cop || c.exist, false);
      if (pp.prep === "from") pw[1] = seg("から", "から", "p"); else if (pp.prep === "to" || pp.prep === "until") pw[1] = seg("まで", "まで", "p");
      out.push.apply(out, pw); return;
    }
    var p = particleFor(pp, c, Vw);
    if (pp.np.pron === "me" && /^(with|for)$/.test(pp.prep)) { var me = pronJP("me", casual); out.push(seg(me.w, me.r)); prt(p); return; }
    pushNP(pp.np); if (/^[はがをにでとへもの]$|^から$|^まで$|^より$/.test(p)) prt(p); else out.push(seg(p, p, "p"));
  });
  var isMotion = Vw && /行く$|来る$|帰る$|戻る$|着く$|入る$|乗る$/.test(Vw.w);
  if (c.place && !(c.verb && c.verb.lemma === "go" && c.place === "home")) {
    if (c.place === "home" && isMotion) { out.push(seg("家", "いえ")); prt("に"); }
    else out.push.apply(out, placeWord(c.place, c.cop || c.exist || c.existLoc, isMotion));
  }
  if (c.pplace) { var pl = placeWord(c.pplace, true, false); out.push(pl[0]); if (kind === "verb") out.push(pl[1]); }
  if (c.cop && c.pps.length && kind === "noun" && !c.pnp) { /* "I'm at the station" handled with existLoc */ }

  // ---- qword
  var QW = { what: ["何", "なに"], where: ["どこ", "どこ"], when: ["いつ", "いつ"], who: ["誰", "だれ"], why: casual ? ["なんで", "なんで"] : ["どうして", "どうして"], how: ["どう", "どう"],
    "how much": ["いくら", "いくら"], "how many": ["いくつ", "いくつ"], "how long": ["どのくらい", "どのくらい"], "how far": ["どのくらい遠い", "どのくらいとおい"], "how old": ["何歳", "なんさい"],
    "what time": ["何時", "なんじ"], "what kind of": ["どんな", "どんな"], "which": ["どれ", "どれ"], "which one": ["どれ", "どれ"] };
  var qOnPred = false;
  if (c.qword && c.qword !== "who") {
    var q = QW[c.qword];
    if (c.qnp) {
      var qn = renderNP(c.qnp, casual);
      var pre = c.qword === "which" ? ["どの", "どの"] : c.qword === "how many" ? ["", ""] : ["どんな", "どんな"];
      if (c.qnp.parts[0] && c.qnp.parts[0].w && /^(色|時間)$/.test(c.qnp.parts[0].w) && c.qword === "what") pre = ["何", "なに"];
      out.push(seg(pre[0] + qn.w + (c.qword === "how many" ? "いくつ" : ""), pre[1] + qn.r + (c.qword === "how many" ? "いくつ" : "")));
      if (kind === "verb" && !c.cop) prt(c.ga ? "が" : casual ? "" : "を");
    } else if (c.cop && !c.padj && kind !== "verb") {
      qOnPred = true;
    } else if (kind === "verb" || kind === "st" || c.padj || c.verb) {
      if (c.qword === "how" && kind === "verb") q = ["どうやって", "どうやって"];
      if (c.qword === "where") { var ex = c.existLoc || MOTION.some(function (m) { return Vw && Vw.w.indexOf(m) >= 0; }) || (Vw && /住む|泊まる|いる|ある/.test(Vw.w)); out.push(seg(q[0], q[1])); prt(ex || (Vw && /行く$|来る$|帰る$/.test(Vw.w)) ? "に" : "で"); }
      else if (c.qword === "what" && !c.obj) { out.push(seg(q[0], q[1])); if (!casual) prt("を"); }
      else if (c.qword === "what time") { out.push(seg(q[0], q[1])); prt("に"); }
      else { out.push(seg(q[0], q[1])); }
    } else qOnPred = true;
  }

  // ---- object
  var objParticle = c.ga ? "が" : "を";
  if (V && kind === "verb" && /^(会う|乗る|入る|電話する|連絡する|着く|座る|住む|泊まる|付き合う|参加する)$/.test(V.w)) objParticle = (V.w === "付き合う") ? "と" : "に";
  if (V && kind === "verb" && /^(行く|来る|帰る|戻る)$/.test(V.w)) objParticle = "に";
  if (c.modal === "can" && kind === "verb" && !c.request && !canTe(c)) objParticle = "が"; // 寿司が食べられる, but 写真を撮ってもらえますか
  if (c.modal === "want" && kind === "verb") objParticle = objParticle === "を" ? "を" : objParticle;
  if (c.have && c.q && !casual && !c.qword) objParticle = "は";
  if (c.canHave) objParticle = "を";
  if (c.modal === "should" && c.subj && /^(we|me|you)$/.test(c.subj.pron || "")) { /* suggestion: subject implied */ }
  if (c.verb && c.verb.lemma === "take" && c.obj && c.obj.parts && c.obj.parts[0] && c.obj.parts[0].w && /^(タクシー|電車|バス|地下鉄|新幹線|飛行機|船)$/.test(c.obj.parts[c.obj.parts.length - 1].w)) { V = W("乗る", "のる", "v5r"); Vw = V; objParticle = "に"; }
  if (c.verb && c.verb.lemma === "leave" && c.obj && kind === "verb") { // leave *something*: forget it / check it in / put it
    V = c.past ? W("忘れる", "わすれる", "v1") : (c.modal === "can" || c.aux === "may") ? W("預ける", "あずける", "v1") : W("置く", "おく", "v5k"); Vw = V; objParticle = "を";
  }
  if (c.verb && c.verb.lemma === "call" && c.obj && c.obj.parts && c.obj.parts.length && c.obj.parts[c.obj.parts.length - 1].w && /^(タクシー|警察|救急車|医者|店員|スタッフ|駅員)$/.test(c.obj.parts[c.obj.parts.length - 1].w)) { V = W("呼ぶ", "よぶ", "v5b"); Vw = V; objParticle = "を"; }
  var dropObjP = casual && (objParticle === "を" || objParticle === "が") && !c.pps.length && !c.needNoun;
  function pushObj(o) {
    if (!o) return;
    if (o.pron && (o.pron === "you" || o.pron === "me") && !c.also) return; // drop "you/me" objects
    if (o.num && !casual) {
      pushNP(Object.assign({}, o, { noNum: true })); prt(objParticle);
      var nj2 = numJP(o.num, o.parts[0], casual); out.push(seg(nj2.w, nj2.r)); return;
    }
    var x = pushNP(o);
    if (o === c.obj && c.obj2) { prt("と"); pushNP(c.obj2); }
    if (c.also && !(sj && !dropSubj)) prt("も");
    else if (!dropObjP) prt(objParticle);
  }
  if (c.obj) pushObj(c.obj);
  if (c.cop && !c.exist && c.pnp && !qOnPred) { pushNP(c.pnp); }
  if (c.exist && c.pnp) { pushNP(c.pnp); if (!casual || c.q === false) prt(c.also ? "も" : "が"); }
  if (c.extra) c.extra.forEach(function (x) { pushNP(x); });

  // ---- adverbs
  c.advs.forEach(function (a) {
    if (a === "toomuch") { out.push(seg(casual ? "食べすぎ" : "多すぎ", casual ? "たべすぎ" : "おおすぎ")); return; }
    var d = ADV[a]; if (!d || !d[0]) return;
    if (a === "only") return;
    out.push(seg(casual ? d[0] : d[1], casual ? d[2] : d[3]));
  });
  if (c.intens) { var d2 = ADV[c.intens]; out.push(seg(casual ? d2[0] : d2[1], casual ? d2[2] : d2[3])); }

  // ---- predicate rendering
  var end = c.q ? "？" : "";
  var pred = null;
  if (kind === "noun") {
    if (qOnPred) {
      var qq = QW[c.qword] || ["何", "なに"];
      if (c.qword === "what" && casual) { out.push(seg("って", "って", "p")); out.push(seg("何", "なに")); }
      else { if (!casual && out.length && out[out.length - 1].kind !== "p") prt("は"); out.push(seg(qq[0], qq[1])); }
      pred = casual ? (c.past ? seg("だった", "だった") : null) : seg(c.past ? "でした" : "です", c.past ? "でした" : "です");
      if (!casual) end = "か？";
    } else {
      pred = copula(c, casual);
      if (c.q && !casual) end = "か？";
    }
  } else if (kind === "adj" || kind === "na" || kind === "st") {
    pred = renderAdjPred(V, kind, c, casual);
    if (c.q && !casual) end = "か？";
  } else if (kind === "verb") {
    pred = renderVerbPred(V, c, casual);
    end = pred.end !== undefined ? pred.end : end;
  }
  if (pred && pred.w) out.push(seg(pred.w, pred.r));
  if (!c.q && casual && c.subj && c.subj.pron === "you" && (kind === "adj" || kind === "na")) out.push(seg("ね", "ね", "p"));
  if (end) out.push(seg(end, "", "x"));
  return { segs: out, unknown: unknown };
}
function copula(c, casual) {
  if (c.neg) return casual ? seg(c.past ? "じゃなかった" : "じゃない", c.past ? "じゃ|なかった" : "じゃ|ない") : seg(c.past ? "じゃなかったです" : "じゃないです", c.past ? "じゃ|なかった|です" : "じゃ|ない|です");
  if (casual) return c.q ? null : seg(c.past ? "だった" : "だよ", c.past ? "だった" : "だ|よ");
  return seg(c.past ? "でした" : "です", c.past ? "でした" : "です");
}
function renderAdjPred(V, kind, c, casual) {
  var x, polite = !casual;
  if (kind === "st") {
    if (c.neg) x = add(vstem(V, 4), c.past ? "なかった" : (casual ? "ない" : "いません"), c.past ? "なかった" : (casual ? "ない" : "いません"));
    else x = casual ? (c.past ? add(vstem(V, 4), "た") : vstem(V, 5)) : add(vstem(V, 1), c.past ? "ていました" : "ました");
    if (casual && c.neg) x = add(vstem(V, 4), c.past ? "なかった" : "ない");
    if (casual && c.neg && !c.past) x = { w: vstem(V, 4).w + "ない", r: vstem(V, 4).r + "ない" };
    return x;
  }
  if (kind === "adj") {
    var st = adjStem(V);
    if (c.sugi) { x = add(st, "すぎ"); return casual ? x : add(st, "すぎます"); }
    if (c.neg) x = add(st, c.past ? "くなかった" : "くない");
    else x = c.past ? add(st, "かった") : { w: V.w, r: V.r };
    return polite ? add(x, "です", "|です") : x;
  }
  // na / noun-ish
  if (c.sugi) return casual ? add(V, "すぎ") : add(V, "すぎます");
  if (c.neg) return add(V, casual ? (c.past ? "じゃなかった" : "じゃない") : (c.past ? "じゃなかったです" : "じゃないです"), casual ? (c.past ? "|じゃ|なかった" : "|じゃ|ない") : (c.past ? "|じゃ|なかった|です" : "|じゃ|ない|です"));
  if (casual) return c.past ? add(V, "だった", "|だった") : { w: V.w, r: V.r };
  return add(V, c.past ? "でした" : "です", c.past ? "|でした" : "|です");
}
function canTe(c) { // "can you X?" / "can I X?" become て-form requests (てもらえますか / てもいいですか)
  if (!c.q || !c.subj) return false;
  var lem = c.verb ? c.verb.lemma : "", reqAdv = (c.advs || []).some(function (a) { return /^(slower|slowly|louder|again|faster)$/.test(a); });
  if (c.modal === "can" && c.subj.pron === "you" && (REQUEST_VERBS.test(lem) || c.request || c.iobj || reqAdv) && (reqAdv || !/^(speak|read|eat|drink|swim|drive|understand|use|cook|sing|dance|write)$/.test(lem))) return true;
  if (c.qword && /^(where|how|what|when)$/.test(c.qword)) return false;
  return (c.modal === "can" || c.aux === "may") && (c.subj.pron === "me" || c.subj.pron === "we") && !/^(have|get)$/.test(lem) && !c.have;
}
function renderVerbPred(V, c, casual) {
  var x = V, res;
  var lem = c.verb ? c.verb.lemma : "";
  var state = STATEV[V.w] || STATEV[V.w.replace(/^.*[をにが]/, "")];
  // requests ------------------------------------------------------------
  if (c.modal === "lets") { return casual ? { w: verbForm(x, "vol").w, r: verbForm(x, "vol").r, end: "！" } : { w: verbForm(x, "mashou").w, r: verbForm(x, "mashou").r, end: "！" }; }
  if (c.modal === "letme") { var cs = verbForm(x, "caus"); return casual ? { w: cs.w, r: cs.r, end: "" } : { w: cs.w + "ください", r: cs.r + "ください", end: "" }; }
  if (c.verb && c.verb.lemma === "give" && c.iobj === "me" && (c.request || c.imper || c.modal === "can")) return casual ? { w: "ちょうだい", r: "ちょうだい", end: "" } : { w: "ください", r: "ください", end: "" };
  if (c.imper || (c.request && !c.subj)) {
    if (c.neg) { var nt = verbForm(x, "negte"); return casual ? { w: nt.w, r: nt.r, end: "" } : { w: nt.w + "ください", r: nt.r + "|ください", end: "" }; }
    var te = verbForm(x, "te"); return casual ? { w: te.w, r: te.r, end: "" } : { w: te.w + "ください", r: te.r + "|ください", end: "" };
  }
  var reqAdv = c.advs.some(function (a) { return /^(slower|slowly|louder|again|faster)$/.test(a); });
  if (c.modal === "can" && c.q && c.subj && c.subj.pron === "you" && (REQUEST_VERBS.test(lem) || c.request || c.iobj || reqAdv) && (reqAdv || !/^(speak|read|eat|drink|swim|drive|understand|use|cook|sing|dance|write)$/.test(lem))) {
    var te2 = verbForm(x, "te"); return casual ? { w: te2.w + "くれる", r: te2.r + "|くれる", end: "？" } : { w: te2.w + "もらえますか", r: te2.r + "|もらえますか", end: "？" };
  }
  if (c.modal === "can" && c.qword && /^(where|how|what|when)$/.test(c.qword)) { /* ability question: fall through to potential */ }
  else if ((c.modal === "can" || c.aux === "may") && c.q && c.subj && (c.subj.pron === "me" || c.subj.pron === "we")) {
    if (/^(have|get)$/.test(lem) || c.have) return { w: casual ? "もらえる" : "もらえますか", r: casual ? "もらえる" : "もらえますか", end: "？" };
    var te3 = verbForm(x, "te"); return casual ? { w: te3.w + "もいい", r: te3.r + "|も|いい", end: "？" } : { w: te3.w + "もいいですか", r: te3.r + "|も|いい|ですか", end: "？" };
  }
  if (c.modal === "wouldlike" && c.verb) c.modal = "want";
  if (c.modal === "wouldlike" && !c.verb) return casual ? { w: "お願い", r: "おねがい", end: "" } : { w: "お願いします", r: "おねがいします", end: "" };
  if (c.modal === "should") {
    var ta = verbForm(x, c.neg ? "neg" : "past");
    var tail = c.neg ? "方がいい" : "方がいい";
    return { w: ta.w + tail + (c.q ? "" : casual ? "よ" : "ですよ") + (c.q && !casual ? "ですか" : ""), r: ta.r + "|ほう|が|いい" + (c.q ? "" : casual ? "|よ" : "|ですよ") + (c.q && !casual ? "|ですか" : ""), end: c.q ? "？" : "" };
  }
  if (c.modal === "must") { var mu = verbForm(x, casual ? "must" : "mustp"); return { w: mu.w, r: mu.r, end: c.q ? "？" : "" }; }
  if (c.modal === "like") {
    var lk = c.likeWord === "love" ? ["大好き", "だいすき"] : ["好き", "すき"];
    var base = verbForm(x, "dict"); var pr = { w: base.w + "のが" + lk[0], r: base.r + "のが" + lk[1] };
    return casual ? { w: pr.w + (c.neg ? "じゃない" : ""), r: pr.r + (c.neg ? "じゃない" : ""), end: c.q ? "？" : "" } : { w: pr.w + (c.neg ? "じゃないです" : "です") + (c.q ? "か" : ""), r: pr.r + (c.neg ? "じゃないです" : "です") + (c.q ? "か" : ""), end: c.q ? "？" : "" };
  }
  // derivations ---------------------------------------------------------
  if (c.modal === "want") x = toTai(x);
  else if (c.modal === "can") x = toPot(x, casual);
  else if (c.modal === "try") x = toTe(x, "みる");
  if ((c.prog || state) && x.c !== "adj-i" && !(x.c === "v5r-i") && !/行く$|来る$|帰る$/.test(x.w) && !(state && c.neg && /知る$/.test(x.w))) x = toTe(x, "いる");
  // final ---------------------------------------------------------------
  var q = c.q, wh = !!c.qword;
  if (x.c === "adj-i") {
    var st = adjStem(x);
    res = c.neg ? add(st, c.past ? "くなかった" : "くない") : c.past ? add(st, "かった") : { w: x.w, r: x.r };
    if (!casual) res = add(res, "です" + (q ? "か" : ""), "|です" + (q ? "か" : ""));
    else if (q && wh) res = add(res, "の", "|の");
    return { w: res.w, r: res.r, end: q ? "？" : "" };
  }
  var form = casual ? (c.neg ? (c.past ? "pastneg" : "neg") : (c.past ? "past" : "dict")) : (c.neg ? (c.past ? "masendeshita" : "masen") : (c.past ? "mashita" : "masu"));
  res = verbForm(x, form);
  if (casual && x.prog) res = map2(res, function (s) { return s.replace(/ていた$/, "てた").replace(/ている$/, "てる").replace(/ていない$/, "てない").replace(/ていなかった$/, "てなかった").replace(/でいる$/, "でる").replace(/でいた$/, "でた").replace(/でいない$/, "でない"); });
  if (!casual && q) res = add(res, "か");
  if (casual && q && wh) res = add(res, "の", "|の");
  return { w: res.w, r: res.r, end: q ? "？" : "" };
}

function renderSegs(segs) {
  var w = "", ro = [], prev = null;
  segs.forEach(function (s) {
    w += s.w;
    if (s.kind === "x") {
      var core = s.w.replace(/[、？！。]+$/, ""), pun = s.w.slice(core.length).replace(/、/g, ",").replace(/？/g, "?").replace(/！/g, "!").replace(/。/g, "");
      if (core) ro.push(romaji(core) + pun); else if (ro.length) ro[ro.length - 1] += pun; // "か？" -> "ka?" (was dropped, so questions read as statements)
      return;
    }
    var r = s.kind === "p" ? (PRT_R[s.w] || (s.w.length > 1 && s.w[0] === "の" ? "no " + romaji(s.w.slice(1)) : romaji(s.r))) : romaji(s.r || s.w);
    if (r) ro.push(r);
  });
  return { jp: w, ro: ro.join(" ").replace(/\s+([?,!])/g, "$1") };
}

function roParts(r) { // "なまえ|は？" -> "namae wa?" (particles read as particles)
  return r.split("|").map(function (p) { var core = p.replace(/[？！、。]+$/, ""), pun = p.slice(core.length); return (PRT_R[core] || (/^(に|で|と|へ|から|まで)は$/.test(core) ? romaji(core.slice(0, -1)) + " wa" : romaji(core))) + pun; }).join(" ")
    .replace(/？/g, "?").replace(/！/g, "!").replace(/、/g, ",").replace(/。/g, ".").replace(/\s+([?!,.])/g, "$1");
}
// special whole-sentence patterns (before parsing)
var SPECIAL = [
  [/^wait a (minute|moment|second|sec|bit)$/, ["ちょっと待って", "ちょっと|まって"], ["ちょっと待ってください", "ちょっと|まって|ください"]],
  [/^hurry( up)?$/, ["急いで！", "いそいで！"], ["急いでください", "いそいで|ください"]],
  [/^what does (this|it) mean$/, ["これどういう意味？", "これ|どういう|いみ？"], ["これはどういう意味ですか？", "これ|は|どういう|いみ|ですか？"]],
  [/^what does that mean$/, ["それどういう意味？", "それ|どういう|いみ？"], ["それはどういう意味ですか？", "それ|は|どういう|いみ|ですか？"]],
  [/^see you tomorrow$/, ["また明日！", "また|あした！"], ["また明日", "また|あした"]],
  [/^see you (later|soon)$/, ["また後でね！", "また|あとで|ね！"], ["また後で", "また|あとで"]],
  [/^no,? thanks?( you)?$/, ["大丈夫、ありがと", "だいじょうぶ、|ありがと"], ["結構です、ありがとうございます", "けっこう|です、|ありがとう|ございます"]],
  [/^i need help$/, ["助けて！", "たすけて！"], ["助けてください！", "たすけて|ください！"]],
  [/^(i want to )?check ?out( please)?$/, ["チェックアウトお願いします", "ちぇっくあうと|おねがいします"], ["チェックアウトをお願いします", "ちぇっくあうと|を|おねがいします"]],
  [/^is this seat (taken|free|available|open)$/, ["この席空いてる？", "この|せき|あいてる？"], ["この席は空いていますか？", "この|せき|は|あいて|いますか？"]],
  [/^it hurts$/, ["痛い！", "いたい！"], ["痛いです", "いたい|です"]],
  [/^how are you( doing)?$/, ["元気？", "げんき？"], ["お元気ですか？", "お|げんき|ですか？"]],
  [/^what is up$|^sup$|^wassup$|^whats up$/, ["最近どう？", "さいきん|どう？"], ["最近どうですか？", "さいきん|どう|ですか？"]],
  [/^what time is it( now)?$/, ["今何時？", "いま|なんじ？"], ["今何時ですか？", "いま|なんじ|ですか？"]],
  [/^where are you from$/, ["どこから来たの？", "どこ|から|きたの？"], ["どちらから来ましたか？", "どちら|から|きましたか？"]],
  [/^how old are you$/, ["何歳？", "なんさい？"], ["何歳ですか？", "なんさい|ですか？"]],
  [/^what is your name$/, ["名前は？", "なまえ|は？"], ["お名前は何ですか？", "お|なまえ|は|なん|ですか？"]],
  [/^(i love you)$/, ["大好きだよ", "だいすき|だよ"], ["大好きです", "だいすき|です"]],
  [/^(let me know)$/, ["教えて", "おしえて"], ["教えてください", "おしえて|ください"]],
  [/^(good job|well done|nice)$/, ["いいね！", "いいね！"], ["いい|ですね！", "いい|ですね！"]],
  [/^(i do not know)$/, ["わかんない", "わかんない"], ["わかりません", "わかりません"]],
  [/^(i see|got it|understood)$/, ["なるほど", "なるほど"], ["わかりました", "わかりました"]],
  [/^(no problem|no worries)$/, ["大丈夫だよ", "だいじょうぶ|だよ"], ["大丈夫です", "だいじょうぶ|です"]],
  [/^(see you|see ya|bye|goodbye|later)$/, ["またね！", "またね！"], ["さようなら", "さようなら"]],
  [/^(good morning)$/, ["おはよ", "おはよ"], ["おはようございます", "おはよう|ございます"]],
  [/^(good night)$/, ["おやすみ", "おやすみ"], ["おやすみなさい", "おやすみ|なさい"]],
  [/^(cheers)$/, ["乾杯！", "かんぱい！"], ["乾杯！", "かんぱい！"]],
  [/^how long (does|will) it take$/, ["どのくらいかかる？", "どのくらい|かかる？"], ["どのくらいかかりますか？", "どのくらい|かかりますか？"]],
  [/^i have a headache$/, ["頭痛い", "あたま|いたい"], ["頭が痛いです", "あたま|が|いたい|です"]],
  [/^i have a stomach ?ache$/, ["お腹痛い", "おなか|いたい"], ["お腹が痛いです", "おなか|が|いたい|です"]],
  [/^i have a fever$/, ["熱がある", "ねつ|が|ある"], ["熱があります", "ねつ|が|あります"]],
  [/^i have a cold$/, ["風邪ひいた", "かぜ|ひいた"], ["風邪をひきました", "かぜ|を|ひきました"]],
  [/^(sorry|i am sorry),? (i am|for being) late$/, ["遅れてごめん", "おくれて|ごめん"], ["遅れてすみません", "おくれて|すみません"]],
  [/^what do you recommend$/, ["おすすめは？", "おすすめ|は？"], ["おすすめは何ですか？", "おすすめ|は|なん|ですか？"]],
  [/^(thank you|thanks)( (so|very) much| a lot)?$/, ["マジでありがと！", "まじで|ありがと！"], ["本当にありがとうございます", "ほんとうに|ありがとう|ございます"]],
  [/^(do not worry|no need to worry)( about it)?$/, ["気にしないで", "き|に|しないで"], ["気にしないでください", "き|に|しないで|ください"]],
  [/^(what time is it)$/, ["今何時？", "いま|なんじ？"], ["今何時ですか？", "いま|なんじ|ですか？"]],
  [/^(be careful)$/, ["気をつけて", "き|を|つけて"], ["気をつけてください", "き|を|つけて|ください"]],
  [/^(how much)$/, ["いくら？", "いくら？"], ["いくらですか？", "いくら|ですか？"]],
  [/^(i am sorry|sorry|i am so sorry)$/, ["ごめん", "ごめん"], ["すみません", "すみません"]],
  [/^(help|help me)$/, ["助けて！", "たすけて！"], ["助けてください！", "たすけて|ください！"]],
  [/^(i am full)$/, ["お腹いっぱい", "おなか|いっぱい"], ["お腹いっぱいです", "おなか|いっぱい|です"]],
  [/^(it is delicious|so good|so delicious|yummy|this is so good)$/, ["うまっ！", "うまっ！"], ["とても美味しいです", "とても|おいしい|です"]]
];
function allergic(s, casual) {
  var m = s.match(/^i am allergic to (.+)$/) || s.match(/^i have an? (.+) allergy$/);
  if (!m) return null;
  var np = parseNP(tokens(m[1]), 0); if (!np) return null;
  var x = renderNP(np, casual);
  return { jp: x.w + (casual ? "アレルギーなんだ" : "アレルギーがあります"), r: x.r + (casual ? "|あれるぎー|なんだ" : "|あれるぎー|が|あります"), unknown: np.unknown };
}
function firstTime(s, casual) {
  var m = s.match(/^(?:this is )?my first time (?:in|at) (.+)$/); if (!m) return null;
  var np = parseNP(tokens(m[1]), 0); if (!np) return null; var x = renderNP(np, casual);
  return { jp: x.w + (casual ? "初めて！" : "は初めてです"), r: x.r + (casual ? "|はじめて！" : "|は|はじめて|です"), unknown: np.unknown };
}
function howToGet(s, casual) {
  var m = s.match(/^how (?:do|can|should) (?:i|we) (?:get|go) to (?:the )?(.+)$/);
  if (!m) return null;
  var np = parseNP(tokens(m[1]), 0); if (!np) return null;
  var x = renderNP(np, casual);
  return { jp: x.w + (casual ? "ってどうやって行けばいい？" : "にはどうやって行けばいいですか？"), r: x.r + (casual ? "|って|どうやって|いけば|いい？" : "|には|どうやって|いけば|いい|ですか？"), unknown: np.unknown };
}

function bodyAndAge(s, casual) { // "my head hurts", "my bag was stolen", "i am 21 (years old)"
  var m = s.match(/^i am (\d{1,3})( years old)?$/);
  if (m) return { jp: m[1] + (casual ? "歳だよ" : "歳です"), r: m[1] + "|さい|" + (casual ? "だよ" : "です") };
  m = s.match(/^my (.+?) (hurts?|is hurting|aches?|is sore)$/) || s.match(/^i have a pain in my (.+)$/);
  var np, x;
  if (m) { np = parseNP(tokens(m[1]), 0); if (!np) return null; x = renderNP(np, casual); return { jp: x.w + (casual ? "が痛い" : "が痛いです"), r: x.r + "|が|いたい" + (casual ? "" : "|です"), unknown: np.unknown }; }
  m = s.match(/^my (.+?) (was|got|has been) stolen$/) || s.match(/^someone stole my (.+)$/);
  if (m) { np = parseNP(tokens(m[1]), 0); if (!np) return null; x = renderNP(np, casual); return { jp: x.w + (casual ? "を盗まれた" : "を盗まれました"), r: x.r + "|を|ぬすまれ" + (casual ? "た" : "ました"), unknown: np.unknown }; }
  return null;
}
function splitClauses(t) { // split on conjunctions followed by a new subject
  var res = [], cur = [], conj = [];
  for (var i = 0; i < t.length; i++) {
    var w = t[i];
    var nx = t[i + 1];
    if (/^(and|but|because|so|then|or)$/.test(w) && cur.length && nx && ((PRON[nx] && !PRON[nx].poss && !PRON[nx].obj) || nx === "then" || nx === "there" || nx === "let" || (w === "but" && nx !== "not") || (/^(because|so)$/.test(w) && !/^(much|many|good|bad|cute|nice|fun|big|small|far|tired|hungry|sorry)$/.test(nx)))) {
      res.push(cur); conj.push(w); cur = []; if (t[i + 1] === "then") i++; continue;
    }
    cur.push(w);
  }
  if (cur.length) res.push(cur);
  return { clauses: res, conj: conj };
}
var CONJ_JP = { but: [["けど、", "けど、"], ["が、", "が、"]], because: [["から、", "から、"], ["から、", "から、"]], so: [["から、", "から、"], ["ので、", "ので、"]], and: [["、", "、"], ["。そして", "。そして"]], then: [["、それから", "、それから"], ["。それから", "。それから"]], or: [["、それとも", "、それとも"], ["。それとも", "。それとも"]] };

E.enToJa = function (text, tone) {
  if (!D) return null;
  var casual = (tone || E.opts.tone) !== "polite";
  var sentences = text.replace(/([.!?])\s+/g, "$1\n").split(/\n+/).filter(function (s) { return s.trim(); });
  var allJp = [], allRo = [], unknown = [], words = [];
  sentences.forEach(function (sent) {
    var q = /\?\s*$/.test(sent), ex = /!\s*$/.test(sent);
    var s = normalizeEN(sent).replace(/[.!?]+$/, "").trim();
    var sp = null;
    for (var k = 0; k < SPECIAL.length; k++) if (SPECIAL[k][0].test(s)) { sp = SPECIAL[k][casual ? 1 : 2]; break; }
    if (sp) { allJp.push(sp[0]); allRo.push(roParts(sp[1])); return; }
    var how = howToGet(s, casual) || allergic(s, casual) || firstTime(s, casual) || bodyAndAge(s, casual);
    if (how) { allJp.push(how.jp); allRo.push(roParts(how.r)); unknown = unknown.concat(how.unknown || []); return; }
    var t = tokens(s);
    var sc = splitClauses(t);
    var parts = sc.clauses.map(function (cl) {
      var c = parseClause(cl);
      if (q && !c.request) c.q = true;
      return genClause(c, casual);
    });
    // "A because B" -> "B から、A"
    var jp = "", ro = [];
    function emit(g) { var r = renderSegs(g.segs); unknown = unknown.concat(g.unknown); return r; }
    if (sc.conj.length === 1 && sc.conj[0] === "because") {
      var b = emit(parts[1]), a = emit(parts[0]);
      jp = b.jp.replace(/[？！]$/, "") + (casual ? "から、" : "ので、") + a.jp; ro = [b.ro.replace(/[?!]$/, ""), casual ? "kara," : "node,", a.ro];
    } else {
      parts.forEach(function (g, idx) {
        var r = emit(g);
        if (idx > 0) { var cj = CONJ_JP[sc.conj[idx - 1]] || CONJ_JP.and; var cc = cj[casual ? 0 : 1]; jp = jp.replace(/[？！]$/, "") + cc[0]; ro.push(romaji(cc[1]).replace("、", ",").replace("。", ".")); }
        jp += r.jp; ro.push(r.ro);
      });
    }
    if (ex && !/[！？]$/.test(jp)) jp += "！";
    allJp.push(jp); allRo.push(ro.join(" ").replace(/\s+,/g, ","));
  });
  return { jp: allJp.join(casual ? " " : "").replace(/ $/, ""), ro: allRo.join(" ").replace(/？/g, "?").replace(/！/g, "!").replace(/、/g, ",").replace(/(desu|masu|deshou|mashou|mashita|deshita|masen)ka(?=[?!.,\s]|$)/g, "$1 ka"), unknown: unknown };
};

/* ------------------------------------------------------------------ JP -> EN */
var PARTICLES = ["から", "まで", "より", "って", "けど", "には", "では", "とは", "へは", "にも", "でも", "とか", "だけ", "しか", "ので", "のに", "は", "が", "を", "に", "で", "と", "も", "へ", "の", "や", "か", "ね", "よ", "な", "わ", "さ", "ぞ", "ぜ"];
var ENDERS = ["ですか", "でしょうか", "でしょう", "ですね", "ですよ", "でしたか", "でした", "です", "だった", "だよね", "だよ", "だね", "だ", "じゃない", "じゃなかった", "ではない", "ではありません", "じゃありません", "かな", "よね", "じゃん", "んですか", "んです", "んだ", "のか", "の", "ね", "よ", "か", "な", "わ", "っけ", "かも"];
var DEIN = [];
(function () {
  var rows = { "う": ["わ", "い", "え", "お", "って", "った"], "く": ["か", "き", "け", "こ", "いて", "いた"], "ぐ": ["が", "ぎ", "げ", "ご", "いで", "いだ"], "す": ["さ", "し", "せ", "そ", "して", "した"],
    "つ": ["た", "ち", "て", "と", "って", "った"], "ぬ": ["な", "に", "ね", "の", "んで", "んだ"], "ぶ": ["ば", "び", "べ", "ぼ", "んで", "んだ"], "む": ["ま", "み", "め", "も", "んで", "んだ"], "る": ["ら", "り", "れ", "ろ", "って", "った"] };
  var I = [["ます", "polite"], ["ました", "past polite"], ["ません", "neg polite"], ["ませんでした", "pastneg polite"], ["ましょう", "lets"], ["ましょうか", "shall"], ["たい", "want"], ["ながら", "while"], ["そう", "looks"], ["なさい", "imper"], ["すぎる", "toomuch"], ["すぎ", "toomuch"], ["まして", "te"], ["に", "purpose"]];
  Object.keys(rows).forEach(function (b) {
    var r = rows[b];
    DEIN.push([r[0] + "ない", b, "v5", "neg"], [r[0] + "なきゃ", b, "v5", "must"], [r[0] + "なくちゃ", b, "v5", "must"], [r[0] + "ないで", b, "v5", "negte"], [r[0] + "れる", b, "v5", "passive"], [r[0] + "せる", b, "v5", "caus"], [r[0] + "ず", b, "v5", "neg"]);
    I.forEach(function (x) { DEIN.push([r[1] + x[0], b, "v5", x[1]]); });
    DEIN.push([r[2] + "る", b, "v5", "can"], [r[2] + "ば", b, "v5", "if"], [r[3] + "う", b, "v5", "lets"], [r[4], b, "v5", "te"], [r[5], b, "v5", "past"], [r[5] + "ら", b, "v5", "if"], [r[5] + "り", b, "v5", "and"]);
  });
  DEIN.push(["って", "く", "v5k-s", "te"], ["った", "く", "v5k-s", "past"], ["ったら", "く", "v5k-s", "if"]);
  I.forEach(function (x) { DEIN.push([x[0], "る", "v1", x[1]]); });
  [["ない", "neg"], ["なきゃ", "must"], ["なくちゃ", "must"], ["ないで", "negte"], ["た", "past"], ["て", "te"], ["られる", "can"], ["れる", "can"], ["させる", "caus"], ["よう", "lets"], ["ろ", "imper"], ["れば", "if"], ["たら", "if"], ["ず", "neg"]].forEach(function (x) { DEIN.push([x[0], "る", "v1", x[1]]); });
  [["くない", "neg"], ["かった", "past"], ["くて", "te"], ["く", "adv"], ["ければ", "if"], ["さ", "ness"], ["そう", "looks"], ["すぎる", "toomuch"], ["すぎ", "toomuch"], ["くありません", "neg"], ["かったら", "if"]].forEach(function (x) { DEIN.push([x[0], "い", "adj-i", x[1]]); });
  [["こない", "くる", "neg"], ["きます", "くる", "polite"], ["きました", "くる", "past polite"], ["きません", "くる", "neg polite"], ["きた", "くる", "past"], ["きて", "くる", "te"], ["こられる", "くる", "can"], ["これる", "くる", "can"], ["こよう", "くる", "lets"], ["きたい", "くる", "want"], ["こい", "くる", "imper"],
    ["来ない", "来る", "neg"], ["来ます", "来る", "polite"], ["来ました", "来る", "past polite"], ["来ません", "来る", "neg polite"], ["来た", "来る", "past"], ["来て", "来る", "te"], ["来られる", "来る", "can"], ["来れる", "来る", "can"], ["来よう", "来る", "lets"], ["来たい", "来る", "want"]].forEach(function (x) { DEIN.push([x[0], x[1], "vk", x[2]]); });
  [["しない", "neg"], ["します", "polite"], ["しました", "past polite"], ["しません", "neg polite"], ["しませんでした", "pastneg polite"], ["した", "past"], ["して", "te"], ["しよう", "lets"], ["しましょう", "lets"], ["したい", "want"], ["できる", "can"], ["できます", "can polite"], ["できない", "cannot"], ["できません", "cannot polite"], ["される", "passive"], ["させる", "caus"], ["すれば", "if"], ["しろ", "imper"], ["しなきゃ", "must"], ["しすぎ", "toomuch"]].forEach(function (x) { DEIN.push([x[0], "する", "vs", x[1]]); });
  DEIN.sort(function (a, b) { return b[0].length - a[0].length; });
})();
var TEAUX = [["ていました", "wasprog polite"], ["ています", "prog polite"], ["ていません", "notprog polite"], ["ていない", "notprog"], ["ていた", "wasprog"], ["ている", "prog"], ["てる", "prog"], ["てた", "wasprog"], ["てない", "notprog"],
  ["てください", "please"], ["てくれますか", "canyou"], ["てくれる", "canyou"], ["てくれない", "canyou"], ["てくれ", "please"], ["てもらえますか", "canyou"], ["てもらえませんか", "canyou"], ["てもらえる", "canyou"], ["てもらっていい", "canyou"],
  ["てみたい", "trywant"], ["てみる", "try"], ["てみます", "try"], ["てもいいですか", "mayi"], ["てもいい", "mayi"], ["ていいですか", "mayi"], ["ていい", "mayi"], ["ちゃった", "endpast"], ["ちゃう", "end"], ["ておく", "prep"], ["とく", "prep"]];
TEAUX = TEAUX.concat(TEAUX.filter(function (a) { return a[0][0] === "て"; }).map(function (a) { return ["で" + a[0].slice(1), a[1]]; }));
function typeOK(e, type) {
  if (!e) return false;
  if (type === "v5") return e.p.some(function (p) { return p.indexOf("v5") === 0; }) || (has(e.p, "st") && /^v5/.test(e.p[1] || ""));
  if (type === "v5k-s") return has(e.p, "v5k-s");
  if (type === "v1") return has(e.p, "v1") || (has(e.p, "st") && e.p[1] === "v1");
  if (type === "vk") return has(e.p, "vk");
  if (type === "vs") return has(e.p, "vs-i") || has(e.p, "vs-s");
  if (type === "adj-i") return has(e.p, "adj-i") || has(e.p, "adj-ix");
  return true;
}
function pickEntries(form) {
  var l = JPMAP[form]; if (!l) return [];
  var cs = D.cs || D.e.length;
  return l.map(ent).sort(function (a, b) {
    var ax = a.w === form || a.alts.indexOf(form) >= 0 ? 0 : 1, bx = b.w === form || b.alts.indexOf(form) >= 0 ? 0 : 1;
    if (ax !== bx) return ax - bx;
    var ac = a.i >= cs ? 0 : 1, bc = b.i >= cs ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return a.i - b.i;
  });
}
function findBase(form, type) {
  var l = pickEntries(form);
  for (var k = 0; k < l.length; k++) if (typeOK(l[k], type)) return l[k];
  if (type === "vs" && /する$/.test(form)) { var l2 = pickEntries(cut(form, 2)); for (k = 0; k < l2.length; k++) if (has(l2[k].p, "vs")) { var e2 = l2[k]; return { i: e2.i, w: form, alts: [], r: e2.r + "する", p: ["vs-i"], g: e2.g, vsNoun: e2 }; } }
  return null;
}
function deinflect(s) {
  var out = [], seen = {};
  function walk(word, reasons, depth) {
    if (depth > 3 || seen[word + depth]) return;
    seen[word + depth] = 1;
    for (var k = 0; k < DEIN.length; k++) {
      var r = DEIN[k];
      if (word.length > r[0].length && word.slice(-r[0].length) === r[0]) {
        var base = word.slice(0, word.length - r[0].length) + r[1];
        var rs = reasons.concat([r[3]]);
        var e = findBase(base, r[2]);
        if (e) out.push({ e: e, reasons: rs, base: base });
        if (/[いるうくぐすつぬぶむ]$/.test(base)) walk(base, rs, depth + 1);
      }
    }
    for (k = 0; k < TEAUX.length; k++) {
      var a = TEAUX[k];
      if (word.length > a[0].length && word.slice(-a[0].length) === a[0]) {
        var stem = word.slice(0, word.length - a[0].length);
        var te = stem + (a[0][0] === "で" ? "で" : a[0][0] === "ち" ? "て" : a[0][0] === "と" ? "て" : "て");
        if (a[0] === "とく") te = stem + "て";
        walk(te, reasons.concat([a[1]]), depth + 1);
      }
    }
  }
  walk(s, [], 0);
  out.sort(function (a, b) { return a.reasons.length - b.reasons.length; });
  return out;
}
var NUM_RE = /^([0-9０-９]+|[一二三四五六七八九十百千万]+)(つ|個|人|枚|本|杯|円|時|分|歳|回|日|階|名|匹|泊|番)?/;
function wordCost(e, L, surf) {
  var cs = D.cs || D.e.length;
  var c = 3 - Math.min(L, 6) * 0.18;
  if (L === 1) c += /[぀-ゟ]/.test(surf) ? 2.5 : 0.6;
  c += e.i >= cs ? -0.3 : Math.min(1.5, e.i / 25000);
  if ((has(e.p, "exp") || has(e.p, "int")) && L > 2 && /[はがをにでとも]$/.test(surf)) c += 1.6;
  return c;
}
function candidatesAt(s, i) {
  var out = [], ch = s[i];
  if (/[\s、。！？!?,.・「」『』（）()～〜…]/.test(ch)) { out.push({ len: 1, cost: 0, tok: { punct: /[？?]/.test(ch) ? "?" : /[！!]/.test(ch) ? "!" : /[、,]/.test(ch) ? "," : /[。.]/.test(ch) ? "." : " " } }); return out; }
  var nm = s.slice(i).match(NUM_RE);
  if (nm && (/[0-9０-９]/.test(nm[1]) || nm[2])) out.push({ len: nm[0].length, cost: 1, tok: { num: nm[1], counter: nm[2] || "" } });
  var maxL = Math.min(14, s.length - i);
  for (var L = 1; L <= maxL; L++) {
    var sub = s.substr(i, L);
    var direct = pickEntries(sub);
    if (direct.length) out.push({ len: L, cost: wordCost(direct[0], L, sub), tok: { e: direct[0], surf: sub, reasons: [] } });
    if (/[぀-ゟ]$/.test(sub)) {
      var d = deinflect(sub);
      if (d.length) out.push({ len: L, cost: wordCost(d[0].e, L, sub) + 0.15 * d[0].reasons.length, tok: { e: d[0].e, surf: sub, reasons: d[0].reasons } });
    }
  }
  [ENDERS, PARTICLES].forEach(function (list, li) {
    list.forEach(function (p) { if (s.substr(i, p.length) === p) out.push({ len: p.length, cost: li === 0 ? 0.9 - p.length * 0.05 : 1.0, tok: { prt: p } }); });
  });
  var run = s.slice(i).match(/^[゠-ヿ]+/) || s.slice(i).match(/^[㐀-鿿]{2,4}/) || s.slice(i).match(/^[a-zA-Z0-9]+/);
  if (run) out.push({ len: run[0].length, cost: /^[゠-ヿ]/.test(run[0]) ? 2.5 : /^[a-zA-Z0-9]/.test(run[0]) ? 1 : 3 + run[0].length * 1.1, tok: { unknown: run[0], kata: /^[゠-ヿ]/.test(run[0]) } });
  out.push({ len: 1, cost: 5, tok: { unknown: ch } });
  return out;
}
function segmentJP(s) {
  var n = s.length, best = [{ cost: 0 }];
  for (var i = 0; i < n; i++) {
    if (!best[i]) continue;
    var cands = candidatesAt(s, i);
    for (var k = 0; k < cands.length; k++) {
      var c = cands[k], j = i + c.len, cost = best[i].cost + c.cost;
      if (!best[j] || cost < best[j].cost) best[j] = { cost: cost, prev: i, tok: c.tok };
    }
  }
  var toks = [], p = n;
  while (p > 0 && best[p]) { toks.unshift(best[p].tok); p = best[p].prev; }
  return toks.filter(function (t) { return !(t.punct === " "); });
}
function tokReading(t) {
  if (t.prt) return t.prt;
  if (t.num) return t.num + (t.counter || "");
  if (t.unknown) return t.kata ? toHira(t.unknown) : t.unknown;
  var e = t.e, surf = t.surf, r = e.r.replace(/\|/g, "");
  if (surf === e.w) return r;
  var forms = [e.w].concat(e.alts), best = 0;
  forms.forEach(function (f) { var k = 0; while (k < f.length && k < surf.length && f[k] === surf[k]) k++; if (k > best) best = k; });
  if (/^[぀-ヿ]+$/.test(surf)) return toHira(surf);
  var tailLen = e.w.length - best;
  return r.slice(0, Math.max(0, r.length - tailLen)) + surf.slice(best);
}
E.segment = segmentJP;

var JP_PRON = { "私": "I", "わたし": "I", "あたし": "I", "俺": "I", "おれ": "I", "僕": "I", "ぼく": "I", "うち": "I", "あなた": "you", "君": "you", "きみ": "you", "お前": "you", "おまえ": "you", "彼": "he", "彼女": "she",
  "私たち": "we", "俺たち": "we", "僕たち": "we", "僕ら": "we", "俺ら": "we", "彼ら": "they", "あいつ": "that guy", "あいつら": "those guys", "これ": "this", "それ": "that", "あれ": "that", "ここ": "here", "そこ": "there", "あそこ": "over there", "みんな": "everyone", "皆": "everyone" };
var JP_Q = { "何": "what", "なに": "what", "なん": "what", "どこ": "where", "いつ": "when", "誰": "who", "だれ": "who", "なんで": "why", "なぜ": "why", "どうして": "why", "どう": "how", "どうやって": "how", "いくら": "how much", "いくつ": "how many", "どれ": "which", "どっち": "which", "どちら": "which", "どの": "which", "どんな": "what kind of", "何時": "what time", "何人": "how many people" };
var JP_ADVP = { "一緒に": "together", "本当に": "really", "ほんとに": "really", "すぐに": "right away", "先に": "first", "最初に": "first", "後で": "later", "一人で": "alone", "みんなで": "together", "全部で": "in total", "まじで": "seriously", "マジで": "seriously", "絶対に": "definitely", "特に": "especially", "急に": "suddenly", "普通に": "normally", "たまに": "sometimes", "めっちゃ": "really", "とても": "very", "すごく": "really", "ちょっと": "a little", "少し": "a little", "もう": "already", "まだ": "still", "また": "again", "よく": "often", "いつも": "always", "たぶん": "probably", "ゆっくり": "slowly", "たくさん": "a lot", "全然": "at all", "ぜんぜん": "at all", "もっと": "more", "一番": "the most" };
var JP_TIME = /^(今日|明日|昨日|今|今夜|今晩|今朝|毎日|来週|先週|今週|週末|来月|先月|来年|去年|今年|朝|夜|昼|夕方|午前|午後|後で|あした|きょう|きのう|いま)$/;
var FUTURE = /^(明日|あした|来週|来月|来年|今夜|今晩|後で|週末)$/;
var POSS = { I: "my", you: "your", he: "his", she: "her", we: "our", they: "their", this: "this", that: "that" };
var OBJ = { I: "me", you: "you", he: "him", she: "her", we: "us", they: "them" };
var COUNTER = { "人": "people", "名": "people", "円": "yen", "時": "o'clock", "分": "minutes", "歳": "years old", "回": "times", "日": "days", "泊": "nights", "階": "floor", "杯": "cups" };
var NUMW = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
var GA_OBJ = /^(好き|大好き|嫌い|大嫌い|欲しい|ほしい|わかる|分かる|必要|上手|下手|得意|苦手|できる|出来る)$/;
var PLACE = /^(station|railway station|toilet|bathroom|hotel|airport|restaurant|shop|store|convenience store|exit|entrance|hospital|bank|park|beach|museum|temple|shrine|room|platform|bus stop|counter|front desk|elevator|stairs|supermarket|pharmacy|police box|police|train|bus|taxi|subway|menu|bill|check|wallet|phone)$/;
var REQ_PRED = /^(ください|下さい|お願い|お願いします|おねがい|おねがいします|ちょうだい|頂戴)$/;
function kanjiNum(s) {
  s = s.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  var d = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 }, total = 0, cur = 0;
  for (var i = 0; i < s.length; i++) { var c = s[i]; if (d[c]) cur = d[c]; else if (c === "十") { total += (cur || 1) * 10; cur = 0; } else if (c === "百") { total += (cur || 1) * 100; cur = 0; } else if (c === "千") { total += (cur || 1) * 1000; cur = 0; } else if (c === "万") { total = (total + cur) * 10000; cur = 0; } }
  return total + cur;
}
function glossOf(e) {
  if (JP_PRON[e.w]) return JP_PRON[e.w];
  if (JP_Q[e.w]) return JP_Q[e.w];
  var g = firstGloss(e).replace(/^to /, "");
  return g;
}
function plural(n) { if (/(s|sh|ch|x)$/.test(n)) return n + "es"; if (/[^aeiou]y$/.test(n)) return n.slice(0, -1) + "ies"; if (/(people|sushi|ramen|sake|rice|water|money|cash|fish|food|yen)$/.test(n)) return n; return n + "s"; }
function cap(s) { s = s.replace(/\bi\b/g, "I").replace(/\s+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
function art(n, def) {
  if (!n || /^(a|an|the|my|your|his|her|our|their|this|that|these|those|some|\d|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(n) || /^(I|you|he|she|we|they|it|here|there|everyone|me|him|us|them)$/i.test(n) || /^[A-Z]/.test(n)) return n;
  if (def || PLACE.test(n)) return "the " + n;
  return n;
}

var JP_FIXED = {
  "いらっしゃいませ": "Welcome! (staff greeting — no reply needed)", "いらっしゃいませこんにちは": "Welcome! (staff greeting — no reply needed)",
  "何名様ですか": "How many people?", "何名様でしょうか": "How many people?", "何名様でいらっしゃいますか": "How many people?", "お一人様ですか": "Just one person?", "おひとり様ですか": "Just one person?",
  "喫煙席と禁煙席どちらがよろしいですか": "Smoking or non-smoking?", "おタバコは吸われますか": "Do you smoke?",
  "店内でお召し上がりですか": "Eating here?", "こちらでお召し上がりですか": "Eating here?", "店内でお召し上がりでしょうか": "Eating here?", "お持ち帰りですか": "Takeout?", "テイクアウトですか": "Takeout?",
  "店内ご利用ですか": "Eating here?", "温めますか": "Shall I heat it up?", "お温めしますか": "Shall I heat it up?", "温めましょうか": "Shall I heat it up?", "こちら温めますか": "Shall I heat this up?",
  "袋はご利用ですか": "Do you need a bag?", "袋はいりますか": "Do you need a bag?", "レジ袋はご利用ですか": "Do you need a bag?", "袋お付けしますか": "Do you need a bag?", "袋はご入用ですか": "Do you need a bag?", "袋は有料ですがよろしいですか": "Bags cost extra — is that OK?",
  "お箸はご利用ですか": "Do you need chopsticks?", "お箸お付けしますか": "Do you need chopsticks?", "お箸はおつけしますか": "Do you need chopsticks?", "お箸は何膳ですか": "How many pairs of chopsticks?",
  "ポイントカードはお持ちですか": "Do you have a point card?", "ポイントカードはございますか": "Do you have a point card?",
  "以上でよろしいですか": "Will that be all?", "ご注文は以上でよろしいですか": "Will that be all?", "以上でよろしいでしょうか": "Will that be all?", "ご注文はお決まりですか": "Are you ready to order?",
  "お決まりでしたらお呼びください": "Call us when you've decided.", "お決まりですか": "Have you decided?", "ご利用ですか": "Will you use it? / Do you need it?", "お決まりになりましたらお呼びください": "Call us when you've decided.",
  "少々お待ちください": "Please wait a moment.", "少々お待ちくださいませ": "Please wait a moment.", "お待たせしました": "Sorry to keep you waiting (here you go).", "お待たせいたしました": "Sorry to keep you waiting (here you go).",
  "結構です": "No thank you / I'm fine.", "大丈夫です": "I'm fine / No thanks.", "お会計はご一緒ですか": "Paying together?", "お支払いはご一緒ですか": "Paying together?", "お会計は別々ですか": "Paying separately?", "別々ですか": "Separately?",
  "お支払いは現金ですかカードですか": "Cash or card?", "お支払い方法はいかがなさいますか": "How would you like to pay?", "お支払いはどうなさいますか": "How would you like to pay?",
  "レシートはご利用ですか": "Do you need the receipt?", "レシートはいりますか": "Do you need the receipt?", "レシートご入用ですか": "Do you need the receipt?",
  "ありがとうございました": "Thank you very much!", "またお越しくださいませ": "Please come again!", "またお越しください": "Please come again!", "またのお越しをお待ちしております": "We hope to see you again!",
  "申し訳ございません": "We're very sorry.", "申し訳ありません": "We're very sorry.", "かしこまりました": "Certainly!", "承知しました": "Understood.", "承知いたしました": "Understood.",
  "こちらへどうぞ": "This way, please.", "お席へご案内します": "I'll show you to your seat.", "お好きな席へどうぞ": "Sit anywhere you like.", "お好きなお席へどうぞ": "Sit anywhere you like.",
  "ラストオーダーです": "It's last orders.", "ラストオーダーになります": "It's last orders.", "満席です": "We're full.", "只今満席です": "We're full right now.", "ただいま満席です": "We're full right now.",
  "お名前をお願いします": "Your name, please.", "お名前をいただけますか": "May I have your name?", "パスポートをお願いします": "Your passport, please.", "パスポートを拝見します": "May I see your passport?",
  "こちらにお名前をお書きください": "Please write your name here.", "食券を買ってください": "Please buy a meal ticket from the machine.", "食券をお買い求めください": "Please buy a meal ticket from the machine.", "先に食券をお買い求めください": "Please buy a meal ticket from the machine first.",
  "お通しです": "Here's your otoshi (small starter that comes with the cover charge).", "辛さはどうしますか": "How spicy would you like it?", "辛さはいかがなさいますか": "How spicy would you like it?",
  "麺の硬さはどうしますか": "How firm would you like your noodles?", "麺の固さはどうしますか": "How firm would you like your noodles?", "麺の硬さはいかがなさいますか": "How firm would you like your noodles?",
  "お飲み物はいかがですか": "Would you like something to drink?", "お飲み物はいかがなさいますか": "What would you like to drink?", "お飲み物は何になさいますか": "What would you like to drink?",
  "他にご注文はございますか": "Anything else?", "ご注文は何になさいますか": "What would you like to order?", "以上です": "That's all.", "現金のみです": "Cash only.", "現金のみとなっております": "Cash only.", "カードは使えません": "Cards aren't accepted.",
  "年齢確認をお願いします": "Please confirm your age (tap the screen).", "画面のタッチをお願いします": "Please tap the screen.", "ご予約はされていますか": "Do you have a reservation?", "ご予約ですか": "Do you have a reservation?",
  "お荷物をお預かりしましょうか": "Shall I keep your luggage?", "朝食は何時からですか": "What time is breakfast?", "お気をつけて": "Take care!", "どうぞ": "Here you go / Go ahead.", "どうぞお先に": "After you.", "ここが痛いですか": "Does it hurt here?", "どこが痛いですか": "Where does it hurt?", "どうしましたか": "What's wrong? / What happened?", "どうされましたか": "What's wrong?", "大丈夫ですか": "Are you okay?", "保険証はお持ちですか": "Do you have an insurance card?", "お大事に": "Get well soon / Take care.",
  "お先にどうぞ": "After you.", "こちらでよろしいですか": "Is this one OK?", "サイズはいかがですか": "How's the size?", "ご試着されますか": "Would you like to try it on?", "免税の手続きをしますか": "Shall I do the tax-free procedure?", "パスポートはお持ちですか": "Do you have your passport?"
};
var KEIGO_V = { "持ち": "have it", "召し上がり": "eat", "待ち": "wait", "越し": "come", "掛け": "take a seat", "かけ": "take a seat", "入り": "come in", "使い": "use", "座り": "sit down", "探し": "look for something", "呼び": "call us", "選び": "choose" };
function keigo(s) { // お待ちください -> Please wait; お持ちですか -> Do you have …?; ご利用ですか -> Will you use it?
  var m = s.match(/^[おご](.+?)(?:くださいませ|ください|下さい)$/), r, w;
  if (m && KEIGO_V[m[1]]) return "Please " + KEIGO_V[m[1]] + ".";
  var q = s.match(/^[おご](.+?)(?:です|でしょう)か$/);
  if (q && KEIGO_V[q[1]]) return "Do you " + KEIGO_V[q[1]] + "?";
  if (m) { r = E.jaToEn(m[1] + "ます"); w = r && r.words[0]; if (w && !w.unknown && w.en && w.en !== "?") return "Please " + w.en.replace(/^to /, "").split(/[;,]/)[0] + "."; }
  m = s.match(/^[おご](.+?)(?:です|でしょう)か$/);
  if (m) {
    r = E.jaToEn(m[1] + "ます"); w = r && r.words.length === 1 ? r.words[0] : null;
    if (w && !w.unknown && w.en && w.en !== "?" && w.base && w.base !== w.jp) return "Do you " + w.en.replace(/^to /, "").split(/[;,]/)[0] + "?";
    r = E.jaToEn(m[1]); w = r && r.words.length === 1 ? r.words[0] : null;
    if (w && !w.unknown && w.en && w.en !== "?") return cap(w.en.split(/[;,]/)[0]) + "?";
  }
  return "";
}
E.jaToEn = function (text) {
  if (!D) return null;
  var fx = String(text).replace(/[\s　]+/g, "").replace(/[。！？!?、～〜♪…]+$/, "");
  var kg = JP_FIXED[fx] || keigo(fx);
  if (kg) { var inner = E.jaToEn.raw(text); inner.en = kg; return inner; }
  return E.jaToEn.raw(text);
};
E.jaToEn.raw = function (text) {
  var toks = segmentJP(text.trim());
  var words = [], ro = [];
  toks.forEach(function (t) {
    if (t.punct) { if (ro.length && t.punct !== ",") ro[ro.length - 1] += t.punct; else if (ro.length) ro[ro.length - 1] += ","; return; }
    var r = tokReading(t);
    ro.push(t.prt ? (PRT_R[t.prt] || romaji(t.prt)) : romaji(r));
    if (t.e) words.push({ jp: t.surf, base: t.e.w, r: t.e.r.replace(/\|/g, ""), ro: romaji(t.e.r), en: glossOf(t.e) });
    else if (t.unknown) words.push({ jp: t.unknown, en: t.kata ? romaji(t.unknown) : "?", unknown: true });
    else if (t.num) words.push({ jp: t.num + t.counter, en: String(kanjiNum(t.num)) + (COUNTER[t.counter] ? " " + COUNTER[t.counter] : "") });
  });
  var sents = [], cur = [];
  toks.forEach(function (t) { cur.push(t); if (t.punct === "." || t.punct === "!" || t.punct === "?") { sents.push(cur); cur = []; } });
  if (cur.length) sents.push(cur);
  var en = sents.map(function (s) { try { return jaSentence(s); } catch (err) { return ""; } }).filter(Boolean).join(" ");
  return { en: en, words: words, ro: ro.join(" ").replace(/(desu|masu|deshou|mashou|mashita|deshita|masen)ka(?=[?!.,\s]|$)/g, "$1 ka") };
};

function jaSentence(toks) {
  var q = toks.some(function (t) { return t.punct === "?"; }), excl = toks.some(function (t) { return t.punct === "!"; });
  var items = toks.filter(function (t) { return !t.punct || t.punct === ","; }).filter(function (t) { return !t.punct; });
  if (!items.length) return "";
  // whole-phrase shortcuts (greetings etc.)
  if (items.length === 1 && items[0].e && (has(items[0].e.p, "exp") || has(items[0].e.p, "int"))) return cap(firstGloss(items[0].e)) + (q ? "?" : excl ? "!" : ".");
  var tail = [];
  while (items.length > 1 && items[items.length - 1].prt && ENDERS.indexOf(items[items.length - 1].prt) >= 0) tail.unshift(items.pop().prt);
  tail.forEach(function (p) { if (/^(か|かな|ですか|でしょうか|でしたか|のか|んですか|っけ)$/.test(p) || (p === "の" && q)) q = true; });
  var copNeg = tail.some(function (p) { return /じゃない|ではない|ありません/.test(p); });
  var copPast = tail.some(function (p) { return /でした|だった/.test(p); });
  var predIdx = -1;
  for (var k = items.length - 1; k >= 0; k--) if (!items[k].prt) { predIdx = k; break; }
  if (predIdx < 0) return "";
  var pred = items[predIdx], body = items.slice(0, predIdx);
  // adverbial particle phrases (一緒に etc.) and groups
  var groups = [], cur = [], advs = [], time = [], qword = null;
  for (var b = 0; b < body.length; b++) {
    var t = body[b];
    if (t.e && t.surf && body[b + 1] && body[b + 1].prt && JP_ADVP[t.surf + body[b + 1].prt]) { advs.push(JP_ADVP[t.surf + body[b + 1].prt]); b++; continue; }
    if (t.e && JP_ADVP[t.surf] && !cur.length) { advs.push(JP_ADVP[t.surf]); continue; }
    if (t.e && JP_TIME.test(t.surf || "") && !cur.length) { time.push(t); if (body[b + 1] && body[b + 1].prt === "は") b++; continue; }
    if (t.prt) { groups.push({ ws: cur, p: t.prt }); cur = []; }
    else cur.push(t);
  }
  if (cur.length) groups.push({ ws: cur, p: "" });
  var predBase = pred.e ? pred.e.w : "";
  var R = {};
  (pred.reasons || []).forEach(function (r) { r.split(" ").forEach(function (x) { R[x] = true; }); });
  if (R.pastneg) { R.past = true; R.neg = true; }
  if (R.cannot) { R.can = true; R.neg = true; }
  if (R.notprog) { R.prog = true; R.neg = true; }
  if (R.wasprog) { R.prog = true; R.past = true; }
  if (R.endpast) R.past = true;
  if (R.trywant) { R.try = true; R.want = true; }
  if (copNeg) R.neg = true;
  if (copPast) R.past = true;
  var isReq = REQ_PRED.test(predBase) || REQ_PRED.test(pred.surf || "");
  var isExist = /^(ある|いる|有る|居る|在る)$/.test(predBase) && !R.prog;
  var gaObj = GA_OBJ.test(predBase) || R.want || R.can || isExist;
  // roles
  var subj = null, obj = null, pps = [], extra = [];
  function npText(g) {
    var ws = g.ws, parts = [], num = null, counter = "";
    ws.forEach(function (t) {
      if (t.num) { num = kanjiNum(t.num); counter = t.counter; return; }
      if (t.unknown) { parts.push(t.kata ? romaji(t.unknown) : t.unknown); return; }
      if (t.e && JP_Q[t.surf]) { qword = JP_Q[t.surf]; q = true; parts.push("\u0000"); return; }
      var gl = glossOf(t.e);
      if (t.reasons && t.reasons.length && vclass(t.e)) gl = gl; // relative clause verbs: keep base
      parts.push(gl);
    });
    var txt = parts.filter(function (x) { return x !== "\u0000"; }).join(" ");
    if (num !== null) {
      if (COUNTER[counter] && !txt) txt = (num <= 10 ? NUMW[num] : num) + " " + COUNTER[counter];
      else txt = (num <= 10 ? NUMW[num] : num) + " " + (num > 1 ? plural(txt) : txt);
    }
    if (g.prefix) txt = g.prefix + " " + txt;
    if (g.nominal) txt = txt + " " + "things";
    return txt.trim();
  }
  groups.forEach(function (g, idx) {
    var first = g.ws[0];
    if (!first) return;
    if (g.p === "の") {
      var nx = groups[idx + 1];
      var isAdjOrVerb = first.e && (aclass(first.e) || vclass(first.e)) && g.ws.length === 1;
      if (nx && !nx.ws.length) { nx.ws = g.ws; if (isAdjOrVerb) nx.nominal = true; g.ws = []; return; }
      if (nx) { var who = first.e && JP_PRON[first.surf]; nx.prefix = (nx.prefix ? nx.prefix + " " : "") + (who ? (POSS[who] || who + "'s") : (npText(g) + (first.e && /^(friend|mother|father|mom|dad|girlfriend|boyfriend|teacher|family)/.test(glossOf(first.e)) ? "'s" : ""))); g.ws = []; return; }
    }
  });
  groups.forEach(function (g) {
    if (!g.ws.length) return;
    var first = g.ws[0], pron = first.e && JP_PRON[first.surf] && g.ws.length === 1 ? JP_PRON[first.surf] : null;
    if (first.e && JP_Q[first.surf] && g.ws.length === 1) {
      qword = JP_Q[first.surf]; q = true;
      if (g.p === "で" && qword === "where") qword = "where"; else if (g.p === "が") subj = { q: true };
      return;
    }
    var txt = npText(g);
    if (!txt) return;
    var person = pron && /^(I|you|he|she|we|they|that guy|those guys|everyone)$/.test(pron);
    switch (g.p) {
      case "は": case "も": case "が": case "には": case "では":
        if (gaObj && !person && (g.p === "が" || (g.p === "は" && subj))) { obj = { t: txt, also: g.p === "も" }; break; }
        if (!subj) subj = { t: pron || txt, pron: person, also: g.p === "も" };
        else obj = { t: txt };
        break;
      case "を": obj = { t: pron ? (OBJ[pron] || pron) : txt }; break;
      case "": if (person && !subj) subj = { t: pron, pron: true }; else if (!obj && (vclass(pred.e || { p: [] }) || isReq || gaObj)) obj = { t: pron ? (OBJ[pron] || pron) : txt }; else if (!subj) subj = { t: pron || txt }; else extra.push(txt); break;
      default: pps.push({ p: g.p, t: pron ? (OBJ[pron] || pron) : txt, place: !!(pron && /here|there/.test(pron)) });
    }
  });
  var timeTxt = time.map(function (t) { return glossOf(t.e); });
  var future = time.some(function (t) { return FUTURE.test(t.surf); });
  var pe = pred.e;
  var lem = pe ? glossOf(pe) : pred.unknown ? (pred.kata ? romaji(pred.unknown) : pred.unknown) : pred.num ? String(kanjiNum(pred.num)) : "";
  if (pe && JP_Q[pred.surf]) { qword = JP_Q[pred.surf]; q = true; }
  function ppText(verb) {
    return pps.map(function (p) {
      var motion = /^(go|come|return|go back|go home|arrive|get|enter|head)/.test(verb);
      var vehicle = /^(train|bus|taxi|car|subway|plane|bike|bicycle|electric train|bullet train)$/.test(p.t);
      var person = /^(friend|friends|mom|mother|dad|father|girlfriend|boyfriend|family|brother|sister|teacher|everyone|kids?)$/.test(p.t);
      if (person && p.p === "と") return "with my " + p.t;
      if (p.p === "で" && /^[A-Z]/.test(p.t)) return "in " + p.t;
      var pr = { "で": vehicle ? (motion ? "by" : "on the") : /^(card|cash|credit card|chopsticks|english|japanese|hand)$/i.test(p.t) ? "with" : "at", "に": motion ? "to" : "at", "へ": "to", "と": "with", "から": "from", "まで": motion ? "to" : "until", "より": "than", "や": "and", "とか": "and", "だけ": "only", "しか": "only" }[p.p];
      if (pr === undefined) pr = "";
      var obj2 = /^(by|on the)$/.test(pr) ? p.t : art(p.t, pr === "at" || pr === "to");
      if (p.place) return p.t;
      return (pr ? pr + " " : "") + obj2;
    }).join(" ");
  }
  var S = subj ? (subj.q ? "who" : subj.t) : null;
  var third = function (s) { return s && !/^(I|you|we|they|those guys|everyone)$/i.test(s) && !/ and /.test(s) && !(/s$/.test(s) && !/^(this|it|his|bus)$/.test(s)); };
  var end = q ? "?" : excl ? "!" : ".";
  var advTxt = advs.join(" ");
  // ---- requests: "X ください"
  if (isReq) {
    var o = obj ? obj.t : subj ? subj.t : extra.join(" ");
    return cap((o ? o + ", " : "") + "please") + (excl ? "!" : ".");
  }
  // ---- existence
  if (isExist && !R.want) {
    var thing = obj ? obj.t : (subj && !subj.pron ? subj.t : "");
    var owner = subj && subj.pron ? subj.t : null;
    var where = pps.filter(function (p) { return p.p === "に" || p.p === "には" || p.place; });
    var placeTxt = where.length ? " " + where.map(function (p) { return p.place ? p.t : "at " + art(p.t, true); }).join(" ") : "";
    var animate = /^いる|居る$/.test(predBase);
    if (thing && (owner || (!where.length && animate))) {
      var ow = owner || (q ? "you" : "I");
      var hv = third(ow) ? "has" : "have";
      if (q) return cap((R.neg ? (third(ow) ? "doesn't " : "don't ") : (third(ow) ? "does " : "do ")) + ow + " have " + aN(thing) + placeTxt) + "?";
      return cap(ow + " " + (R.neg ? (third(ow) ? "doesn't have " : "don't have ") : R.past ? "had " : hv + " ") + aN(thing) + placeTxt) + end;
    }
    if (thing) {
      if (q) return cap((R.past ? "was there " : "is there ") + aN(thing) + placeTxt) + "?";
      return cap("there " + (R.past ? "was" : "is") + (R.neg ? " no " : " ") + (R.neg ? thing : aN(thing)) + placeTxt) + end;
    }
    if (qword === "where") return cap("where " + (S ? (S === "I" ? "am I" : /^(you|we|they)$/.test(S) ? "are " + S : "is " + art(S, true)) : "is it")) + "?";
    if (S) return cap(S + " " + (S === "I" ? "am" : third(S) ? "is" : "are") + (R.neg ? " not" : "") + placeTxt) + end;
  }
  var lastB = body[body.length - 1];
  if (/^(なる|成る)$/.test(predBase) && lastB && lastB.e && aclass(lastB.e) && (lastB.reasons || []).indexOf("adv") >= 0) {
    var aw = glossOf(lastB.e), cmp = /e$/.test(aw) ? aw + "r" : /y$/.test(aw) ? aw.slice(0, -1) + "ier" : /^[a-z]{3,5}$/.test(aw) ? aw + "er" : "more " + aw;
    if (q && R.neg) return cap("could it be " + cmp) + "?";
    return cap("it " + (R.past ? "got " : "gets ") + cmp) + end;
  }
  var isVerb = pe && (vclass(pe) || has(pe.p, "st")) && !(GA_OBJ.test(predBase) && !vclass(pe));
  if (pe && has(pe.p, "vs") && !vclass(pe) && !pred.reasons.length) isVerb = false;
  var isAdj = pe && !isVerb && (has(pe.p, "adj-i") || has(pe.p, "adj-ix"));
  var restParts = function (verb) { return [obj && !obj.q ? obj.t : "", ppText(verb), advTxt].concat(extra).concat(timeTxt).filter(Boolean).join(" "); };
  if (isVerb) {
    var v = lem.split(" ")[0], vrest = lem.split(" ").slice(1).join(" ");
    var rest = [vrest, restParts(lem)].filter(Boolean).join(" ");
    if (obj && /^(lose|forget|find|lost)$/.test(v) && !/^(my|your|the)\b/.test(obj.t)) rest = rest.replace(obj.t, "my " + obj.t);
    var subjEn = S || (q ? ((R.can || R.mayi) && !/^(speak|understand|read|write|swim|drive|eat|drink|use|cook|sing|dance|come)$/.test(v) ? "I" : "you") : "I");
    var st = has(pe.p, "st") || (pe.i >= (D.cs || 1e9) && /^(tired|hungry|thirsty|drunk|lost|full|sleepy)$/.test(lem));
    if (st || (R.past && /^(get tired|be tired|tire|become hungry|get hungry)$/.test(lem))) {
      var adjw = /tire/.test(lem) ? "tired" : lem.replace(/^(get|be|become) /, "");
      var beW = subjEn === "I" ? (R.past && R.prog ? "was" : "am") : third(subjEn) ? "is" : "are";
      return cap((q ? beW + " " + subjEn : subjEn + " " + beW) + (R.neg ? " not " : " ") + adjw) + end;
    }
    if (R.please || R.imper) return cap("please " + [v, rest].join(" ")) + (excl ? "!" : ".");
    if (R.negte && !q) return cap("please don't " + [v, rest].join(" ")) + ".";
    if (R.canyou) return cap("can you " + [v, rest].join(" ")) + "?";
    if (R.mayi) return cap("can I " + [v, rest].join(" ")) + "?";
    if (R.lets || R.shall) return cap((q || R.shall ? "shall we " : "let's ") + [v, rest].join(" ")) + (q || R.shall ? "?" : "!");
    if (R.must) return cap(subjEn + (third(subjEn) ? " has to " : " have to ") + [v, rest].join(" ")) + end;
    if (R.te && !R.prog && (pred.reasons || []).length === 1 && !q) return cap("please " + [v, rest].join(" ")) + ".";
    var qw = qword && !(subj && subj.q) ? qword + " " : "";
    var sent;
    var th = third(subjEn);
    var beW2 = R.past ? (subjEn === "I" || th ? "was" : "were") : (subjEn === "I" ? "am" : th ? "is" : "are");
    if (subj && subj.q) {
      sent = "who " + (R.want ? (R.past ? "wanted to " : "wants to ") + v : R.can ? "can " + v : R.prog ? beW2 + " " + englishIng(v) : R.neg ? (R.past ? "didn't " : "doesn't ") + v : R.past ? englishPast(v) : english3(v)) + " " + rest;
      return cap(sent) + "?";
    }
    if (q) {
      if (R.prog) sent = qw + beW2 + " " + subjEn + (R.neg ? " not " : " ") + englishIng(v) + " " + rest;
      else if (R.can) sent = qw + (R.neg ? "can't " : "can ") + subjEn + " " + v + " " + rest;
      else if (R.want) sent = qw + (R.past ? "did " : th ? "does " : "do ") + subjEn + (R.neg ? " not" : "") + " want to " + (R.try ? "try " : "") + v + " " + rest;
      else if (future && !R.past) sent = qw + (R.neg ? "won't " : "will ") + subjEn + " " + v + " " + rest;
      else sent = qw + (R.past ? (R.neg ? "didn't " : "did ") : (R.neg ? (th ? "doesn't " : "don't ") : (th ? "does " : "do "))) + subjEn + " " + v + " " + rest;
      return cap(sent) + "?";
    }
    if (R.prog) sent = subjEn + " " + beW2 + (R.neg ? " not " : " ") + englishIng(v);
    else if (R.want) sent = subjEn + (R.neg ? (R.past ? " didn't want to " : th ? " doesn't want to " : " don't want to ") : R.past ? " wanted to " : th ? " wants to " : " want to ") + (R.try ? "try " : "") + v;
    else if (R.can) sent = subjEn + (R.neg ? (R.past ? " couldn't " : " can't ") : R.past ? " could " : " can ") + v;
    else if (R.try) sent = subjEn + (R.past ? " tried " : " will try ") + englishIng(v);
    else if (R.neg) sent = subjEn + (R.past ? " didn't " : future ? " won't " : th ? " doesn't " : " don't ") + v;
    else if (R.past) sent = subjEn + " " + englishPast(v);
    else if (future) sent = subjEn + (subjEn === "I" ? "'m going to " : " will ") + v;
    else sent = subjEn + " " + (th ? english3(v) : v);
    if (subj && subj.also) rest += " too";
    return cap(sent + " " + rest) + end;
  }
  // ---- adjective / noun predicates
  var predTxt = lem;
  if (pe && JP_PRON[pred.surf]) predTxt = JP_PRON[pred.surf];
  if (R.toomuch) predTxt = "too " + predTxt;
  var likeP = /^(好き|大好き|嫌い|大嫌い|欲しい|ほしい|必要|わかる|分かる)$/.test(predBase);
  if (likeP) {
    var lv = { "好き": "like", "大好き": "love", "嫌い": "hate", "大嫌い": "really hate", "欲しい": "want", "ほしい": "want", "必要": "need", "わかる": "understand", "分かる": "understand" }[predBase];
    var who2 = S && subj && subj.pron ? S : (q ? "you" : "I");
    var thing2 = obj ? obj.t : (subj && !subj.pron ? subj.t : "it");
    var th2 = third(who2);
    if (q) return cap((R.past ? "did " : th2 ? "does " : "do ") + who2 + (R.neg ? " not " : " ") + lv + " " + thing2 + (advTxt ? " " + advTxt : "")) + "?";
    return cap(who2 + (R.neg ? (R.past ? " didn't " : th2 ? " doesn't " : " don't ") + lv : R.past ? " " + englishPast(lv) : " " + (th2 ? english3(lv) : lv)) + " " + thing2 + (advTxt ? " " + advTxt : "")) + end;
  }
  var nounPred = !isAdj && pe && !aclass(pe) && !GA_OBJ.test(predBase);
  if (pe && (has(pe.p, "adj-na") || has(pe.p, "adj-no")) && !has(pe.p, "n")) nounPred = false;
  if (!pe && pred.num) nounPred = true;
  var S2 = S || (obj ? obj.t : null) || "it";
  var be = R.past ? (S2 === "I" || third(S2) ? "was" : "were") : (S2 === "I" ? "am" : third(S2) ? "is" : "are");
  if (pe && JP_Q[pred.surf] && (qword === "what" || qword === "where" || qword === "who" || qword === "when" || qword === "how much" || qword === "how" || qword === "which" || qword === "how many" || qword === "what time")) {
    return cap(qword + " " + be + " " + art(S2, true) + (pps.length ? " " + ppText("") : "")) + "?";
  }
  var predOut = nounPred ? aN(predTxt) : predTxt;
  var extraTxt = [ppText(""), advTxt].concat(extra).concat(timeTxt).filter(Boolean).join(" ");
  if (q) return cap(be + " " + art(S2, true) + (R.neg ? " not " : " ") + predOut + (extraTxt ? " " + extraTxt : "")) + "?";
  var sOut = S2 === "it" && !S ? "it" : art(S2, true);
  return cap(sOut + " " + be + (R.neg ? " not " : " ") + (advTxt && !nounPred ? advTxt + " " : "") + predOut + (extraTxt && nounPred ? " " + extraTxt : extraTxt && !advTxt ? " " + extraTxt : "") + (subj && subj.also ? " too" : "")) + end;
}
function aN(n) { if (!n) return n; if (/^(a|an|the|my|your|his|her|our|their|this|that|some|\d|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(n) || /^[A-Z]/.test(n) || /(s|ese|ish|food|water|money|cash|sushi|ramen|rice|sake|beer|coffee|tea|wifi|wi-fi|english|japanese)$/i.test(n)) return n; return (/^[aeiou]/i.test(n) ? "an " : "a ") + n; }

/* ------------------------------------------------------------------ dictionary search */
E.search = function (q, limit) {
  if (!D || !q) return [];
  limit = limit || 40;
  q = q.trim(); var res = [], seen = {};
  var isJ = /[぀-ヿ㐀-鿿]/.test(q);
  function addI(i) { if (seen[i] || res.length >= limit) return; seen[i] = 1; var e = ent(i); res.push({ jp: e.w, r: e.r, ro: romaji(e.r), en: e.g.split("|").slice(0, 2).join("; ").replace(/;/g, ", "), pos: e.p }); }
  if (isJ) {
    var hq = toHira(q);
    if (JPMAP[q]) JPMAP[q].forEach(addI);
    if (JPMAP[hq]) JPMAP[hq].forEach(addI);
    var d = deinflect(q); d.forEach(function (x) { addI(x.e.i); });
    for (var i = 0; i < D.e.length && res.length < limit; i++) { var row = D.e[i]; if (row[0].indexOf(q) === 0 || row[1].indexOf(hq) === 0) addI(i); }
  } else {
    var lq = q.toLowerCase();
    var k = enKey(lq); if (k >= 0) addI(k);
    k = enKey("to " + lq); if (k >= 0) addI(k);
    var re = new RegExp("(^|[;|] ?|\\bto )" + lq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    for (var j = 0; j < D.e.length && res.length < limit; j++) if (re.test(D.e[j][3])) addI(j);
  }
  return res;
};
E.isJP = function (t) { return /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(t); };

/* ------------------------------------------------------------------ word breakdown for EN input */
E.enWords = function (text) {
  if (!D) return [];
  var t = tokens(normalizeEN(text)), out = [], i = 0;
  while (i < t.length) {
    if (PRON[t[i]] || DET[t[i]] || PREP.indexOf(t[i]) >= 0 || /^(is|are|am|do|does|did|not|to|can|will|please|and|,)$/.test(t[i])) { i++; continue; }
    var v = lookupVerb(t.slice(i)), n = lookupNoun(t.slice(i)), a = lookupAdj(t[i]);
    var pick = n && (!v || n.n >= v.n) ? { e: n.e, n: n.n } : v ? { e: v.e, n: v.n } : a ? { e: a.e, n: 1 } : null;
    if (pick) { out.push({ en: t.slice(i, i + pick.n).join(" "), jp: pick.e.w, r: pick.e.r, ro: romaji(pick.e.r) }); i += pick.n; }
    else { var k = katakana(t[i]); out.push({ en: t[i], jp: k, r: toHira(k), ro: romaji(k), guess: true }); i++; }
  }
  return out;
};

root.HanaEngine = E;
if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
