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
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
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

test('damage: a round leaves a hole on the face of the wall it hit, and clanks off a car or chips a wall where it lands', () => fixture(async page => {
  const r = await page.evaluate(async () => {
    audioStart(); await new Promise(res => { const wait = () => actx.state === 'running' ? res() : setTimeout(wait, 20); wait(); });
    const sounds = [], realBurst = burst, realTone = tone;
    burst = (at, len, filters, gain, pan) => sounds.push({ kind: 'burst', f: filters[0].frequency.value, gain, pan });
    tone = (at, freq, len, gain, type, pan) => sounds.push({ kind: 'tone', f: freq, gain, pan });
    try {
      let spot = null; // a building's south wall with open, flat ground in front of it
      for (let y = 300; y < 500 && !spot; y++) for (let x = 300; x < 500 && !spot; x++)
        if (map[idx(x, y)] > .6 && !map[idx(x, y + 1)] && !map[idx(x, y + 2)] && !ROAD[idx(x, y + 1)] && Math.abs(terrainHeight(x + .5, y + 1.4) - terrainHeight(x + .5, y + 1.05)) < .002) spot = [x, y];
      const [cx, cy] = spot;
      clearInventory(); carryItem({ id: 'revolver', uses: 6 }); held = 0; gun.cool = gun.reload = 0;
      mode = 'walk'; room = null; px = cx + .5; py = cy + 1.4; a = -Math.PI / 2; pitch = 0; render(0);
      pullTrigger();
      const wall = sounds.splice(0).filter(s => s.kind === 'burst' && s.f >= 2000), hole = { ...bulletHoles[0] };
      render(0); const p = fishProj(rel(hole.x - px), rel(hole.y - py), hole.z), drawn = CH[Math.floor(p.r) * cols + Math.floor(p.c)];
      // a parked car a few metres ahead, to the east
      const cars0kind = Object.keys(VEHICLES)[0];
      a = 0; pitch = -.3; render(0); gun.cool = 0; cars.push({ kind: cars0kind, x: px + .4, y: py, hx: 1, hy: 0, v: 0, parked: true, ex: px + .4, ey: py, dmg: 0 });
      pullTrigger();
      const clank = sounds.filter(s => s.kind === 'tone' && s.f > 800);
      return { cy, holes: bulletHoles.length, hole, wall: wall.length, drawn, clank: clank.length, carHit: cars.at(-1).dmg > 0 };
    } finally { burst = realBurst; tone = realTone; }
  });
  assert.equal(r.holes, 1, 'the car hit leaves no wall hole');
  assert.ok(Math.abs(r.hole.y - (r.cy + 1)) < .002 && r.hole.ny === 1 && r.hole.nx === 0, 'on the south face, facing out: ' + JSON.stringify(r.hole));
  assert.ok(r.wall >= 1, 'a chip off the wall');
  assert.match(r.drawn, /[o.]/, 'the hole is drawn on the wall');
  assert.ok(r.carHit && r.clank >= 1, 'a clank off the car: ' + JSON.stringify(r));
}));

test('skating: each push lands with a scuff, a dragged foot scrapes, a wall scrapes, and the wheels whirr up with speed', () => fixture(async page => {
  const r = await page.evaluate(async () => {
    audioStart(); await new Promise(res => { const wait = () => actx.state === 'running' ? res() : setTimeout(wait, 20); wait(); });
    paused = true; mode = 'walk'; room = null; me = null; [px, py] = citySourcePoint(41.5, 73.5); a = 0; third = true;
    carryItem({ id: 'skateboard', uses: 0 }); held = inv.findIndex(it => it.id === 'skateboard'); fx.skating = true;
    Object.assign(body, { z: 0, vz: 0, peak: 0, mx: 0, my: 0, trick: null, seat: null, crouch: 0, buf: -9 }); SK.lastT = -9;
    const heard = [], real = sfxSkate; sfxSkate = (kind, k) => heard.push(kind);
    const ride = (n, keys = {}) => { for (let k = 0; k < n; k++) { for (const c in K) K[c] = 0; Object.assign(K, keys); T += 1 / 30; stepSkate(1 / 30); stepBody(1 / 30); } };
    const count = kind => heard.filter(h => h === kind).length;
    try {
      ride(1); ride(42, { KeyW: 1 }); const pushes = count('push'), cruising = SK.v;
      const clock = s => { const t0 = actx.currentTime; return new Promise(res => { const wait = () => actx.currentTime > t0 + s ? res() : setTimeout(wait, 20); wait(); }); };
      await new Promise(res => { const wait = () => synth.board.src ? res() : setTimeout(wait, 20); wait(); });
      audioTick(1 / 30); await clock(.4); const fast = synth.board.src.playbackRate.value;
      const v0 = SK.v; SK.v = .15; audioTick(1 / 30); await clock(.4); const slow = synth.board.src.playbackRate.value; SK.v = v0;
      heard.length = 0; ride(20, { KeyS: 1 }); const drags = count('drag');
      // into the wall of the nearest building, at an angle, at speed
      let wall = null;
      for (let y = 300; y < 500 && !wall; y++) for (let x = 300; x < 500 && !wall; x++)
        if (map[idx(x, y)] > .6 && !map[idx(x, y + 1)] && !map[idx(x, y + 2)] && !ROAD[idx(x, y + 1)]) wall = [x, y];
      px = wall[0] + .5; py = wall[1] + 1.3; a = -Math.PI / 2 + .35; SK.dir = a; SK.v = SK_TOP; heard.length = 0; ride(30);
      return { pushes, cruising, drags, scrapes: count('scrape'), slow, fast };
    } finally { sfxSkate = real; }
  });
  assert.ok(r.pushes >= 2 && r.pushes <= 3, 'one scuff per push, not per frame: ' + JSON.stringify(r));
  assert.ok(r.drags >= 3, 'the dragged foot scrapes while braking: ' + JSON.stringify(r));
  assert.ok(r.scrapes >= 1, 'the deck scrapes along the wall: ' + JSON.stringify(r));
  assert.ok(r.fast > r.slow, 'the wheels whirr higher at speed');
}));

test('crime: a shot parked car sets its alarm off where it stands, one voice, gone after a while or when you get in', () => fixture(async page => {
  const r = await page.evaluate(async () => {
    audioStart(); await new Promise(res => { const wait = () => actx.state === 'running' ? res() : setTimeout(wait, 20); wait(); });
    mode = 'walk'; room = null; px = 314.5; py = 304.4; a = 0; pitch = -.3; render(0);
    const kind = Object.keys(VEHICLES)[0], c = { kind, x: px + .4, y: py - .15, hx: 1, hy: 0, v: 0, parked: true, ex: px + .4, ey: py - .15, dmg: 0 };
    cars.push(c); clearInventory(); carryItem({ id: 'revolver', uses: 6 }); held = 0; gun.cool = gun.reload = 0;
    a = Math.atan2(c.y - py, c.x - px); render(0); pullTrigger();
    a += Math.PI / 2; tickCarAlarms(); // (turned to the right: the car's now on your left)
    const t0 = actx.currentTime; await new Promise(res => { const wait = () => actx.currentTime > t0 + .3 ? res() : setTimeout(wait, 20); wait(); });
    const v = carAlarms.get(c), going = { alarming: carAlarming(c), voices: carAlarms.size, gain: v?.g.gain.value, pan: v?.p.pan.value };
    T += CAR_ALARM_T + .1; tickCarAlarms(); const after = carAlarms.size;
    damageCar(c, 1); tickCarAlarms(); const again = carAlarms.size;
    c.player = true; tickCarAlarms(); const inside = carAlarms.size;
    return { going, after, again, inside };
  });
  assert.ok(r.going.alarming && r.going.voices === 1 && r.going.gain > .01, JSON.stringify(r.going));
  assert.ok(r.going.pan < -.3, 'the car is off to your left: ' + JSON.stringify(r.going));
  assert.deepEqual([r.after, r.again, r.inside], [0, 1, 0]);
}));
