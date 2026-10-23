'use strict';
// Water and puddles mirror what stands beyond them. Something nearer than the patch of water (a sign on the
// promenade in front of the bay) cannot appear in it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');

test('a reflection shows only what is beyond the water, never a sign standing in front of it', async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/javascript' }); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.route('https://**', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/ascii-city.html`);
    const r = await page.evaluate(() => {
      paused = false; clearWanted(); room = null; mode = 'walk'; tod = 13; env(0);
      px = FISH_HUT.x - 3; py = shoreS(px) - 0.25; a = Math.PI / 2; pitch = 0.2; render(0);
      // one puddle pixel (no ripple: its mirror row is exact), and the pixel it mirrors
      const x = cols >> 1, b = BASE[x] = hor + 4, r = b + 3, i = r * cols + x, s = 2 * b - r - 1, j = s * cols + x;
      const mirror = (sourceDepth) => {
        FL[i] = 2; ZB[i] = 3; CH[i] = '.'; FL[j] = 0; CH[j] = '#'; COL[j] = C(RED, 12); ZB[j] = sourceDepth;
        for (let k = 0; k < cols; k++) if (k !== x) BASE[k] = rows; // (only this column)
        reflect(); return CH[i];
      };
      return { nearer: mirror(1.5), beyond: mirror(8), sky: mirror(Infinity) };
    });
    assert.deepEqual(r, { nearer: '~', beyond: '#', sky: '#' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
