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

test('the tunnel\'s big fish pass overhead as solid bellies, and its bubbles are little discs, not blocks of o', () => fixture(async page => {
  const r = await page.evaluate(() => {
    const shapes = {};
    for (const kind of ['shark', 'ray', 'turtle', 'fish']) { // how much of its box each covers, and what's down its middle
      let filled = 0, n = 0; const mid = tunnelBelly(kind, 0.5, 0, GRAY);
      for (let al = 0.005; al < 1; al += 0.01) for (let ac = -2; ac < 2; ac += 0.02) { n++; if (tunnelBelly(kind, al, ac, GRAY)) filled++; }
      shapes[kind] = { fill: filled / n, mid: mid && mid[0] };
    }
    enterRoom('aquarium', { word: 'AQUARIUM', ret: [100, 100, 0] }, [12, 8, -Math.PI / 2]);
    const views = {};
    for (const time of [21, 33.3]) { // the turtle, then the shark, gliding over you
      pitch = 1.4; T = time; render(0); const count = { o: 0, v: 0 };
      for (let i = 0; i < cols * rows; i++) { if (CH[i] === 'o' || CH[i] === 'v') count[CH[i]]++; if (CH[i] === ' ') count[BG[i] >> 4] = (count[BG[i] >> 4] || 0) + 1; }
      views[time] = { o: count.o, v: count.v, white: count[WHITE] || 0, yellow: count[YEL] || 0 };
    }
    return { shapes, views };
  });
  for (const [kind, v] of Object.entries(r.shapes)) assert.ok(v.fill > 0.08 && v.fill < 0.6, `${kind} covers ${v.fill}`);
  assert.deepEqual(Object.fromEntries(Object.entries(r.shapes).map(([k, v]) => [k, v.mid])), await page.evaluate(() => ({ shark: WHITE, ray: WHITE, turtle: YEL, fish: WHITE })));
  assert.ok(r.views[21].yellow > 200, 'the turtle\'s plastron overhead: ' + JSON.stringify(r.views));
  assert.ok(r.views[33.3].white > 200, 'the shark\'s belly overhead: ' + JSON.stringify(r.views));
  for (const v of Object.values(r.views)) assert.ok(v.o < 10 && v.v === 0, 'no ASCII fish or blocks of bubble: ' + JSON.stringify(v));
}));

test('aviary birds, conservatory butterflies and the lizard are shaped animals that face the way they move',() => fixture(async page => {
  const r = await page.evaluate(() => {
    const span = (kind, f) => { const xs = ANIMAL_BODIES[kind](f).parts.flatMap(p => p.k === 2 ? [p.a[0], p.b[0]] : [p.c[0]]); return Math.max(...xs) - Math.min(...xs); };
    const tops = (kind, f) => Math.max(...ANIMAL_BODIES[kind](f).parts.flatMap(p => p.k === 2 ? [p.a[2], p.b[2]] : [p.c[2]]));
    const frames = { parrotBeat: tops('parrot', 0) > tops('parrot', 1) + 3, finchBeat: tops('finch', 0) > tops('finch', 1) + 1.5, butterflyFolds: span('butterfly', 0) > span('butterfly', 1) * 2 && tops('butterfly', 1) > tops('butterfly', 0) + 0.5 };
    const rooms = {};
    for (const kind of ['aviary', 'conservatory']) {
      enterRoom(kind, { word: kind.toUpperCase(), ret: [100, 100, 0] }, [7, 10, -Math.PI / 2]);
      const animals = room.props.filter(p => p.draw && p.tick && !p.fig), ascii = room.props.filter(p => p.art && /\(o>|\}\{|~=</.test(p.art.join('')));
      let facing = 0, moved = 0;
      for (let k = 0; k < 30; k++) { T += 0.05; for (const p of animals) { const x0 = p.x, y0 = p.y; p.tick(p); const d = Math.hypot(p.x - x0, p.y - y0); if (d > 1e-4) { moved++; if ((p.x - x0) / d * p.hx + (p.y - y0) / d * p.hy > 0.99) facing++; } } }
      rooms[kind] = { animals: animals.length, ascii: ascii.length, moved, facing };
    }
    return { frames, rooms };
  });
  assert.deepEqual(r.frames, { parrotBeat: true, finchBeat: true, butterflyFolds: true });
  assert.equal(r.rooms.aviary.animals, 16); assert.equal(r.rooms.conservatory.animals, 11);
  for (const v of Object.values(r.rooms)) { assert.equal(v.ascii, 0); assert.ok(v.moved > 100 && v.facing === v.moved, JSON.stringify(v)); }
}));

test('the fish on your line is a shaped fish of its own colour and size, not a string of characters', () => fixture(async page => {
  const r = await page.evaluate(() => {
    clearInventory(); carryItem({ id: 'rod', uses: 0 }); held = 0;
    px = FISH_HUT.x - 3; py = shoreS(px) - 0.25; a = Math.PI / 2; pitch = -0.15;
    const id = Object.keys(ITEMS).find(k => ITEMS[k].kind === 'fish' && ITEMS[k].col === ORANGE);
    const paint = kg => { fishing = { st: 'reel', t: 0.5, dur: 2, catch: { id, kg }, x: px + 0.05, y: py + 0.35, z: 0.06, sx: px, sy: py + 0.9, sz: 0, d: 1, rod: 'rod', water: 'sea' };
      render(0); let n = 0; for (let i = 0; i < BG.length; i++) if (CH[i] === ' ' && (BG[i] >> 4) === ORANGE) n++; return { cells: n, ascii: /<o\)\)\)/.test(CH.join('')) }; };
    const small = paint(0.3), big = paint(6);
    return { small, big, lengths: [catchLength(0.5), catchLength(4), catchLength(40)] };
  });
  assert.ok(!r.small.ascii && !r.big.ascii, 'no <o)))>< on the line');
  assert.ok(r.small.cells > 3 && r.big.cells > r.small.cells * 2, 'a painted fish, bigger for a bigger catch: ' + JSON.stringify(r));
  assert.ok(Math.abs(r.lengths[0] - 0.3) < 1e-9 && Math.abs(r.lengths[1] - 0.6) < 1e-9 && r.lengths[2] > 1.2 && r.lengths[2] < 1.6, JSON.stringify(r.lengths));
}));

test('island butterflies by day are shaped butterflies in their colours; by night, fireflies glow', () => fixture(async page => {
  const r = await page.evaluate(() => {
    const f = ISLAND_FLOWERS[0]; T = 10;
    const phase = T * 0.6 + f.seed * TAU, x = f.x + Math.sin(phase) * 0.12, y = f.y + Math.cos(phase * 0.7) * 0.1;
    px = x; py = y + 0.06; a = -Math.PI / 2; pitch = -0.1;
    const look = () => { render(0); let wing = 0, glow = 0; for (let i = 0; i < BG.length; i++) { if (CH[i] === ' ' && [YEL, ORANGE, BLUE, MAG, WHITE].includes(BG[i] >> 4) && (BG[i] & 15) > 8) wing++; if (CH[i] === '.' && (COL[i] >> 4) === YEL && (COL[i] & 15) >= 12) glow++; } return { wing, glow, ascii: /[v^]/.test(CH.join('').slice(0, cols * (hor + 4))) }; };
    tod = 13; env(0); const day = look();
    tod = 23; env(0); const nightLook = look();
    return { day, night: nightLook };
  });
  assert.ok(r.day.wing >= 4, 'a butterfly by day: ' + JSON.stringify(r));
  assert.ok(r.night.glow >= 1 && r.night.wing < r.day.wing, 'a firefly by night: ' + JSON.stringify(r));
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
