'use strict';
// WORLD_QUALITY.md pass 28: wildlife, pets and fish as readable, shaped species that move like themselves.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
test.before(async () => {
  server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/javascript' }); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); });
async function fixture(run) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.route('https://**', route => route.abort());
    await page.goto(origin + '/ascii-city.html');
    await page.evaluate(() => { paused = false; clearWanted(); room = null; mode = 'walk'; tod = 13; weather = 'clear'; env(0); people.length = cars.length = 0; });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('street pigeons are shaped birds: feet down and head up, pecking with the head at the ground, wings spread in flight', () => fixture(async page => {
  const r = await page.evaluate(() => {
    const frame = f => { const { parts } = ANIMAL_BODIES.pigeon(f), zs = parts.flatMap(p => p.k === 2 ? [p.a[2], p.b[2]] : [p.c[2]]), xs = parts.flatMap(p => p.k === 2 ? [p.a[0], p.b[0]] : [p.c[0]]);
      return { lowest: Math.min(...zs), span: Math.max(...xs) - Math.min(...xs), parts: parts.length }; };
    const head = f => ANIMAL_BODIES.pigeon(f).decals[0].p[2]; // (its eyes)
    return { stand: frame(0), peck: frame(1), up: frame(2), down: frame(3), headUp: head(0), headDown: head(1) };
  });
  assert.ok(r.stand.lowest < 0.3 && r.peck.lowest < 0.3, 'feet on the ground: ' + JSON.stringify(r));
  assert.ok(r.headDown < r.headUp - 3, 'pecking puts its head down at the ground');
  assert.ok(r.up.span > r.stand.span * 3 && r.down.span > r.stand.span * 3, 'wings spread wide in flight');
}));

test('a flock draws as shaped birds in their plumage (no ASCII), and scared birds face the way they fly', () => fixture(async page => {
  const r = await page.evaluate(() => {
    [px, py] = citySourcePoint(12 * 8 + 0.15, 10 * 8 + 4); a = Math.PI / 2; pitch = -0.75;
    flocks.length = 0;
    flocks.push({ x: px, y: py + 0.18, scared: 0, birds: [0, 1, 2, 3].map(k => ({ dx: (k - 1.5) * 0.03, dy: 0, ph: k * 1.3, dir: 1, z: 0, hd: k })) });
    render(0); const withBirds = CH.join(''), bg = BG.slice();
    flocks.length = 0; render(0); const without = BG.slice();
    let changed = 0, neck = 0;
    for (let i = 0; i < bg.length; i++) if (bg[i] !== without[i]) { changed++; if ((bg[i] & 0xf0) === (C(GREEN, 1) & 0xf0)) neck++; }
    // scare a flock and let them go
    flocks.push({ x: px, y: py + 0.18, scared: 0, birds: [0, 1, 2].map(k => ({ dx: k * 0.02, dy: 0, ph: k, dir: 1, z: 0, hd: 0 })) });
    T = 100; py += 0.15; stepPigeons(0.05); render(0); // (a scare is stamped with the time: not at T = 0)
    const facing = flocks[0].birds.map(b => Math.abs(Math.atan2(Math.sin(b.hd - Math.atan2(b.fy, b.fx)), Math.cos(b.hd - Math.atan2(b.fy, b.fx)))));
    return { changed, neck, ascii: /\(o>|<o\)/.test(withBirds), scared: !!flocks[0].scared, facing };
  });
  assert.ok(r.changed > 20 && r.neck > 0, 'shaped birds painted in solid colour, with their green neck sheen: ' + JSON.stringify(r));
  assert.equal(r.ascii, false);
  assert.ok(r.scared && r.facing.every(d => d < 1e-6), 'they fly off facing the way they go: ' + JSON.stringify(r));
}));
