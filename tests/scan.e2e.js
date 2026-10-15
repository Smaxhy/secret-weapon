// End-to-end scanner test. Needs a local server: python3 -m http.server 8765 (repo root).
// Run: node tests/scan.e2e.js   (Playwright + Chromium required)
// Prints every card (in screen order, so two-column menus show the left column first) and checks that the
// expected dishes were found with the right prices. Exit code 1 when something is missing.
const { chromium, devices } = require('playwright');
const MENUS = [
  ['menu.png', 'sc1', [['醤油ラーメン', 850], ['味噌ラーメン', 900], ['豚骨ラーメン', 950], ['鶏の唐揚げ定食', 1100], ['海老天丼', 1200], ['餃子', 450], ['枝豆', 300], ['生ビール', 600]]],
  ['menu2.png', 'sc2', [['海鮮丼', 1580], ['鶏の唐揚げ', 680], ['だし巻き玉子', 520], ['揚げ出し豆腐', 480], ['焼き鳥盛り合わせ', 980], ['たこわさ', 420], ['レモンサワー', 500], ['ハイボール', 550]]],
  ['menu3.png', 'sc3', [['親子丼', 800], ['天ぷらうどん', 900], ['ざるそば', 700], ['カツ丼', 950], ['枝豆', 300]]],
  // two columns: left column (ラーメン) must come before the right one (ご飯もの)
  ['menu4.png', 'sc4', [['醤油ラーメン', 780], ['担々麺', 950], ['つけ麺大盛', 1050], ['味玉', 120], ['チャーハン', 680], ['焼き餃子6個', 400], ['ライス', 200], ['瓶ビール', 650]], ['ラーメン', 'ご飯もの']]
];
const norm = s => String(s || '').replace(/\s+/g, '');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('http://localhost:8765/');
  await p.waitForFunction(() => window.HanaEngine && HanaEngine.ready(), null, { timeout: 30000 });
  await p.tap('nav button[data-tab=sc]'); await p.waitForTimeout(600);
  let failed = 0;
  for (const [img, shot, want, sections] of MENUS) {
    const t0 = Date.now();
    await p.setInputFiles('#fileIn', __dirname + '/' + img);
    await p.waitForFunction(() => document.querySelector('#scanResults .dish, #scanResults .empty-note:not(:has(.dots))'), null, { timeout: 120000 });
    await p.waitForTimeout(1200);
    const res = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('#scanResults .section-title, #scanResults .dish').forEach(d => {
        if (d.classList.contains('section-title')) { out.push({ section: d.textContent }); return; }
        out.push({
          jp: d.querySelector('.dish-jp').textContent, price: (d.querySelector('.price') || {}).textContent || '',
          en: d.querySelector('.dish-en').textContent, tags: [...d.querySelectorAll('.ftag')].map(x => x.textContent.split(' ')[0]).join('')
        });
      });
      return out;
    });
    const dishes = res.filter(r => !r.section);
    console.log('==', shot, img, (Date.now() - t0) + 'ms', dishes.length, 'items');
    res.forEach(r => console.log(r.section ? '   [' + r.section + ']' : '   ' + [r.jp, r.price, r.en, r.tags].join(' | ')));
    const miss = [], order = [];
    want.forEach(([jp, yen]) => {
      const i = dishes.findIndex(d => norm(d.jp) === norm(jp) && d.price === '¥' + yen.toLocaleString('en-US'));
      if (i < 0) miss.push(jp + ' ¥' + yen.toLocaleString('en-US')); else order.push(i);
    });
    if (miss.length) { failed++; console.log('   FAIL missing/wrong:', miss.join(', ')); }
    if (sections) {
      const secIdx = sections.map(s => res.findIndex(r => r.section && r.section.indexOf(s) >= 0));
      const shown = res.filter(r => r.section).map(r => r.section);
      if (secIdx.some(i => i < 0)) { failed++; console.log('   FAIL sections: wanted', sections.join(' / '), 'got', shown.join(' / ')); }
    }
    if (!miss.length && order.some((v, i) => i && v < order[i - 1])) { failed++; console.log('   FAIL order (expected menu/column order):', order.join(',')); }
    await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/' + shot + '.png', fullPage: false });
    await p.tap('#retake'); await p.waitForTimeout(300);
  }
  const real = errs.filter(e => !/Parameter not found|getUserMedia|NotFound|Permission|camera/i.test(e));
  console.log('errors:', real.slice(0, 8));
  console.log(failed ? 'FAILED: ' + failed + ' check(s)' : 'ALL OK');
  await b.close();
  process.exit(failed || real.length ? 1 : 0);
})();
