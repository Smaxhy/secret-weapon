#!/usr/bin/env python3
"""Build data/dict.json from the JMdict SQLite DB shipped in the `jamdict-data` PyPI package.

Usage: python3 scripts/build_dict.py path/to/jamdict.db

JMdict is (c) the Electronic Dictionary Research and Development Group, CC BY-SA 4.0.
"""
import json, re, sqlite3, sys
from collections import defaultdict

db = sqlite3.connect(sys.argv[1])
TOP = {"news1", "ichi1", "spec1", "gai1"}
MID = {"news2", "ichi2", "spec2", "gai2"}

def pos_code(s):
    if s.startswith("Godan verb"):
        if "Iku/Yuku" in s: return "v5k-s"
        if "-aru special" in s: return "v5aru"
        if "irregular" in s: return "v5r-i"
        if "special class" in s: return "v5u-s"
        m = re.search(r"'(\w+)' ending", s); return "v5" + m.group(1)[0] if m and m.group(1) != "tsu" else "v5t"
    table = [("Ichidan verb", "v1"), ("Kuru verb", "vk"), ("suru verb - included", "vs-i"), ("suru verb - special", "vs-s"),
             ("noun or participle which takes the aux. verb suru", "vs"), ("adjective (keiyoushi) - yoi/ii", "adj-ix"),
             ("adjective (keiyoushi)", "adj-i"), ("adjectival nouns", "adj-na"), ("genitive case particle", "adj-no"),
             ("pre-noun adjectival", "adj-pn"), ("adverb taking the 'to'", "adv-to"), ("adverb", "adv"),
             ("noun (common)", "n"), ("pronoun", "pn"), ("particle", "prt"), ("interjection", "int"), ("expressions", "exp"),
             ("conjunction", "conj"), ("noun, used as a suffix", "suf"), ("suffix", "suf"), ("noun, used as a prefix", "pref"),
             ("prefix", "pref"), ("counter", "ctr"), ("numeric", "num"), ("auxiliary verb", "aux-v"), ("auxiliary adjective", "aux-adj"),
             ("copula", "cop"), ("intransitive verb", "vi"), ("transitive verb", "vt")]
    for k, v in table:
        if s.startswith(k): return v
    for k, v in table:
        if k in s: return v
    return None

BAD_MISC = {"archaism": 6, "obsolete term": 6, "rare": 4, "obscure term": 5, "dated term": 2.5, "historical term": 4,
            "honorific or respectful (sonkeigo) language": 2.5, "humble (kenjougo) language": 2.5, "polite (teineigo) language": 1.5,
            "abbreviation": 1.5, "derogatory": 3, "vulgar expression or word": 2, "slang": 1.2, "Internet slang": 2,
            "manga slang": 3, "literary or formal term": 1.5, "poetical term": 4, "place name": 6, "full name of a particular person": 6,
            "proverb": 4, "quotation": 5, "yojijukugo": 2, "children's language": 2, "sensitive": 2,
            "work of art, literature, music, etc. name": 6, "female term or language": 1, "jocular, humorous term": 2}

def prio(tags):
    tags = set(tags)
    nf = [int(t[2:]) for t in tags if t.startswith("nf")]
    base = 0 if tags & TOP else 1 if tags & MID else 3
    return base + (min(nf) / 48 if nf else 0.5)

kanji, kana = defaultdict(list), defaultdict(list)
for kid, idseq, text in db.execute("select ID, idseq, text from Kanji order by ID"):
    tags = [r[0] for r in db.execute("select text from KJP where kid=?", (kid,))]
    info = [r[0] for r in db.execute("select text from KJI where kid=?", (kid,))]
    kanji[idseq].append((text, tags, info))
for kid, idseq, text, nok in db.execute("select ID, idseq, text, nokanji from Kana order by ID"):
    tags = [r[0] for r in db.execute("select text from KNP where kid=?", (kid,))]
    kana[idseq].append((text, tags))
print("forms loaded", file=sys.stderr)

senses = defaultdict(list)
sense_pos, sense_misc, sense_gloss = defaultdict(list), defaultdict(list), defaultdict(list)
for sid, t in db.execute("select sid, text from pos"): sense_pos[sid].append(t)
for sid, t in db.execute("select sid, text from misc"): sense_misc[sid].append(t)
for sid, t in db.execute("select sid, text from SenseGloss where lang='eng' or lang is null"): sense_gloss[sid].append(t)
for sid, idseq in db.execute("select ID, idseq from Sense order by ID"): senses[idseq].append(sid)
print("senses loaded", file=sys.stderr)

KATA = re.compile(r"^[゠-ヿー・]+$")
entries = []
for idseq, sids in senses.items():
    ks = [k for k in kanji[idseq] if not any("irregular" in i or "out-dated" in i or "rarely" in i or "search-only" in i for i in k[2])]
    rs = kana[idseq]
    if not rs: continue
    tags = [t for k in ks for t in k[1]] + [t for r in rs for t in r[1]]
    p = prio(tags)
    common = p < 3
    first_gloss = sense_gloss[sids[0]] if sids else []
    loan = (not ks) and KATA.match(rs[0][0]) and first_gloss and len(first_gloss[0].split()) <= 3
    if not common and not loan: continue
    # senses (max 4) with their pos inherited like JMdict (pos carries over when omitted)
    out_senses, last_pos = [], []
    for sid in sids[:4]:
        pos = sense_pos[sid] or last_pos; last_pos = pos
        gl = [g for g in sense_gloss[sid]][:5]
        if gl: out_senses.append((sid, pos, sense_misc[sid], gl))
    if not out_senses: continue
    uk = "word usually written using kana alone" in out_senses[0][2]
    kforms = sorted(ks, key=lambda k: prio(k[1]))
    written = [k[0] for k in kforms[:3]]
    reading = sorted(rs, key=lambda r: prio(r[1]))[0][0]
    surface = reading if (uk or not written) else written[0]
    codes = []
    for s in out_senses[0][1]:
        c = pos_code(s)
        if c and c not in codes: codes.append(c)
    entries.append(dict(id=idseq, s=surface, w=written, r=reading, p=codes, prio=p, senses=out_senses, ns=len(sids)))
print("entries", len(entries), file=sys.stderr)
entries.sort(key=lambda e: e["prio"])

VERB = re.compile(r"^v[15ks]")
def clean(g):
    g = re.sub(r"\([^)]*\)", "", g)
    g = re.sub(r"\s+", " ", g).strip().strip(".!").lower()
    return g

en_best = {}
for idx, e in enumerate(entries):
    for i, (sid, pos, misc, gl) in enumerate(e["senses"][:3]):
        codes = [pos_code(x) for x in pos]
        is_verb = any(c and VERB.match(c) for c in codes)
        pen = sum(BAD_MISC.get(m, 0) for m in misc)
        pen += 1.0 if "exp" in codes else 0
        pen += 2.5 if any(c in ("suf", "pref", "ctr") for c in codes) else 0
        for j, g in enumerate(gl):
            raw = g
            g = clean(g)
            if not g or len(g.split()) > 4: continue
            if is_verb and not g.startswith("to "): continue
            if not is_verb and g.startswith("to "): continue
            exact = 0 if re.sub(r"\([^)]*\)", "", raw).strip().lower() == g else 0.4
            score = e["prio"] * 2 + i * 1.6 + j * 0.6 + pen + exact + max(0, len(e["s"]) - 5) * 0.15 - 0.2 * min(e["ns"], 6)
            if g not in en_best or score < en_best[g][0]:
                en_best[g] = (score, idx)

out_e = []
for e in entries:
    alts = [w for w in e["w"] if w != e["s"]]
    g = "|".join(";".join(clean(x) if False else re.sub(r"\s+", " ", x).strip() for x in s[3]) for s in e["senses"])
    out_e.append([e["s"] + ("," + ",".join(alts) if alts else ""), e["r"], ",".join(e["p"]), g])
# ---- hand-picked overrides (data/core.tsv) ----
by_form = defaultdict(list)
for idx, e in enumerate(out_e):
    for f in e[0].split(","): by_form[f].append(idx)
    by_form[e[1]].append(idx)
def guess_verb(kana):
    last = kana[-1]
    if kana.endswith("する"): return "vs-i"
    if kana.endswith("くる"): return "vk"
    if last == "る" and len(kana) > 1 and kana[-2] in "いきしちにひみりぎじびぴえけせてねへめれげぜべぺ": return "v1"
    return {"う": "v5u", "く": "v5k", "ぐ": "v5g", "す": "v5s", "つ": "v5t", "ぬ": "v5n", "ぶ": "v5b", "む": "v5m", "る": "v5r"}.get(last, "n")
missing = []
core_keys = []
core_start = len(out_e)
for line in open("data/core.tsv", encoding="utf-8"):
    line = line.rstrip("\n")
    if not line or line.startswith("#"): continue
    key, val = line.split("\t")
    pos = reading = None
    if "#" in val: val, pos = val.split("#", 1)
    if "@" in val: val, reading = val.split("@", 1)
    cands = [i for i in by_form.get(val, []) if reading is None or out_e[i][1] == reading.replace("|", "")]
    base = out_e[cands[0]] if cands else None
    if base is None and val.endswith("する"):
        stem = [i for i in by_form.get(val[:-2], []) if "vs" in out_e[i][2].split(",")]
        if stem:
            b = out_e[stem[0]]; base = [val, b[1] + "|する", "vs-i", b[3]]
    if base is None and reading is None:
        missing.append(line); continue
    r = reading or base[1]
    if pos == "st":
        pos = "st," + (base[2].split(",")[0] if base and base[2].split(",")[0].startswith("v") else guess_verb(r))
    elif pos is None:
        pos = base[2] if base else guess_verb(r)
    gl = key[3:] if key.startswith("to ") else key
    key = key.lower()
    gl = gl + (";" + base[3].split("|")[0] if base else "")
    out_e.append([val, r, pos, gl])
    en_best[key] = (0, len(out_e) - 1)
    core_keys.append(key)
if missing: print("UNRESOLVED (add @reading):", *missing, sep="\n  ", file=sys.stderr)

data = {"v": 1, "license": "JMdict (c) EDRDG, CC BY-SA 4.0 - https://www.edrdg.org/edrdg/licence.html",
        "e": out_e, "en": {k: v[1] for k, v in sorted(en_best.items())}, "core": sorted(set(core_keys)), "cs": core_start}
json.dump(data, open("data/dict.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("written", len(out_e), "entries,", len(en_best), "english keys", file=sys.stderr)
