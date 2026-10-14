# Hana 🌸 — Japanese ⇄ English translator

An offline-first web app (PWA) with an anime mascot, made for travelling in Japan.
Open it once with internet, then **Add to Home Screen**. After that it works without any connection.

**Live:** https://smaxhy.github.io/secret-weapon/

## What it does
- **Offline translation engine** (no AI, no internet): a rule-based EN⇄JP translator that understands sentence structure
  (subject / verb / object / places / time), rebuilds it in Japanese word order with the right particles and verb endings,
  and does the reverse for Japanese → English. Casual (how a 21-year-old talks) or polite.
  - `I want to eat barbecue sauce on a train` → `電車でバーベキューソースを食べたい` (densha de baabekyuusoosu o tabetai)
- **56,000+ word dictionary** built in (JMdict), searchable offline in the Word book.
- **Online boost:** in Auto mode it also asks Google Translate when you have signal and shows both results.
- **Phrasebook:** Basics, Food & Ordering, Clothes & Shopping, Colors, Getting Around, Hanging Out, Numbers & Money, Konbini, Hotel, Nightlife, Emergency.
- **Word book + flashcards** with spaced repetition. Add any word or translation to your own list.
- 🔊 pronunciation, 🎤 voice input, 🖥 big "show to staff" screen, ⭐ favourites, history.

## Project layout
| Path | What |
|---|---|
| `index.html`, `css/app.css`, `js/app.js` | the app UI |
| `js/engine.js` | offline translation engine (browser + Node) |
| `data/dict.json` | generated dictionary (JMdict + `data/core.tsv` overrides) |
| `data/core.tsv` | hand-picked everyday word choices — edit this to improve translations |
| `scripts/build_dict.py` | rebuilds `data/dict.json` from the `jamdict-data` PyPI package's JMdict DB |
| `tests/engine.test.js` | sample sentences (`node tests/engine.test.js all`) |
| `sw.js`, `manifest.json`, `icons/`, `img/hana.svg` | offline caching, install info, icons, mascot |

Rebuild the dictionary after editing `data/core.tsv`:
```
pip download jamdict-data==1.5 --no-deps && tar xzf jamdict_data-1.5.tar.gz && xz -dk jamdict_data-1.5/jamdict_data/jamdict.db.xz
python3 scripts/build_dict.py jamdict_data-1.5/jamdict_data/jamdict.db
```

## Credits
Dictionary data: [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) © Electronic Dictionary Research and Development Group, CC BY-SA 4.0.
