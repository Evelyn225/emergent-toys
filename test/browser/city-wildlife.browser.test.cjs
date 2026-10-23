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

test('birds are life size beside people at the same distance: pigeon < gull < cormorant, all well under a person', () => fixture(async page => {
  const r = await page.evaluate(() => {
    [px, py] = citySourcePoint(12 * 8 + 0.15, 10 * 8 + 4); a = Math.PI / 2; pitch = -0.12;
    render(0); const z = terrainHeight(px, py + 0.5), metres = 10 / (projX / 0.5); // (columns to metres, side on, 5 m away; projX is set by a frame)
    const extent = fn => { render(0); const ch = CH.slice(), bg = BG.slice(); fn(); let r0 = 99, r1 = -1, c0 = 999, c1 = -1;
      for (let i = 0; i < CH.length; i++) if (CH[i] !== ch[i] || BG[i] !== bg[i]) { const r = i / cols | 0, c = i % cols; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
      return { rows: r1 - r0 + 1, length: (c1 - c0 + 1) * metres }; };
    return { person: extent(() => drawFigure(0, 0.5, z, 0.175, 1, 0, streetLook({ x: 0, y: 0, seed: 1 }), 'stand')),
      pigeon: extent(() => drawAnimal(0, 0.5, z, 0.09, 1, 0, PIGEON_LOOKS[0], 0)),
      gull: extent(() => drawAnimal(0, 0.5, z, ISLAND_BIRD_SIZE.gull, 1, 0, ISLAND_GULL_LOOK, 0)),
      cormorant: extent(() => drawAnimal(0, 0.5, z, ISLAND_BIRD_SIZE.cormorant, 1, 0, ISLAND_CORMORANT_LOOK, 0)) };
  });
  assert.ok(r.pigeon.length < r.gull.length && r.gull.length < r.cormorant.length, JSON.stringify(r));
  assert.ok(r.gull.length > 0.45 && r.gull.length < 0.75 && r.cormorant.length > 0.65 && r.cormorant.length < 1.05, 'gull ~60 cm, cormorant ~80 cm: ' + JSON.stringify(r));
  assert.ok(r.gull.rows * 3 < r.person.rows && r.cormorant.rows * 3 < r.person.rows, 'well under a person: ' + JSON.stringify(r));
}));

test('aquarium fish are shaped species: each a solid silhouette, its eye at the end it swims toward, still inside its tank', () => fixture(async page => {
  const r = await page.evaluate(() => {
    const species = {};
    for (const [sp, f] of Object.entries(FISH)) { // how much of its box each fills, and where its eye is
      let filled = 0, n = 0, eyeX = [];
      for (let x = 0.005; x < 1; x += 0.01) for (let y = -0.495; y < 0.5; y += 0.01) { n++; const h = f.shape(x, y, 3, 1); if (h) { filled++; if (h[0] === GRAY && h[1] <= 0.15) eyeX.push(x); } }
      species[sp] = { fill: filled / n, eye: eyeX.length ? eyeX.reduce((p, q) => p + q, 0) / eyeX.length : null };
    }
    enterRoom('aquarium', { word: 'AQUARIUM', ret: [100, 100, 0] }, [12, 13, -Math.PI / 2]);
    const run = tankRun(10, 1, 1, 'O'), heads = [];
    for (const time of [10, 40, 70]) { T = time; placeFish(run);
      for (const s of run.fish) {
        if (s.z < s.lo - 1e-9 || s.z > s.hi + 1e-9 || s.u < run.u0 || s.u > run.u1) heads.push('outside: ' + s.sp);
        if (!['fish', 'shark', 'tiny', 'sardine'].includes(s.sp)) continue;
        if (run.fish.some(o => o !== s && Math.abs(o.u - s.u) < (o.f.len + s.f.len) / 2 && Math.abs(o.z - s.z) < (o.f.h + s.f.h) / 2)) continue; // (in a school: its neighbour's eye could be the one found)
        let eye = null; // find its eye on the glass, from the side it's on
        for (let u = s.u - s.f.len / 2; u < s.u + s.f.len / 2 && eye === null; u += s.f.len / 120) for (let z = s.z - s.f.h / 2; z < s.z + s.f.h / 2; z += s.f.h / 40) { const h = fishAt(run, u, z); if (h && h[0] === GRAY && h[1] <= 0.15) { eye = u; break; } }
        if (eye !== null && Math.sign(eye - s.u) !== s.dir) heads.push('backwards: ' + s.sp);
      }
    }
    return { species, heads };
  });
  for (const [sp, v] of Object.entries(r.species)) assert.ok(v.fill > 0.12 && v.fill < 0.9, `${sp} fills ${v.fill}`);
  for (const sp of ['tiny', 'sardine', 'fish', 'clown', 'tang', 'angel', 'shark', 'turtle', 'seahorse']) assert.ok(r.species[sp].eye !== null, sp + ' has an eye');
  for (const sp of ['tiny', 'sardine', 'fish', 'clown', 'tang', 'angel', 'shark', 'turtle']) assert.ok(r.species[sp].eye > 0.6, sp + ' looks ahead: ' + r.species[sp].eye);
  assert.deepEqual(r.heads, []);
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
