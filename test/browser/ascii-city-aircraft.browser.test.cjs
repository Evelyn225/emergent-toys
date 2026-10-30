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
      out.offAt = prop.x-CITY_LAYOUT.airportX; out.airborne = !prop.ground;
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

test('shot to burning in a stolen Comet: told to bail, the seat fires you up and the chute opens itself; stay in and it nearly kills you', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepFlight === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      const dt = 1 / 60, out = {};
      const up = () => { // in the Comet, stolen, up at 300m over the bay side of the runway, and on fire
        paused = true; mode = 'walk'; room = null; clearWanted(); needs.health = 100; chute = null; body.z = body.vz = 0;
        for (const k of Object.keys(K)) K[k] = 0;
        const c = aircraft.find(c => c.type === 'jet'); returnHome(c);
        px = c.x + Math.cos(c.yaw) * PLANE_TYPES.jet.len * 0.25 + 0.2; py = c.y + Math.sin(c.yaw) * PLANE_TYPES.jet.len * 0.25; interact();
        Object.assign(c, { ground: false, z: 30, v: 7, pitch: 0, roll: 0, vz: 0, x: RUNWAY.x0 + 5, y: RUNWAY.y, yaw: 0 });
        damageCraft(c, DMG_FIRE); stepFlight(dt);
        return c;
      };
      let c = up();
      out.warned = msgText;
      interact(); out.out = [mode, !!chute, c.state, body.vz];
      let opened = null, top = body.z;
      for (let t = 0; t < 4 && chute && opened == null; t += dt) { T += dt; stepChute(dt); stepBody(dt); stepRoof(); top = Math.max(top, body.z); if (chute.open) opened = t; }
      out.ejected = { opened, rose: top - 299 };
      // again, and stay in it till it goes up
      c = up(); c.throttle = 0.6;
      for (let t = 0; t < 20 && mode === 'air'; t += dt) { T += dt; stepAirWrecks(dt); if (mode === 'air') stepFlight(dt); }
      out.stayed = { mode, health: needs.health, said: msgText };
      return out;
    });
    assert.match(r.warned, /E: bail out/, 'it tells you how to get out');
    assert.deepEqual(r.out.slice(0, 3), ['walk', true, 'abandoned']);
    assert.ok(r.out[3] > 20, 'the seat fires you upward');
    assert.ok(r.ejected.rose > 20, `well up and clear (${r.ejected.rose.toFixed(1)}m)`);
    assert.ok(r.ejected.opened != null && r.ejected.opened < 2, `the chute opens by itself, high up (${r.ejected.opened})`);
    assert.ok(r.stayed.mode === 'room' || r.stayed.health <= 10, `going up with it all but kills you: ${JSON.stringify(r.stayed)}`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an aircraft you own is kept, where you parked it, across a reload', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(URL_);
    await page.waitForFunction(() => typeof saveGame === 'function' && typeof aircraft !== 'undefined');
    await page.evaluate(() => { localStorage.clear(); const c = aircraft.find(c => c.type === 'jet'); c.owned = true; c.forSale = false; c.x = 35+CITY_LAYOUT.airportX; c.y = RUNWAY.y; saveGame(); });
    await page.reload();
    await page.waitForFunction(() => typeof aircraft !== 'undefined' && aircraft.some(c => c.owned));
    const got = await page.evaluate(() => aircraft.filter(c => c.owned).map(c => [c.type, c.x-CITY_LAYOUT.airportX, c.y === RUNWAY.y]));
    assert.deepEqual(got, [['jet', 35, true]]);
    await page.evaluate(() => localStorage.clear());
  } finally { await browser.close(); }
});

test('the terminal: in by its doors with E, the departures board keeping time inside, every part of the hall reachable, and out by the gates onto the apron', async () => {
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
      // at the main doors, E takes you in: the board, in letters, over the hall
      paused = true; tod = 11.1; room = null; mode = 'walk'; px = TERMINAL.x; py = TERMINAL.y - TERMINAL.hw - 0.2; a = Math.PI / 2;
      out.prompt = promptText(); interact(); out.inside = mode === 'room' && room.kind;
      px = 16; py = 12.4; a = -Math.PI / 2; pitch = 0.45; render(0);
      out.seen = CH.join('');
      // every bit of it reachable from the main doors: both doors out to the gates, the café's counter, the toilet
      for (const d of room.bathroomDoors || []) { d.bathroomDoor.open = d.bathroomDoor.target = 1; d.box = null; } // (the washroom door starts shut: open it, as you would with E)
      const S = 10, W = room.W * S, H = room.H * S, seen = new Uint8Array(W * H), q = [[16 * S, Math.round(12.4 * S)]];
      out.gates = new Set(); out.cafe = false; out.loo = false;
      while (q.length) {
        const [x, y] = q.pop();
        if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue;
        seen[y * W + x] = 2;
        const wx = x / S, wy = y / S;
        if (!free(wx, wy)) { seen[y * W + x] = 1; continue; }
        if (roomAt(wx, wy - 0.45) === 'D') out.gates.add(Math.floor(wx) < 16 ? 'east' : 'west');
        px = wx; py = wy;
        if (nearKeeper()) out.cafe = true;
        if (inWc(wx, wy) && looNear()) out.loo = true;
        q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      out.gates = [...out.gates].sort();
      out.pockets = [];
      for (let cy = 0; cy < room.H; cy++) for (let cx = 0; cx < room.W; cx++) {
        if (roomAt(cx, cy) !== '.') continue;
        let clear = 0, reached = 0;
        for (let sy = 1; sy < S; sy += 2) for (let sx = 1; sx < S; sx += 2) { const x = cx * S + sx, y = cy * S + sy; if (free(x / S, y / S)) { clear++; if (seen[y * W + x] === 2) reached++; } }
        if (clear >= 6 && !reached) out.pockets.push(`${cx},${cy}`);
      }
      out.stock = stockFor('terminal', room.word).length;
      // C at a row of seats at a gate: you sit in one, facing the planes
      px = 14.3; py = 3.6; a = -Math.PI / 2; out.sat = sitDown() && body.seat.fy === -1; standUp();
      // out through the west gates' door: on the apron, by it, facing the planes
      px = 23; py = 1.6; a = -Math.PI / 2; leaveRoom();
      out.out = [mode, terminalDoor(px, py), !airportBlocked(px, py, 0.03)];
      return out;
    });
    assert.ok(r.counts.every(n => n === 5), 'always five flights up');
    assert.ok(r.ordered, 'in time order');
    assert.ok(r.late.startsWith('06:00'), `after the last flight, the morning's first: ${r.late}`);
    assert.deepEqual(r.now.slice(0, 2), ['DEPARTED', 'BOARDING'], 'the one just gone, then the one boarding');
    assert.equal(r.prompt, 'E: into the terminal');
    assert.equal(r.inside, 'terminal', 'E at the doors takes you in');
    assert.ok(/DEPARTURES|[\u2580-\u259F]{3}/.test(r.seen.replace(/\s/g, '')), 'DEPARTURES, up on the board');
    assert.deepEqual(r.gates, ['east', 'west'], 'both doors out to the gates, past security');
    assert.ok(r.cafe && r.stock > 0, 'up to the café counter, and it sells you something');
    assert.ok(r.loo, 'and the restrooms');
    assert.ok(r.sat, 'and you can sit at a gate');
    assert.deepEqual(r.pockets, [], 'no floor you cannot get to');
    assert.deepEqual(r.out, ['walk', 1, true], 'out by the gates: on the apron at that door');
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
      const [crashX,crashY]=citySourcePoint(120,40);
      Object.assign(jet, { x: crashX, y: crashY, z: 2, v: 8, pitch: -0.8, ground: false, throttle: 1 });
      for (let t = 0; t < 20 && !wreckCam && mode === 'air'; t += dt) stepFlight(dt);
      out.wreck = wreckCam && wreckCam.kind; run(1);
      out.stillWatching = mode === 'air'; run(5);
      out.after = [mode, fade > 0, Math.hypot(rel(px - jet.x), rel(py - jet.y)) < 6];
      // into the bay, off the airport's far shore: ashore close by, not at the marina
      needs.health = 100; clearWanted(); wakeT = 0; fade = 0;
      const heli = aircraft.find(c => c.type === 'heli'); enterAircraft(heli);
      const x0 = 40+CITY_LAYOUT.airportX, y0 = AIRPORT.y1 + 5; Object.assign(heli, { x: x0, y: y0, z: 0.5, rotor: 1, ground: false, vz: -1, hvx: 0, hvy: 0 });
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

test('flying in fog: the view is fogged right down to the instruments, from the cockpit and from behind; the instruments never are', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepFlight === 'function' && Number.isFinite(eye));
    const rowFog = () => page.evaluate(() => { const mean = r => { let s = 0; for (let x = 0; x < cols; x++) s += FOGB[r * cols + x]; return s / cols; }; return [mean(rows - 9), mean(rows - 4), mean(rows - 3), mean(rows - 1)]; }); // (above the nose, just over the panel, the panel)
    const out = {};
    for (const view of [true, false]) {
      await page.evaluate(view => {
        tod = 12; weather = 'fog'; fogAmt = 1; wTimer = 999; clearWanted(); third = view;
        if (mode !== 'air') enterAircraft(aircraft.find(c => c.type === 'jet'));
        const [x,y]=citySourcePoint(60,60);
        Object.assign(pilot, { ground: false, z: 15, v: 25, throttle: 0.8, x, y }); paused = false;
      }, view);
      await page.waitForTimeout(600);
      out[view ? 'behind' : 'cockpit'] = await rowFog();
    }
    for (const [view, [above, last, panel, bottom]] of Object.entries(out)) {
      assert.ok(above > 6, `${view}: the ground far below is lost in the fog (${above})`);
      assert.ok(last > 6, `${view}: and so is the row just over the instruments (${last})`);
      assert.deepEqual([panel, bottom], [0, 0], `${view}: the instruments are clear`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('steal a jet and get it up: the air force scrambles two fighters, the radio tells you, the instruments count them, and they draw', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepFlight === 'function' && Number.isFinite(eye));
    await page.evaluate(() => {
      tod = 13; weather = 'clear'; fogAmt = 0; wTimer = 999;
      const c = aircraft.find(c => c.type === 'jet'); enterAircraft(c);
      const [x,y]=citySourcePoint(120,60);
      Object.assign(c, { ground: false, z: 9, v: 7, throttle: 0.7, pitch: 0.02, x, y, yaw: 0 }); third = true; scramble = SCRAMBLE_T - 0.5; paused = false;
    });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => { let dash = ''; for (let k = (rows - 3) * cols; k < rows * cols; k++) dash += CH[k]; return { n: fighters.length, msg: msgText, dash }; });
    assert.equal(r.n, 2, 'two of them');
    assert.match(r.msg, /interceptors/);
    assert.match(r.dash, /FIGHTERS 2/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
