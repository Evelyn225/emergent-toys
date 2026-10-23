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

test('sports: the ball thuds as it bounces (dying away), knocks off walls, is heard once as you dribble into it, and splashes', () => fixture(async page => {
  const r = await page.evaluate(async () => {
    audioStart(); await new Promise(res => { const wait = () => actx.state === 'running' ? res() : setTimeout(wait, 20); wait(); });
    const heard = [], real = sfxBall; sfxBall = (kind, x, y, z, k) => heard.push({ kind, k });
    try {
      mode = 'walk'; room = null; px = 314.5; py = 304.4; a = -Math.PI / 2; // (in front of a building's south wall)
      kickBall(px, py, a);
      for (let k = 0; k < 150; k++) { T += 1 / 30; stepBall(1 / 30); }
      const kicked = heard.splice(0), walls = kicked.filter(h => h.kind === 'wall'), bounces = kicked.filter(h => h.kind === 'bounce');
      // walk into it: one touch, not one a frame
      ball.vx = ball.vy = ball.vz = 0; ball.z = 0; px = ball.x; py = ball.y + .05;
      for (let k = 0; k < 6; k++) { T += 1 / 30; stepBall(1 / 30); px = ball.x; py = ball.y + .05; }
      const touches = heard.splice(0).filter(h => h.kind === 'touch').length;
      // into the sea
      let sea = null;
      for (let y = 0; y < 512 && !sea; y += 2) for (let x = 0; x < 864 && !sea; x += 2) if (isWater(x + .5, y + .5) && !isWater(x + .5, y - 1.5)) sea = [x + .5, y + .5];
      px = sea[0]; py = sea[1] - 1; ball = { x: sea[0], y: sea[1], z: 0, vx: 0, vy: 0, vz: 0 }; const lost = stepBall(1 / 30);
      return { walls: walls.map(h => h.k), bounces: bounces.map(h => h.k), touches, lost, splash: heard.some(h => h.kind === 'splash') };
    } finally { sfxBall = real; }
  });
  assert.ok(r.walls.length >= 1, 'it comes back off the wall: ' + JSON.stringify(r));
  assert.ok(r.bounces.length >= 2 && r.bounces[0] > r.bounces.at(-1), 'bounces die away: ' + JSON.stringify(r));
  assert.equal(r.touches, 1, 'a touch, not one every frame');
  assert.ok(r.lost === 'lost' && r.splash, 'and into the drink with a splash');
}));

test('workshops: the batch rotor hums with the power you give it, vents hiss, seals thunk, and it all stops with the batch', () => fixture(async page => {
  const r = await page.evaluate(async () => {
    audioStart(); await new Promise(res => { const wait = () => actx.state === 'running' ? res() : setTimeout(wait, 20); wait(); });
    const clock = s => { const t0 = actx.currentTime; return new Promise(res => { const wait = () => actx.currentTime > t0 + s ? res() : setTimeout(wait, 20); wait(); }); };
    const heard = [], realBurst = burst, realTone = tone;
    burst = (at, len, filters) => heard.push('noise:' + filters[0].type); tone = (at, f) => heard.push('tone:' + Math.round(f));
    try {
      startGame('workshop', 'workshop', '', {});
      sfxGame('vent'); const vent = heard.splice(0); sfxGame('seal'); const seal = heard.splice(0);
      burst = realBurst; tone = realTone;
      audioTick(1 / 30); await clock(.4); const idle = workshopHumVoice.o.frequency.value;
      for (let k = 0; k < 60; k++) game.g.step(1 / 30, { act: true });
      audioTick(1 / 30); await clock(.4); const powered = workshopHumVoice.o.frequency.value;
      game = null; audioTick(1 / 30); const after = workshopHumVoice;
      return { vent, seal, idle, powered, after };
    } finally { burst = realBurst; tone = realTone; }
  });
  assert.deepEqual(r.vent, ['noise:highpass'], 'a vent is a hiss, not an arcade blip');
  assert.ok(r.seal.includes('tone:85') && r.seal.includes('noise:lowpass'), 'a seal is the press coming down: ' + JSON.stringify(r.seal));
  assert.ok(r.powered > r.idle + 20, 'the rotor hums higher with more power: ' + JSON.stringify(r));
  assert.equal(r.after, null, 'and stops when the batch is done');
}));

test('cooking: a burnt dish leaves the kitchen smoky and chirps the smoke alarm while you are in there; a good one just steams', () => fixture(async page => {
  const r = await page.evaluate(async () => {
    audioStart(); await new Promise(res => { const wait = () => actx.state === 'running' ? res() : setTimeout(wait, 20); wait(); });
    const chirps = [], realTone = tone; tone = (at, f) => { if (f === 3100) chirps.push(at); };
    const cook = verdict => { // the real path: the panel, a recipe, the pan, and the end of it
      clearInventory(); carryItem({ id: Object.keys(ITEMS).find(k => ITEMS[k].kind === 'fish'), uses: 1 }); carryItem({ id: 'butter', uses: 1 });
      openCooking(mode === 'room' ? 'stove' : 'grill', [], mode === 'room' ? null : nearGrill()); startCooking(RECIPES.find(r => r.id === 'panfish'));
      const done = game.onDone; game = null; done(verdict);
    };
    try {
      enterRoom('islandshelter', { ret: [626, 195, 0] }, [6, 8, 0]); haze.length = 0;
      cook('burnt'); const key = placeKey(), smoke = haze.filter(p => p.at === key && p.kind === 'smoke');
      for (let k = 0; k < 10; k++) { T += .5; tickSmokeAlarm(); } const inRoom = chirps.length;
      const lingering = haze.filter(p => p.at === key).length; for (let k = 0; k < 60; k++) stepHaze(.25); const after15s = haze.filter(p => p.at === key).length;
      chirps.length = 0; smokeAlarm = { at: key, until: T + 8, next: T }; leaveRoom(); for (let k = 0; k < 6; k++) { T += .5; tickSmokeAlarm(); } const outside = chirps.length;
      // a fine dish at the grill outside: a little steam, no alarm
      const grill = GRILLS.find(g => g.on === 'grill'); mode = 'walk'; room = null; px = grill.x; py = grill.y + .2; haze.length = 0; smokeAlarm = null;
      cook('fine');
      return { smoke: smoke.length, inRoom, lingering, after15s, outside, grillHaze: haze.map(p => p.kind), grillAlarm: smokeAlarm };
    } finally { tone = realTone; }
  });
  assert.ok(r.smoke >= 6, 'smoke fills the kitchen: ' + JSON.stringify(r));
  assert.ok(r.inRoom >= 6 && r.inRoom % 3 === 0, 'the alarm chirps in threes: ' + JSON.stringify(r));
  assert.ok(r.after15s >= r.lingering * .75, 'and the smoke hangs about indoors');
  assert.equal(r.outside, 0, 'not heard once you have left the room');
  assert.ok(r.grillHaze.length === 2 && r.grillHaze.every(k => k === 'steam') && r.grillAlarm === null, JSON.stringify(r));
}));

test('fishing: the bobber is heard out where it lands (later, quieter, to its side), and a bad cast ticks on the ice', () => fixture(async page => {
  const r = await page.evaluate(async () => {
    audioStart(); await new Promise(res => { const wait = () => actx.state === 'running' ? res() : setTimeout(wait, 20); wait(); });
    const heard = [], realClip = playClip, realSweep = fishSweep, realNoise = fishNoise;
    playClip = (name, gain, when, spatial) => heard.push({ what: name, gain, delay: when - actx.currentTime, pan: spatial?.pan });
    fishSweep = (at, f0, f1, len, gain, type, pan) => heard.push({ what: 'sweep', gain, pan });
    fishNoise = (at, len, f0, f1, q, gain, attack, pan) => heard.push({ what: 'noise', gain, pan, delay: at - actx.currentTime });
    try {
      mode = 'walk'; room = null; px = 300; py = 300; a = 0; eye = terrainHeight(px, py) + .17;
      fishing = { x: 300.2, y: 298.2, z: 0, st: 'wait' }; // (18 m out and off to the left)
      fishSfx.push('plop'); stepFishingUI(); const plop = heard.splice(0);
      fishSfx.push('skitter'); stepFishingUI(); const skitter = heard.splice(0);
      fishSfx.push('whoosh'); stepFishingUI(); const whoosh = heard.splice(0);
      return { plop, skitter, whoosh };
    } finally { playClip = realClip; fishSweep = realSweep; fishNoise = realNoise; fishing = null; }
  });
  const drip = r.plop.find(h => h.what === 'water-drip');
  assert.ok(drip && drip.gain < .6 && Math.abs(drip.delay - Math.hypot(.2, 1.8) / 34) < .01 && drip.pan < -.5, 'the plop comes from the bobber: ' + JSON.stringify(r.plop));
  assert.ok(r.skitter.length >= 4 && r.skitter.every(h => h.pan < -.5), 'ticks across the ice, out there: ' + JSON.stringify(r.skitter));
  assert.ok(r.whoosh.every(h => !h.pan && h.delay < .2), 'the cast itself is right here with you');
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
