'use strict';
// The airport's aircraft, end to end in the real page: buy one, fly it off the runway, bail out, come down on the
// parachute; steal one and the tower calls it in; an owned one is kept across a reload.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_ = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;

test('buy a Skylark, take off, bail out, and land on the parachute; steal a Hornet and the police hear', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepFlight === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      paused = true; mode = 'walk'; room = null; money = 20000; clearWanted(); needs.health = 100;
      for (const k of Object.keys(K)) K[k] = 0;
      const dt = 1 / 60, out = {};
      const stand = c => { const T_ = PLANE_TYPES[c.type], f = T_.heli ? 0.05 : T_.len * 0.25; px = c.x + Math.cos(c.yaw) * f + 0.2; py = c.y + Math.sin(c.yaw) * f; };
      // buy
      const prop = aircraft.find(c => c.type === 'prop'); stand(prop);
      out.prompt = promptText();
      buyAircraft(prop); out.bought = [prop.owned, money];
      // in, onto the runway, full power, pull up at speed
      interact(); out.inMode = mode;
      prop.x = RUNWAY.x0 + 1; prop.y = RUNWAY.y; prop.yaw = 0;
      K.KeyW = 1;
      for (let t = 0; t < 30 && prop.ground; t += dt) { K.ArrowUp = prop.v > PLANE_TYPES.prop.vr ? 1 : 0; stepFlight(dt); }
      out.offAt = prop.x; out.airborne = !prop.ground;
      for (let t = 0; t < 12; t += dt) { K.ArrowUp = prop.z < 12 ? 1 : 0; stepFlight(dt); }
      K.KeyW = K.ArrowUp = 0; out.alt = prop.z;
      out.airPrompt = promptText();
      // bail out, and fall till the canopy opens itself and you land
      interact(); out.bailed = [mode, !!chute, prop.state];
      let opened = false;
      for (let t = 0; t < 120 && chute; t += dt) { stepChute(dt); stepBody(dt); stepRoof(); stepAirWrecks(dt); opened ||= !!(chute && chute.open); }
      out.chute = { opened, down: !chute, mode, health: needs.health, z: body.z };
      for (let t = 0; t < 60 && prop.state === 'abandoned'; t += dt) stepAirWrecks(dt);
      out.planeDown = [prop.state, prop.fireT != null || !!prop.ditched || prop.ground];
      // steal
      mode = 'walk'; body.z = body.vz = 0; chute = null;
      const heli = aircraft.find(c => c.type === 'heli'); stand(heli);
      out.stealPrompt = promptText();
      interact(); out.stolen = [mode, wanted.stars, wanted.crime];
      return out;
    });
    assert.equal(r.prompt, 'E: steal the Skylark   U: buy it for $9000.00');
    assert.deepEqual(r.bought, [true, 11000]);
    assert.equal(r.inMode, 'air');
    assert.ok(r.airborne && r.offAt < 50, `off the ground with runway to spare (x ${r.offAt})`);
    assert.ok(r.alt > 8, `climbing (${r.alt * 10}m)`);
    assert.equal(r.airPrompt, 'CLICK to fly with the mouse   E: bail out', 'the mouse is the stick: uncaptured (as here, headless), it says so');
    assert.deepEqual(r.bailed, ['walk', true, 'abandoned']);
    assert.ok(r.chute.opened && r.chute.down, JSON.stringify(r.chute));
    assert.equal(r.chute.health, 100, 'a landing under a full canopy doesn\'t hurt');
    assert.ok(r.planeDown[0] === 'parked' && r.planeDown[1], `the empty plane came down: ${r.planeDown}`);
    assert.equal(r.stealPrompt, 'E: steal the Hornet   U: buy it for $14000.00');
    assert.deepEqual(r.stolen, ['air', 2, 'aircraft theft']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an aircraft you own is kept, where you parked it, across a reload', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(URL_);
    await page.waitForFunction(() => typeof saveGame === 'function' && typeof aircraft !== 'undefined');
    await page.evaluate(() => { localStorage.clear(); const c = aircraft.find(c => c.type === 'jet'); c.owned = true; c.forSale = false; c.x = 35; c.y = RUNWAY.y; saveGame(); });
    await page.reload();
    await page.waitForFunction(() => typeof aircraft !== 'undefined' && aircraft.some(c => c.owned));
    const got = await page.evaluate(() => aircraft.filter(c => c.owned).map(c => [c.type, c.x, c.y === RUNWAY.y]));
    assert.deepEqual(got, [['jet', 35, true]]);
    await page.evaluate(() => localStorage.clear());
  } finally { await browser.close(); }
});

test('the terminal hall: the departures board keeps time all day and night, and the hall draws without a hitch', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepFlight === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      const out = { counts: [], ordered: true };
      for (let h = 0; h < 24; h += 0.25) {
        tod = h;
        for (const dep of [true, false]) {
          const lines = boardLines(dep), mins = lines.map(l => +l.text.slice(0, 2) * 60 + +l.text.slice(3, 5));
          out.counts.push(lines.length);
          for (let k = 1; k < mins.length; k++) if (!(mins[k] > mins[k - 1] || mins[k - 1] >= 22 * 60 && mins[k] === 6 * 60)) out.ordered = false; // (late on, tomorrow's first follows tonight's last)
        }
      }
      tod = 23.5; out.late = boardLines(true)[0].text;
      tod = 11.1; out.now = boardLines(true).map(l => l.status);
      // stand in the doors and look in: the board, in letters
      paused = true; room = null; mode = 'walk'; px = TERMINAL.x; py = TERMINAL.y - TERMINAL.hw - 0.4; a = Math.PI / 2; pitch = 0.1; render(0);
      out.seen = CH.join('');
      return out;
    });
    assert.ok(r.counts.every(n => n === 5), 'always five flights up');
    assert.ok(r.ordered, 'in time order');
    assert.ok(r.late.startsWith('06:00'), `after the last flight, the morning's first: ${r.late}`);
    assert.deepEqual(r.now.slice(0, 2), ['DEPARTED', 'BOARDING'], 'the one just gone, then the one boarding');
    assert.ok(/D\s*E\s*P\s*A\s*R\s*T\s*U\s*R\s*E\s*S/.test(r.seen), 'DEPARTURES, through the doors');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('going in: the crash plays out before you are on foot; ditched in the bay, you swim to the nearest land', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepFlight === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      paused = true; mode = 'walk'; room = null; money = 0; clearWanted(); needs.health = 100;
      for (const k of Object.keys(K)) K[k] = 0;
      const dt = 1 / 60, out = {}, run = secs => { for (let t = 0; t < secs && mode === 'air'; t += dt) { stepFlight(dt); stepAirWrecks(dt); stepWake(dt); } };
      // into the ground: still in the air mode a second after, then on foot beside the wreck, the screen coming back
      const jet = aircraft.find(c => c.type === 'jet'); enterAircraft(jet);
      Object.assign(jet, { x: 120, y: 40, z: 2, v: 8, pitch: -0.8, ground: false, throttle: 1 });
      for (let t = 0; t < 20 && !wreckCam && mode === 'air'; t += dt) stepFlight(dt);
      out.wreck = wreckCam && wreckCam.kind; run(1);
      out.stillWatching = mode === 'air'; run(5);
      out.after = [mode, fade > 0, Math.hypot(rel(px - jet.x), rel(py - jet.y)) < 6];
      // into the bay, off the airport's far shore: ashore close by, not at the marina
      needs.health = 100; clearWanted(); wakeT = 0; fade = 0;
      const heli = aircraft.find(c => c.type === 'heli'); enterAircraft(heli);
      const x0 = 40, y0 = AIRPORT.y1 + 5; Object.assign(heli, { x: x0, y: y0, z: 0.5, rotor: 1, ground: false, vz: -1, hvx: 0, hvy: 0 });
      out.overBay = overWater(x0, y0);
      K.KeyF = 1; for (let t = 0; t < 20 && !wreckCam && mode === 'air'; t += dt) stepFlight(dt); K.KeyF = 0;
      out.ditch = wreckCam && wreckCam.kind; run(6);
      out.ashore = [mode, seaAt(px, py) || isWater(px, py), Math.hypot(rel(px - x0), rel(py - y0)), Math.hypot(rel(px - MARINA.x), rel(py - MARINA.y0))];
      return out;
    });
    assert.equal(r.wreck, 'crash');
    assert.ok(r.stillWatching, 'the crash plays out before you are put on foot');
    assert.deepEqual(r.after, ['walk', true, true], 'then on foot by the wreck, fading in');
    assert.ok(r.overBay, 'the test ditches over open water');
    assert.equal(r.ditch, 'ditch');
    assert.equal(r.ashore[0], 'walk');
    assert.equal(r.ashore[1], false, 'on dry land');
    assert.ok(r.ashore[2] < 8, `ashore near where it went in (${r.ashore[2].toFixed(1)} cells)`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
