'use strict';
// ASCII City in a real browser: the bundle loads, every mode renders without throwing, and the canvas isn't blank.
// The node suite (test/city-world.test.cjs) covers the simulation; this covers the DOM half the vm can't run.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium, devices } = require('playwright');

const PAGE = pathToFileURL(path.join(__dirname, '..', '..', 'ascii-city.html')).href;

test('every mode renders without errors', async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyX'); // starts the audio engine, so every scene below runs it too
    assert.ok(await page.evaluate(() => !!actx), 'audio started on a key press');
    const scenes = {
      street: "mode = 'walk'; px = 9 * 8 + 1; py = 10 * 8 + 4; tod = 21",
      fog: "weather = 'fog'; fogAmt = 1; tod = 12",
      rain: "weather = 'rain'; fogAmt = 0; rain = 1; wet = 1",
      shore: "weather = 'clear'; rain = 0; wet = 0; px = 8 * 8 + 1; py = SHORE_S * 8 + 2.4; a = Math.PI / 2",
      bridge: 'px = BRIDGE_X[0] * 8 + 1; py = SHORE_S * 8 + 20; a = Math.PI / 2',
      underEl: 'px = EL_STATIONS[0].x; py = EL_Y + 1.88; a = 0; pitch = 0.3',
      platform: 'elUp({ s: EL_STATIONS[0], tr: 1 })',
      riding: "const t = elTrains(T)[0]; ride = { tr: t.tr, k: t.k, off: 0 }; mode = 'el'",
      siren: "mode = 'walk'; plat = ride = null; px = 9 * 8 + 1; py = 10 * 8 + 4; spawnEmergency()",
      talk: "const p = people.find(p => !p.hidden); talkTo(p)",
      taxi: "me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; setDest(5)",
      room: "leaveCar(); enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2])",
      roof: "leaveRoom(); mode = 'roof'; roofH = 5; px = 2 * 8 + 3.5; py = 2 * 8 + 3.5",
      cafe: "mode = 'walk'; enterRoom('cafe', { word: 'CAFE', neon: MAG, ret: [px, py, a] }, [5, 6.3, -Math.PI / 2])",
      books: "enterRoom('books', { word: 'BOOKS', neon: GREEN, ret: [px, py, a] }, [4.5, 5, -Math.PI / 2])",
      noodle: "enterRoom('noodle', { word: 'RAMEN', neon: RED, ret: [px, py, a] }, [6, 5, -Math.PI / 2])",
      garage: "enterRoom('garage', { word: 'TIRES', neon: RED, ret: [px, py, a] }, [10.5, 8, -2.4])",
      tea: "enterRoom('tea', { word: 'MAHJONG', neon: RED, ret: [px, py, a] }, [6, 7.5, -Math.PI / 2])",
      station: "enterRoom('station', { st: 0, word: stations[0].name, t0: T - 12, ret: [px, py, a] }, [11, 4.8, 0])",
    };
    for (const [name, js] of Object.entries(scenes)) {
      await page.evaluate(js);
      await page.waitForTimeout(250);
      // some text actually reached the canvas
      const lit = await page.evaluate(() => {
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
        return n;
      });
      assert.ok(lit > 50, `${name}: canvas looks blank`);
      assert.deepStrictEqual(errors, [], `${name}: ${errors.join('; ')}`);
    }
  } finally {
    await browser.close();
  }
});

test('a night at the hotel: pay, sleep, wake at 7 in a room to a clear morning', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    const early = await page.evaluate(() => {
      enterRoom('hotel', { word: 'HOTEL', neon: MAG, ret: [px, py, a], line: 'Welcome!' }, [3.2, 3.2, -Math.PI / 2]);
      tod = 14; bookRoom(); return [money, msgText];
    });
    assert.deepStrictEqual(early, [100, '"Sorry, check-in begins at 6pm."']);
    await page.evaluate(() => { tod = 21; weather = 'rain'; rain = 1; bookRoom(); });
    await page.waitForTimeout(3600);
    const r = await page.evaluate(() => ({ money, kind: room.kind, hour: Math.floor(tod), weather, rain, sleeping: !!sleep }));
    assert.deepStrictEqual(r, { money: 60, kind: 'hotelroom', hour: 7, weather: 'clear', rain: 0, sleeping: true });
    await page.waitForTimeout(2000);
    assert.strictEqual(await page.evaluate(() => [!!sleep, fade].join()), 'false,0', 'awake, and the screen faded back in');
    assert.strictEqual(await page.evaluate(() => { leaveRoom(); return room.kind; }), 'hotel', 'the room door leads back to the lobby');
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('the pause menu stops the game and keeps its settings', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => paused), true);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('home')).display), 'block', 'the home button, only now');
    const t0 = await page.evaluate(() => T);
    await page.waitForTimeout(400);
    assert.strictEqual(await page.evaluate(() => T), t0, 'time stands still');
    await page.click('#pause [data-detail="low"]');
    assert.strictEqual(await page.evaluate(() => FS), 15);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => paused), false);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('home')).display), 'none', 'and gone again');
    await page.reload(); await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => [settings.detail, FS].join()), 'low,15', 'remembered after a reload');
  } finally {
    await browser.close();
  }
});

test('shops: E at the counter opens the menu, number keys buy; E only leaves at the door', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await page.evaluate(() => enterRoom('cafe', { word: 'CAFE', neon: MAG, ret: [px, py, a], line: 'Hi!' }, [5, 4.5, -Math.PI / 2]));
    await page.keyboard.press('KeyE'); // middle of the room: nothing to do, and no leaving
    assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind]), ['room', 'cafe']);
    await page.evaluate(() => { px = 4.6; py = 2.4; });
    await page.keyboard.press('KeyE');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('shop')).display), 'flex');
    await page.keyboard.press('Digit1'); // a coffee
    assert.deepStrictEqual(await page.evaluate(() => [money, inv.map(i => i.id)]), [97, ['coffee']]);
    await page.keyboard.press('KeyE');
    assert.strictEqual(await page.evaluate(() => paused), false, 'menu closed, game running');
    await page.evaluate(() => { px = 5; py = 6.2; }); // by the door
    await page.keyboard.press('KeyE');
    assert.strictEqual(await page.evaluate(() => mode), 'walk');
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => { // the hand is drawn on the canvas over the frame: count its skin-tone pixels
      const skin = [PALRGB[C(SKIN, 10)], PALRGB[C(SKIN, 13)]], d = g.getImageData(cv.width * 0.5, cv.height * 0.6, cv.width * 0.45, cv.height * 0.4).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (skin.some(([sr, sg, sb]) => Math.abs(d[i] - sr) < 6 && Math.abs(d[i + 1] - sg) < 6 && Math.abs(d[i + 2] - sb) < 6)) n++;
      return n; }) > 200, 'the cup is in your hand');
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
});

// open the page, run fn(page), fail on any page error
async function withPage(fn) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await fn(page);
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
}

test('the arcade: a credit plays a cabinet, the game takes the screen, tickets buy prizes at the counter', () => withPage(async page => {
  await page.evaluate(() => enterRoom('arcade', { word: 'ARCADE', neon: MAG, ret: [px, py, a], line: 'Hi' }, [6, 7.6, -Math.PI / 2]));
  const cab = await page.evaluate(() => { const c = room.props.find(s => s.game && !s.busy); px = c.cx; py = c.cy + 0.8; return c.game; });
  assert.ok(cab, 'a free cabinet');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), [cab, 99]);
  for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space'); await page.waitForTimeout(50); }
  await page.keyboard.press('KeyE'); // walk away from the cabinet
  assert.deepStrictEqual(await page.evaluate(() => [game, paused]), [null, false], 'back in the arcade, no pause menu');
  await page.evaluate(() => { tickets = 25; px = room.def.keeper[0]; py = room.def.keeper[1] + 1.4; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('prizes')).display), 'flex');
  await page.keyboard.press('Digit2'); // the rubber duck, 20 tickets
  assert.deepStrictEqual(await page.evaluate(() => [tickets, heldItem().id]), [5, 'duck']);
}));

test('a work shift from the counter pays for how you did', () => withPage(async page => {
  await page.evaluate(() => { enterRoom('diner', { word: 'DINER', neon: RED, ret: [px, py, a], line: 'Hi!' }, [6, 3, -Math.PI / 2]); px = 6; py = 2.4; });
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyJ');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'serve');
  await page.evaluate(() => { game.g.score = 10; });
  await page.keyboard.press('Escape'); // clock off early: still paid for those ten
  assert.ok(await page.evaluate(() => money) > 100);
  assert.deepStrictEqual(await page.evaluate(() => [game, room.worked, mode, paused]), [null, true, 'room', false]);
}));

test('the taxi job: J drives a taxi; a fare hails, gets in, and pays at their stop', () => withPage(async page => {
  await page.evaluate(() => { const c = cars.find(c => c.body === TAXI && !c.rider && !c.ev); c.v = 0; px = c.x + c.hy * 0.3; py = c.y - c.hx * 0.3; });
  await page.keyboard.press('KeyJ');
  assert.deepStrictEqual(await page.evaluate(() => [mode, !!job]), ['drive', true]);
  await page.evaluate(() => { const p = people.find(p => !p.hidden); p.x = me.x; p.y = me.y; job.hail = p; p.hailing = true; me.v = 0; });
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => job.ride && job.ride.p.hidden), 'picked up');
  await page.evaluate(() => { me.x = job.ride.dest[0]; me.y = job.ride.dest[1]; me.v = 0; job.ride.odo = 20; job.ride.took = 30; });
  await page.waitForTimeout(200);
  assert.deepStrictEqual(await page.evaluate(() => [job.trips, job.ride, money > 100]), [1, null, true]);
  await page.keyboard.press('KeyE'); // stopped: end the shift
  assert.deepStrictEqual(await page.evaluate(() => [mode, job]), ['walk', null]);
}));

test('vending machines sell from arm\'s reach, at an angle, even with a car at the kerb', () => withPage(async page => {
  await page.evaluate(() => { const m = machines[0], fx = -m.s * m.fs, fy = m.c * m.fs; px = m.x + fx * 0.25 + m.c * 0.08; py = m.y + fy * 0.25 + m.s * 0.08; a = Math.atan2(m.y - py, m.x - px) + 0.3; });
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Digit1');
  assert.strictEqual(await page.evaluate(() => inv.length), 1);
}));

test('busted: no fine money means a cell; a minute later the guard lets you out by the police station', () => withPage(async page => {
  await page.evaluate(() => { money = 20; buy('coffee'); const c = footCops[0]; px = c.x + 0.1; py = c.y; mode = 'walk'; addWanted('hit', px, py, true); c.chase = true; });
  await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('busted')).display), 'flex', 'busted');
  await page.keyboard.press('Digit1'); // can't afford the fine: nothing happens
  assert.strictEqual(await page.evaluate(() => mode), 'walk');
  await page.keyboard.press('Digit2');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, inv.length, money, wanted.stars]), ['room', 'jail', 0, 17, 0]);
  await page.keyboard.press('KeyE'); // the one try at breaking out: back off from it
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'jailbreak');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [room && room.kind, !!game]), ['jail', false], 'still locked in, no second try');
  await page.evaluate(() => { room.until = T; });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, Math.min(...SERVICES.filter(b => b.kind === 'police').map(b => Math.hypot(rel(b.x - px), rel(b.y - py)))) < 1.5]), ['walk', true], 'out, by the station');
}));

test('stealing a car drags the driver out onto the sidewalk; the car stays where you leave it', () => withPage(async page => {
  await page.evaluate(() => { const c = cars.find(c => c.body !== TAXI && !c.ev && !c.patrol && ROAD[idx(Math.floor(c.x), Math.floor(c.y))]); c.v = 0; px = c.x + c.hy * 0.3; py = c.y - c.hx * 0.3; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'drive');
  assert.ok(await page.evaluate(() => people.some(p => !p.hidden && p.talk > 0 && Math.hypot(rel(p.x - me.x), rel(p.y - me.y)) < 1.5)), 'the driver, out and shouting');
  const at = await page.evaluate(() => { const c = me; leaveCar(); window.parked = c; return [c.x, c.y]; });
  await page.waitForTimeout(1500);
  assert.deepStrictEqual(await page.evaluate(() => [parked.x, parked.y, parked.parked]), [...at, true], 'nobody drives it away');
}));

test('on a phone: the stick walks, a drag looks round, the buttons work the menus', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] }), page = await ctx.newPage();
    await page.goto(PAGE); await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display), 'block');
    const cdp = await ctx.newCDPSession(page), at = (x, y) => [{ x, y, id: 1 }];
    const p0 = await page.evaluate(() => [px, py]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(120, 300) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(120, 250) });
    await page.waitForTimeout(400);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(await page.evaluate(([x, y]) => Math.hypot(px - x, py - y), p0) > 0.1, 'walked');
    assert.strictEqual(await page.evaluate(() => K.KeyW), 0, 'and stopped on letting go');
    const a0 = await page.evaluate(() => a);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(600, 200) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(660, 200) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(await page.evaluate(() => a) > a0, 'looked right');
    await page.tap('#touch [data-key="KeyI"]');
    assert.strictEqual(await page.evaluate(() => panelOpen()), true, 'the bag');
    await page.tap('#touch [data-key="KeyE"]');
    assert.strictEqual(await page.evaluate(() => panelOpen()), false, 'E closes it');
    await page.tap('#touch [data-key="Escape"]');
    assert.strictEqual(await page.evaluate(() => paused), true);
    await page.tap('#pause [data-act="resume"]');
    assert.strictEqual(await page.evaluate(() => paused), false);
  } finally { await browser.close(); }
});

test('on your feet: Space jumps, a trick on the board lands with its name, C sits you on a cinema seat and walking gets you up', () => withPage(async page => {
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => body.z) > 0, 'up in the air');
  await page.waitForTimeout(800);
  assert.strictEqual(await page.evaluate(() => body.z), 0, 'and down again');
  await page.evaluate(() => { fx.skating = true; });
  await page.keyboard.down('KeyA'); await page.keyboard.press('Space'); await page.keyboard.up('KeyA');
  assert.strictEqual(await page.evaluate(() => body.trick && body.trick.name), 'kickflip');
  await page.waitForTimeout(900);
  assert.strictEqual(await page.evaluate(() => msgText), 'KICKFLIP!');
  await page.evaluate(() => { fx.skating = false; enterRoom('cinema', { word: 'CINEMA', ret: [px, py, a] }, [7, 10.5, -Math.PI / 2]); px = 4.2; py = 9.0; });
  await page.keyboard.press('KeyC');
  assert.ok(await page.evaluate(() => !!body.seat && Math.abs(py - 9.5) < 0.01), 'in the seat');
  await page.keyboard.down('KeyS'); await page.waitForTimeout(100); await page.keyboard.up('KeyS');
  assert.strictEqual(await page.evaluate(() => body.seat), null, 'up again');
}));

test('buy a car and a home: both are still yours after a reload, and the building door takes you home to your own bed', () => withPage(async page => {
  await page.evaluate(() => { money = 5000; buy('car_sedan'); buy('home_studio'); saveGame(); });
  await page.reload(); await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [owned.cars.length, owned.homes.length, money]), [1, 1, 1000]);
  // stand on the sidewalk in front of the building, facing it, and press E
  const ok = await page.evaluate(() => {
    const sh = SHOP[owned.homes[0].cell];
    for (let i = 0; i < N * N; i++) {
      if (SHOP[i] !== sh || !map[i]) continue;
      const x = i % N, y = Math.floor(i / N);
      for (const [ox, oy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!map[idx(x + ox, y + oy)]) {
        px = x + 0.5 + ox * 0.75; py = y + 0.5 + oy * 0.75; a = Math.atan2(-oy, -ox); mode = 'walk';
        for (const p of people) { p.x = mod(px + 60, N); p.path = []; } return true; // (nobody to talk to instead)
      }
    }
    return false;
  });
  assert.ok(ok, 'found the door');
  await page.waitForTimeout(100);
  const pr = await page.evaluate(() => promptText() + ' | ' + (lookHit && lookHit.d) + ' | ' + msgText);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => room && room.kind), 'home', pr);
  await page.evaluate(() => { [px, py] = room.def.spots.bed; py += 1; });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2000);
  assert.deepStrictEqual(await page.evaluate(() => [room.kind, Math.floor(tod)]), ['home', 7], 'woke at home at 7');
}));
