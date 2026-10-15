# Hana 🌸 — Japanese ⇄ English translator

An offline-first web app (PWA) with an anime mascot, made for travelling in Japan.
**Install it before you fly:**
- **iPhone:** open the link in Safari → Share → **Add to Home Screen**. Then open Hana **from the new Home Screen icon once while you still have internet** and wait until the top says **"ready offline ⚡"** (the icon keeps its own copy, separate from Safari). On the Scan tab, also tap **"Make the scanner work offline"**.
- **Android:** Chrome menu → **Install app**, open it once online and wait for "ready offline ⚡".

After that it works without any connection.

**Live:** https://smaxhy.github.io/secret-weapon/

## What it does
- **Offline translation engine** (no AI, no internet): a rule-based EN⇄JP translator that understands sentence structure
  (subject / verb / object / places / time), rebuilds it in Japanese word order with the right particles and verb endings,
  and does the reverse for Japanese → English. Casual (how a 21-year-old talks) or polite.
  - `I want to eat barbecue sauce on a train` → `電車でバーベキューソースを食べたい` (densha de baabekyuusoosu o tabetai)
- **56,000+ word dictionary** built in (JMdict), searchable offline in the Word book.
- **Online boost:** in Auto mode it also asks Google Translate when you have signal and shows both results.
- **📸 Menu scanner:** aim the camera at a menu (or pick a photo). It straightens the photo, reads the Japanese **offline** (tesseract.js OCR, horizontal and vertical text), matches every dish against a built-in dictionary of ~300 Japanese dishes and drinks, and shows English names, descriptions, ingredients, allergen tags and prices — also as labels right on the photo. It handles two-column menus, kanji prices (九百五十円), section headings, size/set words (大盛, 定食) and common OCR slips (it shows the corrected name plus what it actually read). Set "Warn me about" (pork, shellfish, buckwheat, soy, nuts…) and risky dishes get flagged; soy sauce counts as wheat, dashi as fish. "Order this" shows a big これを一つください card for the staff, and "Ask" builds an allergy question from your whole avoid list.
  - **✨ AI perfect scan (optional):** paste your own Claude API key in Settings and menus are read by Claude (handwriting, fancy fonts, full ingredient lists). If the connection is bad it gives up after ~90 s and falls back to the offline scanner. Billed to your key (~$0.05/scan); the key never leaves your phone except to call the API.
- **Hana:** a cheeky onee-san mascot (switchable to 🌸 Sweet in Settings) who reacts to everything you do.
- **Phrasebook:** Basics, Food & Ordering, Clothes & Shopping, Colors, Getting Around, Hanging Out, Numbers & Money, Konbini, Hotel, Nightlife, Emergency.
- **Word book + flashcards** with spaced repetition. Add any word or translation to your own list.
- 🔊 pronunciation, 🎤 voice input, 🖥 big "show to staff" screen, ⭐ favourites, history.

## Project layout
| Path | What |
|---|---|
| `index.html`, `css/app.css`, `js/app.js` | the app UI |
| `js/engine.js` | offline translation engine (browser + Node) |
| `js/scan.js`, `js/food.js` | menu scanner + Japanese dish/ingredient dictionary |
| `vendor/tesseract/` | tesseract.js 7 + Japanese (horizontal & vertical) OCR data, served locally so scanning works offline |
| `vendor/anthropic/` | bundled `@anthropic-ai/sdk` 0.129.0 (ESM) for the optional AI scan |
| `data/dict.json` | generated dictionary (JMdict + `data/core.tsv` overrides) |
| `data/core.tsv` | hand-picked everyday word choices — edit this to improve translations |
| `scripts/build_dict.py` | rebuilds `data/dict.json` from the `jamdict-data` PyPI package's JMdict DB |
| `tests/engine.test.js` | sample sentences (`node tests/engine.test.js all`) |
| `tests/scan.e2e.js` | scanner end-to-end test on 4 sample menus incl. vertical and two-column (needs Playwright + `python3 -m http.server 8765`) |
| `sw.js`, `manifest.json`, `icons/`, `img/hana.svg` | offline caching (app shell, dictionary and scanner engine in separate caches, so updates don't re-download the 10 MB scanner), install info, icons, mascot |

Rebuild the dictionary after editing `data/core.tsv`:
```
pip download jamdict-data==1.5 --no-deps && tar xzf jamdict_data-1.5.tar.gz && xz -dk jamdict_data-1.5/jamdict_data/jamdict.db.xz
python3 scripts/build_dict.py jamdict_data-1.5/jamdict_data/jamdict.db
```

## Credits
OCR: [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0) with Tesseract `jpn`/`jpn_vert` LSTM data (Apache-2.0).
AI scan: [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) (MIT).
Dictionary data: [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) © Electronic Dictionary Research and Development Group, CC BY-SA 4.0.
