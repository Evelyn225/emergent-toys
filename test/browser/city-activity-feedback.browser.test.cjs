'use strict';
// WORLD_QUALITY.md pass 29: what activities visibly leave behind (smoke, ...), driven through the real step functions.
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
    const types = { '.html': 'text/html', '.js': 'application/javascript' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
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
    await page.evaluate(() => { paused = false; clearWanted(); room = null; mode = 'walk'; cars.length = people.length = 0; env(0); haze.length = 0; });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('smoke: lit campfires and Fern House stove smoke after dark, cold ones do not, and fireworks leave capped clouds lit by the next burst', () => fixture(async page => {
  const r = await page.evaluate(() => {
    const fern = FIRES.find(o => near(o.x, o.y, 525.5, 238) < 1), [cx, cy] = FERN_CHIMNEY;
    const smokeNear = (x, y, r) => haze.filter(p => p.kind === 'smoke' && Math.hypot(p.x - x, p.y - y) < r);
    const run = seconds => { for (let k = 0; k < seconds * 10; k++) { stepWorldSmoke(.1); stepHaze(.1); } };
    px = fern.x - .6; py = fern.y; night = 0; run(4);
    const byDay = { fire: smokeNear(fern.x, fern.y, .5).length, chimney: smokeNear(cx, cy, .5).length };
    haze.length = 0; night = 1; run(4);
    const fire = smokeNear(fern.x, fern.y, .5), chimney = smokeNear(cx, cy, .5);
    const ground = terrainHeight(fern.x, fern.y), roof = terrainHeight(cx, cy) + FERN_CHIMNEY[2];
    enterRoom('islandshelter', { ret: [fern.x - .6, fern.y, 0] }, [6, 8, 0]); haze.length = 0; run(2);
    const indoors = haze.length; leaveRoom();
    // fireworks: one cloud per burst where it burst, never more than 24 at once, lit by the latest
    haze.length = 0; px = FAIR.cx; py = FAIR.y1 + 2;
    for (let k = 0; k < 40; k++) fireworkSmoke({ x: FAIR.cx + k, y: FAIR.y1 + 18, h: 20, col: k & 1 ? RED : CYAN });
    const clouds = haze.filter(p => p.kind === 'fwsmoke');
    return { byDay, fire: fire.length, fireAbove: fire.every(p => p.z > ground + .1), chimney: chimney.length, chimneyAbove: chimney.every(p => p.z >= roof),
      indoors, clouds: clouds.length, newest: Math.round(clouds.at(-1).x - FAIR.cx), oldest: Math.round(clouds[0].x - FAIR.cx), lit: fwLight.col === RED };
  });
  assert.deepEqual(r.byDay, { fire: 0, chimney: 0 }, 'a cold ring and a cold stove by day');
  assert.ok(r.fire >= 4 && r.fireAbove, 'smoke rises off the lit fire: ' + JSON.stringify(r));
  assert.ok(r.chimney >= 4 && r.chimneyAbove, 'Fern House chimney smokes after dark: ' + JSON.stringify(r));
  assert.equal(r.indoors, 0, 'no outdoor smoke is made while you are inside');
  assert.equal(r.clouds, 24); assert.equal(r.newest, 39); assert.equal(r.oldest, 16); assert.ok(r.lit);
}));
