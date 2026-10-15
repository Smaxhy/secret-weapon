// End-to-end scanner test. Needs a local server: python3 -m http.server 8765 (repo root).
// Run: node tests/scan.e2e.js   (Playwright + Chromium required)
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('http://localhost:8765/');
  await p.waitForFunction(() => window.HanaEngine && HanaEngine.ready(), null, { timeout: 30000 });
  await p.tap('nav button[data-tab=sc]'); await p.waitForTimeout(600);
  for (const [img, shot] of [[__dirname + '/menu.png', 'sc1'], [__dirname + '/menu2.png', 'sc2'], [__dirname + '/menu3.png', 'sc3']]) {
    const t0 = Date.now();
    await p.setInputFiles('#fileIn', img);
    await p.waitForFunction(() => document.querySelector('#scanResults .dish, #scanResults .empty-note:not(:has(.dots))'), null, { timeout: 120000 });
    await p.waitForTimeout(1200);
    const items = await p.$$eval('#scanResults .dish', ds => ds.map(d => [d.querySelector('.dish-jp').textContent, (d.querySelector('.price') || {}).textContent, d.querySelector('.dish-en').textContent, [...d.querySelectorAll('.ftag')].map(x => x.textContent.split(' ')[0]).join('')].join(' | ')));
    console.log('==', shot, (Date.now() - t0) + 'ms', items.length, 'items'); items.forEach(i => console.log('  ', i));
    await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/' + shot + '.png', fullPage: false });
    await p.tap('#retake'); await p.waitForTimeout(300);
  }
  console.log('errors:', errs.filter(e => !/Parameter not found|getUserMedia|NotFound|Permission|camera/i.test(e)).slice(0, 8));
  await b.close();
})();
