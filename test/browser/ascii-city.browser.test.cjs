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
    await page.tap('#touch button:text-is("Bag")');
    assert.strictEqual(await page.evaluate(() => panelOpen()), true, 'the bag');
    await page.tap('#touch .main:text-is("Close")');
    assert.strictEqual(await page.evaluate(() => panelOpen()), false, 'Close shuts it');
    await page.tap('#touch [data-more]');
    assert.ok(await page.isVisible('#touch .sheet button:text-is("Weather")'), 'the More sheet');
    const w0 = await page.evaluate(() => weather);
    await page.tap('#touch .sheet button:text-is("Weather")');
    assert.notStrictEqual(await page.evaluate(() => weather), w0, 'Weather changes it');
    assert.ok(!(await page.isVisible('#touch .sheet')), 'and the sheet goes away');
    await page.tap('#touch [data-key="Escape"]');
    assert.strictEqual(await page.evaluate(() => paused), true);
    await page.tap('#pause [data-act="resume"]');
    assert.strictEqual(await page.evaluate(() => paused), false);
  } finally { await browser.close(); }
});

test('on a phone the buttons say what they do and only show when they apply', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] }), page = await ctx.newPage();
    await page.goto(PAGE); await page.waitForTimeout(300);
    const pad = () => page.waitForTimeout(250).then(() => page.$$eval('#touch .pad button', bs => bs.map(b => b.textContent)));
    await page.evaluate(() => { me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; });
    assert.deepStrictEqual(await pad(), ['Park', 'Across town', 'Anywhere', 'Waterfront', 'Subway', 'Camera', 'Get out']);
    await page.tap('#touch .pad button:text-is("Subway")');
    assert.ok(await page.evaluate(() => /station$/.test(me.destName)), 'a stop button picks the stop');
    assert.ok((await pad()).includes('Tip $20.00'), 'then you can tip');
    await page.evaluate(() => { leaveCar(); enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2]); });
    const inBar = await pad();
    assert.ok(inBar.includes('Jump') && !inBar.includes('Camera'), inBar.join());
  } finally { await browser.close(); }
});

test('on a phone held upright: long HUD lines wrap, and a minigame shrinks to fit then puts the text size back', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] }), page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => wrapText('WASD move | mouse or arrows look | R/F up/down | shift run | space jump | C crouch / sit | E use / talk', cv.width - 24)
      .every(l => g.measureText(l).width <= cv.width - 24)), 'every line fits');
    const fs0 = await page.evaluate(() => FS);
    await page.evaluate(() => startGame('serve', 'shift', 'DINER'));
    await page.waitForTimeout(300);
    const fit = await page.evaluate(() => [cols >= 2 * game.g.W + 6, rows * FS <= innerHeight, FS]);
    assert.deepStrictEqual(fit.slice(0, 2), [true, true], `the cabinet fits across (text ${fit[2]}px)`);
    assert.ok(fit[2] < fs0, 'by making the text smaller');
    await page.evaluate(() => { game = null; });
    await page.waitForTimeout(200);
    assert.strictEqual(await page.evaluate(() => FS), fs0, 'and back afterwards');
    assert.deepStrictEqual(errors, []);
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
        for (const p of people) { p.x = mod(px + 60, N); p.path = []; } for (const c of cars) if (!c.owned) { c.x = mod(px + 60, N); c.ex = c.x; } return true; // (nobody to talk to, no car to take instead)
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

test('the pleasure pier: once round the Ferris wheel and back to the platform, a horse on the carousel, a go at ring toss', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; px = WHEEL_BOARD.x; py = WHEEL_BOARD.y; a = Math.PI / 2; });
  await page.waitForTimeout(100);
  assert.match(await page.evaluate(() => promptText()), /ride the Ferris wheel/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, money]), ['fair', 95]);
  await page.evaluate(() => { T = fairRide.end - WHEEL.rev / 2; });
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => fairEye > WHEEL.hub + WHEEL.R * 0.9), 'at the top');
  await page.evaluate(() => { T = fairRide.end - 0.05; });
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [mode, Math.hypot(px - WHEEL_BOARD.x, py - WHEEL_BOARD.y) < 0.3]), ['walk', true], 'off at the bottom');
  await page.evaluate(() => { px = CAROUSEL.x; py = CAROUSEL.y - CAROUSEL.r - 0.2; });
  await page.keyboard.press('KeyE');
  const p0 = await page.evaluate(() => [px, py]);
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(([x, y]) => mode === 'fair' && Math.hypot(px - x, py - y) > 0.05, p0), 'going round');
  await page.evaluate(() => { T = fairRide.end; });
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => mode === 'walk' && !fairBlocked(px, py)), 'off, beside it');
  await page.evaluate(() => { px = BOOTHS[0].at[0]; py = BOOTHS[0].at[1]; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'ringtoss');
  await page.evaluate(() => { tod = 4; game = null; px = WHEEL_BOARD.x; py = WHEEL_BOARD.y; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'the rides are shut at 4am');
}));

test('the laundromat: a load at the back wall, done in its time; clean clothes lose the police if they cannot see you', () => withPage(async page => {
  await page.evaluate(() => { tod = 3; enterRoom('laundry', { word: 'LAUNDRY', neon: CYAN, ret: [px, py, a], cell: [10, 10] }, [4, 1.6, -Math.PI / 2]); });
  assert.match(await page.evaluate(() => promptText()), /run a wash/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [!!wash, money]), [true, 97]);
  await page.keyboard.press('KeyE');
  assert.match(await page.evaluate(() => msgText), /Still spinning/);
  await page.evaluate(() => { T = wash.done + 0.1; wanted.stars = 2; wanted.seen = false; });
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [wash, wanted.stars, fx.fresh > 0]), [null, 0, true]);
}));

test('the aquarium: admission at the door, fish in every kind of tank, a touch pool, a gift shop; fish in the windows outside', () => withPage(async page => {
  const glyphs = () => page.evaluate(() => CH.join(''));
  await page.evaluate(() => { tod = 12; weather = 'clear'; px = AQUARIUM.doorU + 0.3; py = AQUARIUM.by * 8 + 9.2; a = -Math.PI / 2; pitch = 0; });
  await page.waitForTimeout(300);
  assert.match(await glyphs(), /><|<>|=o>|<o=/, 'fish in the windows');
  await page.evaluate(() => { px = AQUARIUM.doorU; py = AQUARIUM.by * 8 + 8.25; });
  await page.waitForTimeout(100);
  assert.match(await page.evaluate(() => promptText()), /enter AQUARIUM \(\$8\.00\)/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, money]), ['room', 'aquarium', 92]);
  for (const [name, at] of [['ocean', [12, 3.6, -Math.PI / 2]], ['reef', [20.4, 7.5, 0]], ['jelly', [3.4, 7.5, Math.PI]], ['kelp', [18.5, 5.5, -Math.PI / 2]], ['seahorses', [2.6, 12.5, Math.PI]]]) {
    await page.evaluate(([x, y, ang]) => { px = x; py = y; a = ang; pitch = 0; }, at);
    await page.waitForTimeout(250);
    const s = await glyphs();
    assert.ok(/[<>"]/.test(s) || /[()|]{3}/.test(s), `${name}: something swimming`);
  }
  assert.ok(await page.evaluate(() => { px = 12; py = 9; a = -Math.PI / 2; pitch = 0.5; return !ROOMW.cell(12, 9); }), 'the tunnel floor is walkable');
  await page.evaluate(() => { px = 5.5; py = 14.2; });
  assert.match(await page.evaluate(() => promptText()), /touch pool/);
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => TOUCH_LINES.includes(msgText)));
  await page.evaluate(() => { px = 20.5; py = 14.6; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => panelOpen()), true, 'the gift shop');
  assert.ok(await page.evaluate(() => shopCtx.stock.includes('sharkplush')));
}));

test('the cathedral: in through the great doors, a seat in a pew, a candle lit, up the bell tower and back down, out again', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; for (const [k, v] of landmarkOf) if (v === 'cathedral') { px = (k % NB) * 8 + 5; py = Math.floor(k / NB) * 8 + 3.7; a = Math.PI / 2; break; } });
  await page.waitForTimeout(100);
  assert.match(await page.evaluate(() => promptText()), /go into the cathedral/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, room.def.height]), ['room', 'cathedral', 16]);
  await page.evaluate(() => { px = 9; py = 15.6; });
  await page.keyboard.press('KeyC');
  assert.ok(await page.evaluate(() => !!body.seat), 'sitting in a pew');
  await page.evaluate(() => { body.seat = null; px = 19; py = 35.3; });
  const lit = await page.evaluate(() => room.candles);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [room.candles, money]), [lit + 1, 99]);
  await page.evaluate(() => { px = CATH_TOWER[0]; py = CATH_TOWER[1] - 0.2; });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, roofH]), ['roof', 8], 'up the tower, 80m');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind]), ['room', 'cathedral'], 'back down');
  await page.evaluate(() => { px = 11; py = 38.3; a = Math.PI / 2; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'out the doors');
  await page.evaluate(() => { tod = 23; for (const [k, v] of landmarkOf) if (v === 'cathedral') { px = (k % NB) * 8 + 5; py = Math.floor(k / NB) * 8 + 3.7; break; } });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'locked at night');
}));

test('the cell block: you stay in your cell, the bars are see-through and there is a whole block beyond them', () => withPage(async page => {
  await page.evaluate(() => enterRoom('jail', { word: 'JAIL', ret: [px, py, a], until: T + 60 }, [11, 3.2, Math.PI / 2]));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(() => py < JAIL_BARS_NEAR - 0.2), 'stopped at the bars');
  // looking through them: something is drawn far past the bars (the cells across the corridor)
  const far = await page.evaluate(() => { let n = 0; for (let i = 0; i < ZB.length; i++) if (ZB[i] > JAIL_BARS_FAR - py && ZB[i] < 50) n++; return n; });
  assert.ok(far > 200, `the far side of the corridor is in view (${far} cells)`);
  const g0 = await page.evaluate(() => room.props.find(s => s.tick && s.y === 7.5).x);
  await page.waitForTimeout(500);
  assert.notStrictEqual(await page.evaluate(() => room.props.find(s => s.tick && s.y === 7.5).x), g0, 'the guard is walking');
}));

test('your home: things put in the closet are still there after a reload; a taxi takes you to your nearest home', () => withPage(async page => {
  await page.evaluate(() => { money = 5000; buy('home_studio'); inv.push({ id: 'book', uses: 0 }, { id: 'umbrella', uses: 0 });
    enterRoom('home', { word: 'HOME', ret: [px, py, a], cell: [0, 0] }, [ROOM_DEFS.home.grid[0].length / 2, 3, -Math.PI / 2]); [px, py] = room.def.spots.closet; py += 0.6; });
  assert.match(await page.evaluate(() => promptText()), /your closet/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => panelOpen()), true, 'the closet opens');
  await page.keyboard.press('Digit1');
  assert.deepStrictEqual(await page.evaluate(() => [closet.map(it => it.id), inv.map(it => it.id)]), [['book'], ['umbrella']]);
  await page.keyboard.press('KeyE');
  await page.evaluate(() => saveGame());
  await page.reload(); await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => closet.map(it => it.id)), ['book'], 'kept');
  const d = await page.evaluate(() => {
    leaveRoom && room && leaveRoom(); mode = 'walk';
    me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; return 0; });
  await page.keyboard.press('Digit6');
  const r = await page.evaluate(() => { const h = owned.homes[0], x = h.cell % N, y = Math.floor(h.cell / N);
    return [me.destName.startsWith('home'), ROAD[idx(Math.floor(me.dest[0]), Math.floor(me.dest[1]))] > 0, Math.hypot(rel(me.dest[0] - x), rel(me.dest[1] - y)) < 7]; });
  assert.deepStrictEqual(r, [true, true, true], 'to the street outside home');
}));

test('the calendar: midnight turns the day over; Saturday night there are fireworks over the bay, and not on a Tuesday', () => withPage(async page => {
  await page.evaluate(() => { dayNum = 4; tod = 23.99; });
  await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => weekday()), 'Sat', 'Friday became Saturday at midnight');
  await page.evaluate(() => { tod = 21.2; weather = 'clear'; px = FAIR.cx; py = SHORE_S * 8 + 2.4; a = Math.PI / 2; pitch = 0.45; });
  await page.waitForTimeout(4000);
  assert.ok(await page.evaluate(() => shells.length) > 0, 'shells in the air');
  assert.match(await page.evaluate(() => CH.join('')), /[*@+]/, 'and on screen');
  await page.evaluate(() => { dayNum = 1; shells.length = 0; });
  await page.waitForTimeout(2000);
  assert.strictEqual(await page.evaluate(() => shells.length), 0, 'nothing on a Tuesday');
}));

test('graffiti: murals on some walls; spray paint from the hardware store tags a wall, the tag is kept, and a cop seeing it means trouble', () => withPage(async page => {
  assert.ok(await page.evaluate(() => { let n = 0; for (let y = 8; y < 190; y++) for (let x = 0; x < N; x++) if (map[idx(x, y)] && muralSeed(idx(x, y), x, y, 'S') >= 0) n++; return n; }) > 30, 'murals round town');
  assert.ok(await page.evaluate(() => stockFor('', 'HARDWARE').includes('spraypaint')));
  const spot = await page.evaluate(() => { for (let y = 8; y < 190; y++) for (let x = 0; x < N; x++) if (map[idx(x, y)] > 0.5 && STY[idx(x, y)] < 3 && !map[idx(x, y + 1)] && ROAD[idx(x, y + 1)] === 2) return [x, y]; });
  await page.evaluate(([x, y]) => { px = x + 0.5; py = y + 1.12; a = -Math.PI / 2; pitch = 0; inv.push({ id: 'spraypaint', uses: 6 }); held = inv.length - 1;
    for (const c of cars) if (c.patrol) { c.x = mod(px + 80, N); c.ex = c.x; } for (const c of footCops) c.x = mod(px + 80, N); }, spot);
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyQ');
  assert.deepStrictEqual(await page.evaluate(() => [tags.length, inv[held].uses, wanted.stars]), [1, 5, 0], 'tagged, nobody official watching');
  await page.evaluate(() => { saveGame(); });
  await page.reload(); await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => tags.length), 1, 'still there after a reload');
  await page.evaluate(([x, y]) => { px = x + 1.5; py = y + 1.12; a = -Math.PI / 2; inv.push({ id: 'spraypaint', uses: 6 }); held = inv.length - 1;
    footCops[0].x = px + 0.5; footCops[0].y = py + 0.3; }, spot);
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyQ');
  assert.ok(await page.evaluate(() => wanted.stars >= 1 && wanted.crime === 'vandalism'), 'wanted for vandalism');
}));

test('the Shotengai: a roof over its streets, dry in the rain; pachinko pays tickets, the crane can win you a plush, a capsule for the night', () => withPage(async page => {
  const st = await page.evaluate(() => { for (let by = 17; by <= 20; by++) for (let bx = 11; bx <= 15; bx++) if (vseg(bx, by) && vseg(bx, by + 1) && blockKind(bx, by) === '' && blockKind(bx - 1, by) === '') return [bx * 8 + 1.35, by * 8 + 7.5]; });
  assert.ok(st, 'a covered street');
  await page.evaluate(([x, y]) => { tod = 13; weather = 'rain'; rain = 1; px = x; py = y; a = -Math.PI / 2; pitch = 0.9; }, st);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => districtAt(px, py)), 'shotengai');
  assert.ok(await page.evaluate(() => { let roof = 0; for (let i = 0; i < cols * 6; i++) if (ZB[i] > 0 && ZB[i] < 40) roof++; return roof > cols * 3; }), 'the roof overhead, not sky');
  assert.ok(!(await page.evaluate(() => CH.join(''))).includes('!'), 'no rain falling under it');
  await page.evaluate(() => enterRoom('pachinko', { word: 'PACHINKO', neon: MAG, ret: [px, py, a] }, [7, 9.4, -Math.PI / 2]));
  await page.evaluate(() => { const m = room.props.find(s => s.pachi && !s.busy); px = m.cx; py = m.cy + m.fy * 0.75; });
  assert.match(await page.evaluate(() => promptText()), /pachinko/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'pachinko');
  await page.evaluate(() => { game.g.score = 80; });
  await page.keyboard.press('KeyE'); // cash out
  assert.strictEqual(await page.evaluate(() => tickets), 10, '80 balls, 10 tickets');
  await page.evaluate(() => { game = null; enterRoom('cranes', { word: 'CRANE GAME', neon: MAG, ret: [px, py, a] }, [5.5, 6.4, -Math.PI / 2]); px = 4.8; py = 2.4; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'crane');
  await page.evaluate(() => { game.g.prize = 'plushcat'; game.g.over = true; });
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => inv.some(it => it.id === 'plushcat')), 'won a lucky cat');
  await page.evaluate(() => { game = null; enterRoom('capsule', { word: 'CAPSULE', neon: CYAN, ret: [px, py, a] }, [3.5, 10.4, -Math.PI / 2]); py = 9.9; tod = 15; });
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => !!sleep), 'asleep in a pod');
}));
