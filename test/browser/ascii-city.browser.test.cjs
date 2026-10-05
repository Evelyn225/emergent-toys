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
      sea: "leaveRoom(); mode = 'walk'; boardBoat(fleet.find(b => b.kind === 'sailboat')); sea.v = 0.5; third = true",
      helm: 'third = false; tod = 22',
      marina: "third = true; sea.v = 0; mode = 'walk'; sea = null; px = MARINA.x; py = MARINA.y0 + 1; a = Math.PI / 2; tod = 12",
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
    assert.deepStrictEqual(await page.evaluate(() => handDrawn && handDrawn.id), 'coffee', 'the cup is in your hand');
    assert.ok(await page.evaluate(() => { // and something hand-coloured really is on screen down there (any shade of skin)
      const skin = [9, 10, 11, 12, 13, 14].map(l => PALRGB[C(SKIN, l)]), d = g.getImageData(cv.width * 0.5, cv.height * 0.6, cv.width * 0.45, cv.height * 0.4).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (skin.some(([sr, sg, sb]) => Math.abs(d[i] - sr) < 6 && Math.abs(d[i + 1] - sg) < 6 && Math.abs(d[i + 2] - sb) < 6)) n++;
      return n; }) > 50, 'the hand drawn on the canvas');
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
  // at night, a machine by a closed shop's door still says it's there (on a phone the E button comes from that line)
  const night = await page.evaluate(() => {
    closeShop(); tod = 23;
    for (const m of machines) {
      const fx = -m.s * m.fs, fy = m.c * m.fs; devAt(m.x + fx * 0.15, m.y + fy * 0.15, Math.atan2(-fy, -fx)); render(); // (a frame, for what you're looking at)
      if (lockTarget()) return [promptText(), touchActions().some(b => b[1] === 'KeyE'), touchActions().some(b => b[1] === 'KeyL')];
    }
  });
  assert.match(night[0], /^E: \w+ machine {3}.+: closed {3}L: pick the lock$/);
  assert.deepStrictEqual(night.slice(1), [true, true]);
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

test('jailbreak: grab your things from the evidence locker on the way out and you leave with them', () => withPage(async page => {
  await page.evaluate(() => { money = 20; buy('coffee'); const c = footCops[0]; px = c.x + 0.1; py = c.y; mode = 'walk'; addWanted('hit', px, py, true); c.chase = true; });
  await page.waitForTimeout(400);
  await page.keyboard.press('Digit2');
  assert.deepStrictEqual(await page.evaluate(() => [room && room.kind, inv.length, seized.map(it => it.id)]), ['jail', 0, ['coffee']], 'taken off you and locked up');
  await page.keyboard.press('KeyE');
  // past the locker and out of the door (picking it up in the game itself: see the unit test)
  await page.evaluate(() => { game.g.hasItems = true; game.g.success = true; finishGame(); });
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'out');
  assert.deepStrictEqual(await page.evaluate(() => [inv.map(it => it.id), /your things/.test(msgText)]), [['coffee'], true]);
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
    assert.ok(await page.isVisible('#touch .sheet button:text-is("Sound on/off")'), 'the More sheet');
    assert.ok(!(await page.isVisible('#touch .sheet button:text-is("Weather")')), 'no Weather or Fast-forward: those are Q on the globe and the watch');
    const s0 = await page.evaluate(() => soundOn);
    await page.tap('#touch .sheet button:text-is("Sound on/off")');
    assert.notStrictEqual(await page.evaluate(() => soundOn), s0, 'the button works');
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

test('the subway: C sits you on a bench (not on top of anybody), and you get off the train on your feet', () => withPage(async page => {
  await page.evaluate(() => { enterRoom('train', { st: 0, opts: [1, 2, 3, 4, 5], dest: null, track: 0 }, [2, 2.5, 0.25]); });
  const r = await page.evaluate(() => {
    room.props = room.props.filter(o => o.art !== ART.sitter); // an empty car, then one rider on the bench by the door
    room.props.push(SP(3, 1.33, 0.55, 1.2, ART.sitter, () => 0, 0.3));
    px = 3.1; py = 2.2; const ok = sitDown();
    return [ok, !!body.seat, Math.abs(py - 1.3) < 0.01, Math.abs(px - 3) > 0.54, Math.abs(a - Math.PI / 2) < 0.01];
  });
  assert.deepStrictEqual(r, [true, true, true, true, true], 'next to the rider, facing across the car');
  await page.evaluate(() => { arriveAt(2); });
  assert.deepStrictEqual(await page.evaluate(() => [room.kind, body.seat]), ['station', null], 'off at the platform, standing');
}));

test('the yo-yo follows a circular mouse target with momentum and settles at the held target', () => withPage(async page => {
  const loops = await page.evaluate(async () => {
    inv.push({ id: 'yoyo', uses: 0 }); held = inv.length - 1; useHeld();
    yoyo.aimX = 0.6; yoyo.aimY = 0; // start on the circle, centered on the hand
    let n = 0, prev = yoyo.ang, t = 0;
    for (let f = 0; f < 360; f++) { // 6s of small circles, about one a second, fed in frame by frame
      const w = 2 * Math.PI * 1.2, R = 120;
      yoyoSwing(R * (Math.cos(w * (t + 1 / 60)) - Math.cos(w * t)), R * (Math.sin(w * (t + 1 / 60)) - Math.sin(w * t)));
      stepYoyo(1 / 60); t += 1 / 60;
      if (Math.abs(yoyo.ang - prev) > 3) n++; prev = yoyo.ang;
    }
    return n;
  });
  assert.ok(loops >= 2, `over the top ${loops} times`);
  const carried = await page.evaluate(() => {
    const before = yoyo.ang, speed = yoyo.angV;
    yoyo.aimX = Math.sin(before) * 0.8; yoyo.aimY = Math.cos(before) * 0.8;
    stepYoyo(1 / 60);
    return Math.abs(speed) > 0.1 && Math.abs(yoyo.ang - before) > 0.001;
  });
  assert.ok(carried, 'holding the target still retains the yo-yo momentum');
  const still = await page.evaluate(() => {
    yoyo.aimX = 0.3; yoyo.aimY = 0.7;
    for (let f = 0; f < 600; f++) stepYoyo(1 / 60);
    return [Math.abs(mod(yoyo.ang - Math.atan2(0.3, 0.7) + Math.PI, Math.PI * 2) - Math.PI), Math.abs(yoyo.len - Math.hypot(0.3, 0.7))];
  });
  assert.ok(still[0] < 0.01 && still[1] < 0.01, 'settles at the held mouse target');
}));

test('the board shows under you on a big desktop screen too; the wheels go quiet in the air', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE); await page.waitForTimeout(300);
    await page.evaluate(() => { mode = 'walk'; fx.skating = true; pitch = 0; });
    await page.waitForTimeout(200);
    const cells = await page.evaluate(() => { let n = 0; for (let i = 0; i < cols * rows; i++) if (boardZ[i] < 1e9) n++; return [cols * rows > 1 << 14, n]; });
    assert.ok(cells[0] && cells[1] > 50, `more cells than the old buffer held, and the board drawn in them (${cells})`);
    const rolling = await page.evaluate(() => { K.KeyW = 1; const ground = wheelsRolling(); body.vz = 3; body.z = 0.2; const air = wheelsRolling(); body.vz = body.z = 0; K.KeyW = 0; return [ground, air]; });
    assert.deepStrictEqual(rolling, [true, false]);
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); }
});

test('skateboard tricks by flick: each way picks its trick, and on a phone a swipe off the Ollie button pops it', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] }), page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE); await page.waitForTimeout(300);
    assert.deepStrictEqual(await page.evaluate(() => [[-60, 0], [60, 0], [0, 60], [-50, 50], [50, 50], [0, -60], [3, 2]].map(([x, y]) => trickName(flickTrick(x, y)))),
      ['kickflip', 'heelflip', 'pop shuvit', '360 flip', 'varial heelflip', 'ollie', 'ollie']);
    await page.evaluate(() => { mode = 'walk'; fx.skating = true; });
    await page.waitForTimeout(300); // the pad relabels
    const swipe = (dx, dy) => page.evaluate(([dx, dy]) => {
      const b = [...document.querySelectorAll('#touch .pad button')].find(x => x.textContent === 'Ollie'), r = b.getBoundingClientRect();
      const at = (x, y) => new Touch({ identifier: 7, target: b, clientX: x, clientY: y });
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      b.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [at(x0, y0)], touches: [at(x0, y0)], bubbles: true, cancelable: true }));
      const mid = body.vz; // nothing yet: it pops when you let go
      b.dispatchEvent(new TouchEvent('touchmove', { changedTouches: [at(x0 + dx, y0 + dy)], touches: [at(x0 + dx, y0 + dy)], bubbles: true, cancelable: true }));
      b.dispatchEvent(new TouchEvent('touchend', { changedTouches: [at(x0 + dx, y0 + dy)], touches: [], bubbles: true, cancelable: true }));
      return [mid, body.trick && body.trick.name];
    }, [dx, dy]);
    assert.deepStrictEqual(await swipe(70, 0), [0, 'heelflip']);
    await page.waitForTimeout(1000);
    assert.deepStrictEqual(await swipe(0, 0), [0, 'ollie'], 'a tap is an ollie');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); }
});

test('roofs: step across onto the roof next door, walk off the edge and land hard; a sprinting jump is only a jump', () => withPage(async page => {
  // a roof whose neighbour to the east is about level (but not the same); one whose east side drops to the street;
  // and one across a two-cell street from a roof 4-8m lower
  const spots = await page.evaluate(() => {
    let across = null, edge = null, leap = null;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = map[idx(x, y)], e = map[idx(x + 1, y)];
      if (!h || map[idx(x - 1, y)] !== h || map[idx(x, y - 1)] !== h || map[idx(x, y + 1)] !== h) continue;
      if (!across && e && e !== h && Math.abs(e - h) <= ROOF_STEP) across = [x, y, h, e];
      if (!edge && !e && h >= 1.4 && h <= 1.8 && ROAD[idx(x + 1, y)]) edge = [x, y, h];
      const far = map[idx(x + 3, y)];
      if (!leap && !e && !map[idx(x + 2, y)] && far && map[idx(x + 4, y)] === far && (h - far) * 10 >= 4 && (h - far) * 10 <= 8) leap = [x, y, h, far];
    }
    return { across, edge, leap };
  });
  assert.ok(spots.across && spots.edge && spots.leap, JSON.stringify(spots));
  const [x, y, h, e] = spots.across;
  await page.evaluate(([x, y, h]) => { mode = 'roof'; roofH = h; room = { kind: 'store', def: { ex: 2 } }; roofLot = roofCells(x, y); px = x + 0.3; py = y + 0.5; a = 0; pitch = 0; }, [x, y, h]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  assert.deepStrictEqual(await page.evaluate(() => [mode, roofH, onRoofLot()]), ['roof', e, false], 'over on the next roof, away from the stairs');
  // to the edge, facing the street, and keep walking: there's no wall, you go over
  const [ex, ey, eh] = spots.edge;
  await page.evaluate(([x, y, h]) => { mode = 'roof'; roofH = h; roofLot = roofCells(x, y); px = x + 0.6; py = y + 0.5; a = 0; refillNeeds(); }, [ex, ey, eh]);
  assert.match(await page.evaluate(() => promptText()), /edge: \d+m drop/);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'over the edge');
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => [body.z, needs.health]);
  assert.ok(r[0] === 0 && r[1] < 100 && r[1] > 0, `down, hurt but standing (${r})`);
  // a sprinting jump off the edge is an ordinary jump: no flying across the street, you come down in it
  const [lx, ly, lh] = spots.leap;
  await page.evaluate(([x, y, h]) => { mode = 'roof'; roofH = h; room = null; roofLot = roofCells(x, y); px = x + 0.85; py = y + 0.5; a = 0; refillNeeds(); }, [lx, ly, lh]);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.keyboard.press('Space');
  await page.waitForTimeout(250); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(2500);
  const fell = await page.evaluate(x => [mode, body.z, px - x < 2.5], lx);
  assert.deepStrictEqual(fell, ['walk', 0, true], 'down in the street, not across it');
  // no stairs on the roof next door: the fire escape takes you down to the sidewalk beside it
  await page.evaluate(([x, y, h, e]) => { mode = 'roof'; roofH = e; room = null; roofLot = roofCells(x, y); px = x + 1.5; py = y + 0.5; a = 0; refillNeeds(); body.z = body.vz = 0; }, spots.across);
  assert.match(await page.evaluate(() => promptText()), /E: fire escape down/);
  const up = await page.evaluate(() => [px, py]);
  await page.keyboard.press('KeyE');
  const down = await page.evaluate(([x, y]) => [mode, map[idx(Math.floor(px), Math.floor(py))], free(px, py), Math.hypot(rel(px - x), rel(py - y)) < 4], up);
  assert.deepStrictEqual(down, ['walk', 0, true, true], 'on the street beside the building, somewhere you can stand');
}));

test('bunny hopping: land and go straight back up and each hop is faster; stop and it is gone', () => withPage(async page => {
  const r = await page.evaluate(() => {
    refillNeeds();
    // frame by frame: forward (px moving) with Space held, strafing into a turn or not
    const go = (frames, { space = 1, strafe = 0 } = {}) => { K.KeyW = 1; K.Space = space; K.KeyD = strafe ? 1 : 0;
      for (let i = 0; i < frames; i++) { T += 1 / 60; if (strafe) a += 0.02; px += 0.01; if (space && !body.z) jump(); stepBody(1 / 60); }
      K.KeyW = K.Space = K.KeyD = 0; return body.hop; };
    body.hop = 1; body.z = body.vz = 0;
    const hopped = go(180), capped = go(1200);
    go(60, { space: 0 }); const after = [body.z, body.hop];
    body.hop = 1; const plain = go(180); body.z = body.vz = 0; body.hop = 1; const strafed = go(180, { strafe: 1 });
    return { hopped, capped, after, plain, strafed };
  });
  assert.ok(r.hopped > 1.1, `faster for every hop (${r.hopped})`);
  assert.strictEqual(r.capped, 1.9, 'up to a cap');
  assert.deepStrictEqual(r.after, [0, 1], 'on the ground a moment and it bleeds away');
  assert.ok(r.strafed > r.plain, `strafing into the turn builds it quicker (${r.plain} vs ${r.strafed})`);
}));

test('parked cars are solid on foot; you can still get in', () => withPage(async page => {
  const r = await page.evaluate(() => {
    let l = null; // a lane with room to walk up to it from the road side
    for (let i = 0; i < 400 && !l; i++) { const q = laneNear(8 + (i % 20) * 8 + 4.5, 8 + Math.floor(i / 20) * 8 + 4.5);
      if ([0, 0.3, -0.3].every(k => free(q.x + q.hy * k, q.y - q.hx * k)) && [0.3, -0.3].some(k => free(q.x + q.hy * 0.3 + q.hx * k, q.y - q.hx * 0.3 + q.hy * k))) l = q; }
    spawnOwnedCar('sedan' in CAR_MODELS ? 'sedan' : Object.keys(CAR_MODELS)[0], l.x, l.y, l.hx, l.hy, true);
    const c = cars.find(c => c.owned);
    const into = free(c.ex, c.ey), sd = [1, -1].find(k => free(c.ex + c.hy * 0.3 * k, c.ey - c.hx * 0.3 * k)), side = !!sd; // (the road side of it)
    px = c.ex + c.hy * 0.3 * sd; py = c.ey - c.hx * 0.3 * sd;
    for (let i = 0; i < 60; i++) move(-c.hy * 0.02 * sd, c.hx * 0.02 * sd); // walk straight at it
    const d = Math.hypot(rel(px - c.ex), rel(py - c.ey));
    interact();
    return [into, side, d > 0.1, mode];
  });
  assert.deepStrictEqual(r, [false, true, true, 'drive'], 'blocked by the car, beside it is fine, and E still gets you in');
}));

test('a fetch favour: buy what they asked for and handing it over takes it out of your bag', () => withPage(async page => {
  const r = await page.evaluate(() => {
    money = 100; inv.length = 0;
    const p = people.find(p => !p.hidden), v = vendors[0];
    task = { kind: 'fetch', who: p, type: v.type, want: VENDOR_STOCK[v.type.name][0], until: T + 240, ask: '' };
    const before = fetchHave();
    inv.push({ id: VENDOR_STOCK[v.type.name][0], uses: 1 }, { id: 'yoyo', uses: 0 }); held = 1;
    const has = fetchHave(), m0 = money;
    talkTo(p);
    return [before, has, task, inv.map(it => it.id), held, money > m0];
  });
  assert.deepStrictEqual(r, [false, true, null, ['yoyo'], 0, true], 'gone from your bag, still holding the yo-yo, and paid');
}));

test('a car comes with its keys: Q with them in hand brings it round to the kerb by you', () => withPage(async page => {
  const r = await page.evaluate(() => {
    money = 5000; inv.length = 0; held = -1;
    const [ok, line] = buy('car_sedan');
    const c = owned.cars[owned.cars.length - 1], k = inv.findIndex(it => it.id === 'key_car_sedan');
    // off a few blocks: somewhere on foot on a street
    let spot = null;
    for (let i = 0; i < 400 && !spot; i++) { const x = mod(c.x + 24 + (i % 20) * 8 + 0.15, N), y = mod(c.y + 24 + Math.floor(i / 20) * 8 + 4.5, N); if (free(x, y)) spot = [x, y]; }
    [px, py] = spot; held = k;
    const far = Math.hypot(rel(c.x - px), rel(c.y - py));
    useHeldItem();
    const near = Math.hypot(rel(c.x - px), rel(c.y - py));
    return { ok, keys: /keys/.test(line), k, far: far > 10, near: near < 2, parked: c.parked, line: msgText, sell: sellPrice(inv[k], 0.4) };
  });
  assert.deepStrictEqual(r, { ok: true, keys: true, k: 0, far: true, near: true, parked: true, line: r.line, sell: 0 }, JSON.stringify(r));
  assert.match(r.line, /rolls up at the kerb/);
  // indoors it can't hear you
  const inside = await page.evaluate(() => { enterRoom('cinema', { word: 'CINEMA', ret: [px, py, a] }, [7, 10.5, -Math.PI / 2]); useHeldItem(); return msgText; });
  assert.match(inside, /No signal in here/);
}));

test('the crowd at the pier fair wanders about, and you can talk to them', () => withPage(async page => {
  const r = await page.evaluate(() => {
    const f = fairFolk.find(f => !f.queue), x0 = f.x, y0 = f.y;
    px = FAIR.cx; py = FAIR.y0 + 0.5; // (on the pier, so they're stepped)
    f.wait = 0; for (let i = 0; i < 600; i++) stepFairFolk(1 / 30);
    const moved = Math.hypot(f.x - x0, f.y - y0) > 0.1, clear = fairFolk.every(q => q.queue || !fairBlocked(q.x, q.y, 0.05));
    // stand just in front of one, facing them
    mode = 'walk'; px = f.x - 0.3; py = f.y; a = 0; fx.stink = 0;
    const prompt = promptText(), who = nearPerson(); interact(); // (whoever's nearest in front: another of them may have wandered in)
    return { moved, clear, prompt, said: msgText, stopped: !!who && who.fair && who.talk > 0 };
  });
  assert.ok(r.moved && r.clear, `off for a wander, never through the stalls (${JSON.stringify(r)})`);
  assert.match(r.prompt, /E: talk/);
  assert.ok(r.said.startsWith('"') && r.stopped, `they answer and stop to chat (${r.said})`);
}));

test('run dry and you pass out: the hospital, a bill, and the nurse patches you up; dev tools fill you up', () => withPage(async page => {
  await page.evaluate(() => { money = 500; needs.food = 0; needs.drink = 0; needs.health = 0.05; });
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [mode, room && room.kind, money, needs.health]), ['room', 'hospital', 420, 100]);
  assert.match(await page.evaluate(() => msgText), /hospital bed.*Dehydration.*\$80/);
  await page.evaluate(() => { needs.health = 40; const [kx, ky] = room.def.keeper; px = kx; py = ky + 1.2; a = -Math.PI / 2; });
  assert.match(await page.evaluate(() => promptText()), /patched up/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [needs.health, money]), [100, 395]);
  await page.evaluate(() => { needs.food = 5; needs.drink = 5; });
  await page.keyboard.press('F2'); await page.click('#dev [data-tab="other"]');
  await page.evaluate(() => [...document.querySelectorAll('#dev [data-dev]')].find(b => b.textContent.startsWith('Fill food')).click());
  assert.deepStrictEqual(await page.evaluate(() => [needs.food, needs.drink, needs.health]), [100, 100, 100]);
}));

test('P to pee, any time: aimed where you look (your view stays put), falls under gravity, a yellow puddle that dries up; Esc still pauses', () => withPage(async page => {
  await page.evaluate(() => { needs.bladder = 2; people.forEach(m => m.hidden = true); });
  await page.keyboard.press('KeyP'); // nothing in you: a short one all the same
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, paused]), [true, false]);
  await page.waitForTimeout(2500);
  assert.strictEqual(await page.evaluate(() => !!pee), false, 'over quickly');
  await page.evaluate(() => { needs.bladder = 90; for (const q of puddles) q.life = 0; pitch = 0; });
  await page.keyboard.press('KeyP'); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => [!!pee, peeDrops.length > 5, puddles.length > 0, pitch, needs.bladder < 90]);
  assert.deepStrictEqual(r, [true, true, true, 0, true], 'peeing: drops in the air, a puddle, and the view left alone');
  // look down, then up: it goes further when you aim higher, and comes back down to the ground either way
  const reach = () => page.evaluate(() => Math.max(...peeDrops.filter(p => !p.splash).map(p => Math.hypot(rel(p.x - px), rel(p.y - py)))));
  await page.evaluate(() => { pitch = -0.4; }); await page.waitForTimeout(900);
  const low = await reach();
  await page.evaluate(() => { pitch = 0.4; for (const q of puddles) q.life = 0; stepPee(0); }); await page.waitForTimeout(1200);
  const high = await reach();
  assert.ok(high > low * 1.2, `further aimed up (${low.toFixed(3)} -> ${high.toFixed(3)})`);
  assert.deepStrictEqual(await page.evaluate(() => [puddles.length > 0, puddles.every(q => q.z === 0)]), [true, true], 'and it still lands');
  await page.keyboard.press('KeyP'); // cut it off
  await page.waitForTimeout(2000); // (what's still in the air comes down)
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, peeDrops.length]), [false, 0]);
  await page.evaluate(() => { for (const q of puddles) q.life = 0.01; stepPee(5); });
  assert.strictEqual(await page.evaluate(() => puddles.length), 0, 'dried up');
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.evaluate(() => paused), true);
}));

test('toilets: in a bar it goes in the bowl and you flush; on a diner floor you are thrown out; a cop who sees you in the street nicks you', () => withPage(async page => {
  await page.evaluate(() => { tod = 20; needs.bladder = 30; enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [1.6, 5.3, Math.PI / 2]); });
  await page.keyboard.press('KeyP');
  assert.deepStrictEqual(await page.evaluate(() => [!!(pee && pee.loo), msgText]), [true, 'You use the toilet.']);
  await page.waitForFunction(() => !pee, null, { timeout: 30000 }); // (game time: slower than the clock on a busy machine)
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, puddles.filter(q => q.at === placeKey()).length, msgText]), [false, 0, 'You flush. Very civilised.']);
  // walked in some way other than the front door (no greeting set): the barman still has a line, never "undefined"
  assert.ok(await page.evaluate(() => { px = 6; py = 2.4; a = -Math.PI / 2; return typeof room.line === 'string' && !promptText().includes('undefined'); }));
  // the bathroom's its own room, walls round it: miss the bowl in there and that's your business
  assert.deepStrictEqual(await page.evaluate(() => [ROOMW.cell(3, 5) > 0, ROOMW.cell(2, 4), inWc(1.6, 6.4), inWc(6, 3)]), [true, 0, true, false], 'a wall, a doorway, the toilet inside, the bar outside');
  await page.evaluate(() => { enterRoom('diner', { word: 'DINER', ret: [px, py, a] }, [2.5, 2.6, 0]); needs.bladder = 60; });
  await page.keyboard.press('KeyP');
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, !!(pee && pee.loo), msgText]), [true, false, 'Not quite the toilet, but close enough.']);
  await page.waitForFunction(() => !pee, null, { timeout: 30000 });
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind]), ['room', 'diner'], 'still in the diner');
  // the diner, out in the middle of the floor
  await page.evaluate(() => { enterRoom('diner', { word: 'DINER', ret: [px, py, a] }, [8.5, 5, Math.PI / 2]); needs.bladder = 50; });
  await page.keyboard.press('KeyP'); await page.waitForFunction(() => mode === 'walk', null, { timeout: 15000 }); // (game time: slower than the clock on a busy machine)
  assert.deepStrictEqual(await page.evaluate(() => [mode, !!pee]), ['walk', false]);
  assert.match(await page.evaluate(() => msgText), /thrown out/);
  // the street: nobody about, nothing happens; a cop right there, you're wanted
  await page.evaluate(() => { for (const c of cars) if (c.patrol) c.x = mod(px + 80, N); for (const c of footCops) c.x = mod(px + 80, N); people.forEach(m => m.hidden = true); needs.bladder = 50; });
  await page.keyboard.press('KeyP'); await page.waitForTimeout(1500);
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, wanted.stars]), [true, 0]);
  await page.keyboard.press('KeyP');
  await page.evaluate(() => { footCops[0].x = px + 0.3; footCops[0].y = py; footCops[0].chase = false; });
  await page.keyboard.press('KeyP'); await page.waitForFunction(() => wanted.stars > 0, null, { timeout: 15000 });
  assert.deepStrictEqual(await page.evaluate(() => [wanted.stars, wanted.crime]), [1, 'public urination']);
}));

test('a portapotty on a building site: E at its door, P in the bowl, E back out the door', () => withPage(async page => {
  await page.evaluate(() => { const o = potties[0]; px = o.x - o.hl - 0.06; py = o.y; a = 0; needs.bladder = 40; });
  await page.waitForTimeout(100);
  assert.deepStrictEqual(await page.evaluate(() => [blockKind(Math.floor(px / 8), Math.floor(py / 8)), promptText()]), ['construction', 'E: use the portapotty']);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, promptText()]), ['room', 'potty', 'P: use the toilet']);
  await page.keyboard.press('KeyP'); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => !!(pee && pee.loo)));
  await page.keyboard.press('KeyP');
  await page.evaluate(() => { py = 2.85; a = Math.PI / 2; });
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'walk');
}));

test('the pause menu on a narrow phone: scrolls down, never sideways', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
    await page.goto(PAGE); await page.waitForTimeout(300);
    await page.evaluate(() => togglePause()); await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const pn = document.querySelector('#pause .panel');
      return [pn.scrollWidth <= pn.clientWidth, pn.scrollHeight > pn.clientHeight, [...pn.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 0.5).length];
    });
    assert.deepStrictEqual(r, [true, true, 0]);
  } finally { await browser.close(); }
});

test('the Botanical Gardens at night: the dev jump lands you outside the locked gate and you can walk away; the gate still keeps you out', () => withPage(async page => {
  await page.evaluate(() => { tod = 23; devPlaces().find(([g, l]) => l === 'Botanical Gardens')[2](); });
  const at = await page.evaluate(() => [px, py]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW'); // toward the gate
  assert.deepStrictEqual(await page.evaluate(() => [inGardens(px, py), promptText()]), [false, 'The gates are locked. The Gardens open at 8.']);
  await page.evaluate(() => { a = -Math.PI / 2; }); // and back the way you came
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(([x, y]) => py < y - 0.1, at), 'walked away');
}));

test('the duck pond on the pier: $1 at the booth, hook a duck, its tickets count', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; money = 10; const b = BOOTHS.find(o => o.word === 'DUCK POND'); devAt(b.at[0], b.at[1], Math.PI); });
  assert.strictEqual(await page.evaluate(() => promptText()), 'E: play DUCK POND ($1.00 a go)');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), ['ducks', 9]);
  const want = await page.evaluate(() => { const g = game.g; for (let k = 0; k < 2000 && !g.under(); k++) g.step(1 / 60, {}); const w = g.under().worth; g.step(1 / 60, { actP: 1 }); return w; }); // (dipped the moment one's under it)
  await page.waitForFunction(() => game.g.score > 0, null, { timeout: 10000 });
  assert.strictEqual(await page.evaluate(() => game.g.score), want);
}));

test('balloon darts on the pier: $1 at the booth, a dart on a balloon pops it', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; money = 10; const b = BOOTHS.find(o => o.word === 'DARTS'); devAt(b.at[0], b.at[1], 0); });
  assert.strictEqual(await page.evaluate(() => promptText()), 'E: play BALLOON DARTS ($1.00 a go)');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), ['darts', 9]);
  await page.evaluate(() => { const g = game.g; for (let k = 0; k < 3000 && !g.hitAt(...g.aim().map(Math.round)); k++) g.step(1 / 60, {}); g.step(1 / 60, { actP: 1 }); }); // (thrown the moment it's on one: the reticle won't wait)
  await page.waitForFunction(() => game.g.score > 0 || game.g.balloons.some(b => b.popped), null, { timeout: 10000 });
  assert.ok(await page.evaluate(() => game.g.balloons.filter(b => b.popped).length === 1 && game.g.score >= 3));
}));

test('the night market: tarped by day, a stall to buy from at night; Q on the globe turns the sky, Q held on the watch hurries time', () => withPage(async page => {
  await page.evaluate(() => { tod = 13; money = 500; inv.length = 0; const s = STALLS[2]; devAt(s.at[0], s.at[1], Math.PI / 2); });
  assert.match(await page.evaluate(() => promptText()), /under a tarp/);
  const w = await page.evaluate(() => weather);
  await page.keyboard.down('KeyT'); await page.keyboard.press('KeyY');
  await page.waitForTimeout(500); await page.keyboard.up('KeyT');
  assert.ok(await page.evaluate(() => tod < 13.2) && await page.evaluate(() => weather) === w, 'T and Y do nothing now');
  await page.evaluate(() => { tod = 21; });
  assert.strictEqual(await page.evaluate(() => promptText()), 'E: CURIOS stall');
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Digit4'); // the snow globe
  assert.deepStrictEqual(await page.evaluate(() => [inv.some(it => it.id === 'cityglobe'), money]), [true, 150]);
  await page.keyboard.press('Escape');
  const w0 = await page.evaluate(() => { held = inv.findIndex(it => it.id === 'cityglobe'); return weather; });
  await page.keyboard.press('KeyQ');
  assert.notStrictEqual(await page.evaluate(() => weather), w0, 'the globe changes the sky');
  await page.evaluate(() => { inv.push({ id: 'pocketwatch', uses: 0 }); held = inv.length - 1; tod = 12; });
  await page.keyboard.down('KeyQ');
  await page.waitForFunction(() => tod > 12.5, null, { timeout: 15000 }); // (game time: without the watch this would take 10s of play)
  await page.keyboard.up('KeyQ');
  assert.ok(await page.evaluate(() => tod > 12.5), 'the watch hurries the hours');
}));

test('the museum by day: $10 in, plaques to read, the gift shop; by night a heist: a guard\'s torch catches you, or you crack a case and the silent alarm runs out', () => withPage(async page => {
  const day = await page.evaluate(() => {
    tod = 14; money = 100;
    const sh = MUSEUM.sh; lookHit = { d: 0.2, mx: MUSEUM.bx * 8 + 4, my: MUSEUM.by * 8 + 2 }; px = MUSEUM.bx * 8 + 4.5; py = MUSEUM.by * 8 + 1.7; a = Math.PI / 2;
    interact();
    const inside = [mode, room.kind, money];
    px = 12.5; py = 13.3; const dino = promptText();
    px = CASES[1].x; py = CASES[1].y + 1; const orrery = promptText(); interact(); const plaque = msgText;
    return [...inside, dino, orrery, plaque, stockFor('museum', 'MUSEUM')];
  });
  assert.deepStrictEqual(day.slice(0, 3), ['room', 'museum', 90]);
  assert.strictEqual(day[3], 'E: read the plaque'); assert.strictEqual(day[4], 'E: read the plaque');
  assert.match(day[5], /EQUINOX ORRERY/); assert.deepStrictEqual(day[6], ['postcard', 'dinotoy', 'replicastar']);
  // by night: in the gem room, stood in a guard's beam: spotted, alarm, three stars
  const caught = await page.evaluate(() => {
    leaveRoom(); clearWanted(); tod = 23;
    enterRoom('museum', { ...MUSEUM.sh, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [12.5, 10.5, -Math.PI / 2]);
    const g = room.props.find(q => q.guard && q.tick); g.tick(g); px = g.x + Math.cos(g.dir) * 1.5; py = g.y + Math.sin(g.dir) * 1.5;
    const lit = inBeam(g, px, py) > 0;
    for (const q of room.props) if (q.tick) q.tick = null; // (hold everyone still)
    for (let k = 0; k < 90; k++) stepMuseum(1 / 60);
    return [lit, room.alarm, wanted.stars];
  });
  assert.deepStrictEqual(caught, [true, true, 3]);
  // the beam lights the wall it reaches, not one too far off, and you cast a shadow on it standing in the way
  const walls = await page.evaluate(() => {
    leaveRoom(); clearWanted();
    enterRoom('museum', { ...MUSEUM.sh, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [12.5, 16, -Math.PI / 2]);
    const [g, g2] = room.props.filter(q => q.guard); g.tick = g2.tick = null; Object.assign(g, { x: 21.5, y: 12.5, dir: 0 }); Object.assign(g2, { x: 3.5, y: 2, dir: Math.PI });
    const near = torchAt(25, 12.5, 0.6), high = torchAt(25, 12.5, 3.5);
    g.x = 19.5; const far = torchAt(25, 12.5, 0.6); g.x = 21.5;
    px = 23; py = 12.5; const shaded = torchAt(25, 12.5, 0.6), beside = torchAt(25, 13.4, 0.6);
    return [near > 0.3, high, far, shaded, beside > 0];
  });
  assert.deepStrictEqual(walls, [true, 0, 0, 0, true]);
  // again, out of sight: crack the orrery's case, take it, the silent alarm counts down
  const heist = await page.evaluate(() => {
    leaveRoom(); clearWanted(); museumStolen = {}; inv.length = 0;
    enterRoom('museum', { ...MUSEUM.sh, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [12.5, 10.5, -Math.PI / 2]);
    for (const q of room.props) if (q.guard) { q.tick = null; q.x = 3.5; q.y = 15; q.dir = Math.PI; } // (both guards off in the far corner, facing away)
    px = CASES[1].x; py = CASES[1].y + 1;
    const prompt = promptText(); interact(); const g = game && game.g.id; game.onDone(true); game = null;
    const got = [inv.some(it => it.id === 'orrery'), museumStolen.orrery, !!room.alarm];
    T = room.silent + 1; stepMuseum(0.016);
    return [prompt, g, ...got, room.alarm, wanted.stars];
  });
  assert.deepStrictEqual(heist, ['E: crack the case (Equinox Orrery)', 'lockpick', true, true, false, true, 3]);
}));

test('the night market\'s fortune teller and goldfish tub: five stalls, a reading for $5, a net for $2', () => withPage(async page => {
  await page.evaluate(() => { tod = 22; money = 20; const s = STALLS[3]; devAt(s.at[0], s.at[1], Math.PI / 2); });
  assert.match(await page.evaluate(() => promptText()), /fortune told/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [money, /She turns/.test(msgText)]), [15, true]);
  await page.evaluate(() => { const s = STALLS[4]; devAt(s.at[0], s.at[1], Math.PI / 2); });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), ['goldfish', 13]);
}));

test('the Velvet Rope: cocktail tables and chairs, punters in them, and you can talk to one', () => withPage(async page => {
  await page.evaluate(() => { tod = 23; enterRoom('stripclub', { ...CLUB.sh, ret: [px, py, a], line: '' }, [9, 12.4, -Math.PI / 2]); });
  const r = await page.evaluate(() => {
    const seated = room.props.filter(s => s.art === ART.sitterBack), tables = room.props.filter(s => s.box && s.box.z0 > 0.6 && s.box.z1 < 0.8);
    const p = seated[0]; px = p.x; py = p.y + 0.9; a = -Math.PI / 2; // behind them, facing the stage
    return [seated.length, tables.length, promptText()];
  });
  assert.ok(r[0] >= 1 && r[1] === 5, `punters and tables (${r})`); // (how many come in is random)
  assert.strictEqual(r[2], 'E: talk');
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => ROOM_TALK.stripclub.some(l => msgText === `"${l}"`) || /^"/.test(msgText)), 'they say something');
}));

test('where you were is saved: you come back to the same spot on the street, and inside a shop to its door', () => withPage(async page => {
  const spot = await page.evaluate(() => { gotoShop('BAKERY'); saveGame(); return [px, py, a]; });
  await page.reload(); await page.waitForTimeout(300);
  const back = await page.evaluate(() => [px, py, a, mode]);
  assert.deepStrictEqual(back.map(v => typeof v === 'number' ? +v.toFixed(3) : v), [...spot.map(v => +v.toFixed(3)), 'walk']);
  await page.evaluate(() => { enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2]); saveGame(); });
  await page.reload(); await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [+px.toFixed(3), +py.toFixed(3), mode]), [+spot[0].toFixed(3), +spot[1].toFixed(3), 'walk']);
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

test('the Sunset Pier: once round the Ferris wheel and back to the platform, a horse on the carousel, a go at ring toss', () => withPage(async page => {
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
  await page.evaluate(() => { money = 5000; buy('home_studio'); carryItem({ id: 'book', uses: 0 }); carryItem({ id: 'umbrella', uses: 0 });
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
  assert.strictEqual(await page.evaluate(() => tickets), 5, '80 balls: 40 up on the tray, 5 tickets');
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

test('mahjong at the tea house: the buy-in goes in the pot, walking away loses it, a win pays the pot', () => withPage(async page => {
  await page.evaluate(() => enterRoom('tea', { word: 'MAHJONG', neon: RED, ret: [px, py, a], line: 'Hi' }, [3, 5.2, -Math.PI / 2]));
  assert.match(await page.evaluate(() => promptText()), /mahjong/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, game.kind, money, game.g.hands[0].length]), ['mahjong', 'table', 95, 14]);
  await page.keyboard.press('Space'); // throw a tile
  await page.waitForTimeout(150); // (the game takes the key on its next frame)
  assert.strictEqual(await page.evaluate(() => game.g.hands[0].length), 13);
  await page.keyboard.press('KeyE'); // get up mid-hand
  assert.deepStrictEqual(await page.evaluate(() => [game, money]), [null, 95], 'the stake stays in the pot');
  await page.keyboard.press('KeyE');
  await page.evaluate(() => { game.g.hands[0].splice(0, 14, 0, 0, 0, 1, 2, 3, 9, 10, 11, 20, 20, 20, 26, 26); });
  await page.keyboard.press('ArrowUp'); // MAHJONG!
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await page.evaluate(() => [game.g.result.winner, money]), [0, 110], 'won the pot: $20');
}));

test('the Botanical Gardens: gates locked at night, a swan boat on the lake, ducks to feed, the conservatory and the aviary, a gardener\'s shift, a seat on the grass', () => withPage(async page => {
  const at = (gx, gy, ang = 0) => page.evaluate(([x, y, an]) => { mode = 'walk'; px = GARDEN.x0 + x; py = GARDEN.y0 + y; a = an; pitch = 0; }, [gx, gy, ang]);
  const prompt = () => page.evaluate(() => promptText());
  await page.evaluate(() => { tod = 12; weather = 'clear'; money = 100; });
  await at(11, -0.5, Math.PI / 2); // outside the north gate
  assert.ok(await page.evaluate(() => free(GARDEN.x0 + 11, GARDEN.y0 + 0.2)), 'open by day');
  await page.evaluate(() => { tod = 22; });
  assert.ok(await page.evaluate(() => !free(GARDEN.x0 + 11, GARDEN.y0)), 'locked at night'); // (the gate itself)
  assert.match(await prompt(), /gates are locked/);
  await at(11, 1, -Math.PI / 2);
  assert.ok(await page.evaluate(() => free(GARDEN.x0 + 11, GARDEN.y0 - 0.3)), 'you can always let yourself out');
  await page.evaluate(() => { tod = 12; });
  // the boats
  await page.evaluate(() => { window.JF = [JETTY.gx0 + 0.25, JETTY.gy]; window.SHED = [GARDEN_SHED.gx, GARDEN_SHED.gy - 0.45]; });
  await at(...await page.evaluate(() => JF));
  assert.match(await prompt(), /rent a swan boat \(\$4\.00\)/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, money]), ['boat', 96]);
  const before = await page.evaluate(() => [px, py]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => [px, py, gardenLake(px, py)]);
  assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 0.05 && after[2], 'paddled out, still on the water');
  await page.evaluate(() => { boat.gx = LAKE.x + 1; boat.gy = LAKE.y; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'boat', 'only out at the jetty');
  await page.evaluate(() => { boat.gx = JETTY.gx1 + 0.3; boat.gy = JETTY.gy; });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, onJetty(...gardenLocal(px, py))]), ['walk', true]);
  // the ducks
  const shore = await page.evaluate(() => { for (let k = 0; k < 360; k++) { const th = k * Math.PI / 180, gx = LAKE.x + Math.cos(th) * (LAKE.rx + 0.45), gy = LAKE.y + Math.sin(th) * (LAKE.ry + 0.45);
    if (gardenLakeEdge(gx, gy) < -0.25 && gardenLakeEdge(gx, gy) > -0.4 && !onJetty(gx, gy) && Math.abs(gy - JETTY.gy) > 1) return [gx, gy, th + Math.PI]; } });
  await at(...shore);
  await page.evaluate(() => { inv.push({ id: 'bagel', uses: 3 }); held = inv.length - 1; });
  assert.match(await prompt(), /feed the ducks/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [!!duckFeed, heldItem().uses]), [true, 2]);
  // a seat on the grass
  const lawn = await page.evaluate(() => { for (let gy = 1; gy < GARDEN.h; gy += 0.5) for (let gx = 1; gx < GARDEN.w; gx += 0.5) if (gardenLawn(GARDEN.x0 + gx, GARDEN.y0 + gy) && !benchesB.flat().some(b => Math.hypot(b.x - GARDEN.x0 - gx, b.y - GARDEN.y0 - gy) < 0.3)) return [gx, gy]; });
  await at(...lawn);
  await page.keyboard.press('KeyC');
  assert.ok(await page.evaluate(() => body.seat && body.seat.grass), 'sat down on the grass');
  await page.keyboard.press('KeyC');
  // the conservatory: $5, in by the boardwalk, not stuck in a wall
  const cons = await page.evaluate(() => GLASSHOUSES[0].door);
  await at(cons[0], cons[1] + 0.2, -Math.PI / 2);
  await page.waitForTimeout(150);
  assert.match(await prompt(), /enter CONSERVATORY \(\$5\.00\)/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, money, free(px, py)]), ['room', 'conservatory', 91, true]);
  await page.evaluate(() => { px = 18; py = 9; a = 0; });
  await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => CH.join('')), /[|]{2}/, 'cacti in the desert house');
  await page.evaluate(() => leaveRoom());
  // the aviary: free; a cup of seed from the keeper
  const av = await page.evaluate(() => GLASSHOUSES[1].door);
  await at(av[0], av[1] - 0.2, Math.PI / 2);
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, money]), ['room', 'aviary', 91]);
  await page.evaluate(() => { px = 11.5; py = 8.4; });
  assert.match(await prompt(), /cup of seed/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [money, T - seedT < 1]), [90, true]);
  await page.evaluate(() => leaveRoom());
  // the gardeners' shed
  await at(...await page.evaluate(() => SHED));
  assert.match(await prompt(), /work a shift with the gardeners/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'garden');
}));

test('shut-down shops say so; each district paints its own walls', () => withPage(async page => {
  await page.evaluate(() => { tod = 13; weather = 'clear'; mode = 'walk'; for (const p of people) p.hidden = true; cars.length = 0; flocks.length = 0; }); // (nobody passing to talk to, no car to take: just the shop)
  const shut = await page.evaluate(() => { for (let k = 0; k < N * N; k++) { const sh = SHOP[k], x = k % N, y = k / N | 0; if (sh && sh.kind === SHOP_SHUT && !map[idx(x, y + 1)] && ROAD[idx(x, y + 1)]) return [x, y]; } });
  await page.evaluate(([x, y]) => { px = x + 0.5; py = y + 1.25; a = -Math.PI / 2; pitch = 0; }, shut);
  await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => promptText()), /closed down for good/);
  const themes = await page.evaluate(() => [MURAL_THEMES.chinatown.art.includes('dragon'), MURAL_THEMES.industrial.chance > MURAL_THEMES.downtown.chance * 4]);
  assert.deepStrictEqual(themes, [true, true]);
}));

test('every food and drink shows itself being used up (a level going down, steam going, or bites out of it), in both dropped and held art', () => withPage(async page => {
  const same = await page.evaluate(() => {
    const out = [];
    for (const id in ITEMS) {
      const I = ITEMS[id];
      if (!(I.kind === 'food' || I.kind === 'drink') || !(I.uses > 1)) continue;
      for (const [name, art] of [['dropped:', DROPPED_ART[id]], ['held:', DENSE[id]]]) {
        if (!art) continue;
        if (JSON.stringify(art({ id, uses: I.uses }, 1)[0]) === JSON.stringify(art({ id, uses: 1 }, 1 / I.uses)[0])) out.push(name + id);
      }
    }
    return out;
  });
  assert.deepStrictEqual(same, []);
}));

test('a shop you\'ve broken into: E means the till only at the counter, the way out only by the door', () => withPage(async page => {
  await page.evaluate(() => { enterRoom('store', { word: 'DELI', neon: RED, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]); });
  const at = (x, y) => page.evaluate(([x, y]) => { px = x; py = y; return [promptText(), eLabel(promptText())]; }, [x, y]);
  const keeper = await page.evaluate(() => room.def.keeper);
  assert.deepStrictEqual(await at(keeper[0], keeper[1] + 0.5), ['G: take something   E: the till', 'Till']);
  const door = await page.evaluate(() => [room.W / 2, room.H - 1.6]);
  assert.deepStrictEqual(await at(door[0], door[1]), ['G: take something   E: leave', 'Exit']);
  await page.evaluate(() => { px = 1.6; py = room.H / 2; });
  if (await page.evaluate(() => !nearKeeper() && !nearExit())) assert.strictEqual(await page.evaluate(() => promptText()), 'G: take something');
}));

test('smoke hangs in the air: a drag leaves puffs in front of you, gone in seconds outside and lingering indoors', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 15; mode = 'walk'; haze.length = 0;
    cigTip = 1; stepHaze(0.05); for (let k = 0; k < 20; k++) stepHaze(0.05); // breathe it out
    const out = haze.length, ahead = haze.every(p => Math.cos(a) * rel(p.x - px) + Math.sin(a) * rel(p.y - py) > 0);
    for (let k = 0; k < 200; k++) stepHaze(0.05); // ten seconds
    const outLater = haze.length;
    enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a], line: '' }, [6, 6, -Math.PI / 2]);
    cigTip = 0; stepHaze(0.05); cigTip = 1; for (let k = 0; k < 21; k++) stepHaze(0.05);
    const inside = haze.length; for (let k = 0; k < 200; k++) stepHaze(0.05);
    return [out > 0, ahead, outLater, inside > 0, haze.length === inside];
  });
  assert.deepStrictEqual(r, [true, true, 0, true, true]);
}));

test('street life: manholes in the road (some steaming), and pigeons that take off when you walk up to them', () => withPage(async page => {
  const r = await page.evaluate(() => {
    let holes = 0, steaming = 0;
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) { const m = manholeAt(x + 0.5, y + 0.5); if (m && Math.floor(m[0]) === x && Math.floor(m[1]) === y) { holes++; if (m[2]) steaming++; } }
    tod = 11; mode = 'walk'; haze.length = 0;
    const m = (() => { for (let y = 60; y < 200; y++) for (let x = 60; x < 200; x++) { const mm = manholeAt(x + 0.5, y + 0.5); if (mm && mm[2]) return mm; } })();
    px = m[0]; py = m[1] + 0.4; steamT = 0; stepSteam(0.05);
    const steam = haze.some(p => p.kind === 'steam');
    px = 12 * 8 + 0.15; py = 10 * 8 + 4; flocks.length = 0;
    flocks.push({ x: px, y: py + 0.6, birds: [0, 1, 2, 3].map(k => ({ dx: k * 0.02, dy: 0, ph: k, dir: 1, z: 0 })), scared: 0 });
    stepPigeons(0.05); const calm = !flocks[0].scared;
    py += 0.4; stepPigeons(0.05); for (let k = 0; k < 20; k++) stepPigeons(0.05);
    return [holes > 40, steaming > 10, steam, calm, !!flocks[0].scared, flocks[0].birds.every(b => b.z > 0)];
  });
  assert.deepStrictEqual(r, [true, true, true, true, true, true]);
}));

test('the casino: blackjack, roulette and slots take your stake and pay out; jade helps', () => withPage(async page => {
  await page.evaluate(() => { money = 500; enterRoom('casino', { word: 'CASINO', neon: YEL, ret: [px, py, a], line: '' }, [11, 14, -Math.PI / 2]); });
  for (const [id, x, y] of [['blackjack', 5, 7.4], ['roulette', 11, 10.4], ['slots', 2.2, 4.5]]) {
    await page.evaluate(([x, y]) => { px = x; py = y; }, [x, y]);
    assert.match(await page.evaluate(() => promptText()), new RegExp(`play ${id === 'slots' ? 'the slots' : id}`));
    await page.keyboard.press('KeyE');
    assert.deepStrictEqual(await page.evaluate(() => [game.kind, game.g.id]), ['casino', id]);
    const before = await page.evaluate(() => money);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(b => money !== b || game.g.state() !== 'bet', before), `${id}: the stake goes down`);
    await page.waitForTimeout(id === 'roulette' ? 4500 : 1500);
    if (id === 'blackjack' && await page.evaluate(() => game.g.state() === 'play')) { await page.keyboard.press('Space'); await page.waitForTimeout(3000); }
    assert.strictEqual(await page.evaluate(() => game.g.state()), 'done', `${id}: a round finishes`);
    await page.keyboard.press('KeyE');
  }
  // the house edge, and jade tipping it: the same slots, many pulls, with and without luck
  const rtp = await page.evaluate(() => {
    const run = lucky => { inv.length = 0; if (lucky) inv.push({ id: 'jadebangle', uses: 0 }, { id: 'jadedragon', uses: 0 }); let q = 99; const rnd = () => { q = q * 16807 % 2147483647; return q / 2147483647; };
      let back = 0; for (let k = 0; k < 20000; k++) { let r = slotPull(rnd); if (!slotPays(r) && rnd() < luck() * 1.5) r = slotPull(rnd); back += slotPays(r); } return back / 20000; };
    return [run(false), run(true)];
  });
  assert.ok(rtp[0] > 0.75 && rtp[0] < 0.97, `the slots keep a bit: ${rtp[0]}`);
  assert.ok(rtp[1] > rtp[0], `jade helps: ${rtp[1]} vs ${rtp[0]}`);
}));

test('breaking in at night: the till pays well but sets off the alarm, the police come at once; a bank\'s vault pays a fortune and brings everyone', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 23; money = 0;
    enterRoom('store', { word: 'DELI', neon: RED, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]);
    px = room.def.keeper[0]; py = room.def.keeper[1] + 0.5; interact();
    const shop = [money, wanted.stars, room.alarm, /ALARM/.test(promptText())];
    leaveRoom(); clearWanted(); money = 0;
    enterRoom('bank', { word: 'BANK', neon: BLUE, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]);
    px = room.W - 2; py = room.H / 2;
    const vaultPrompt = /crack the vault/.test(promptText());
    interact(); // the safecracking game comes up
    const g = game && game.g.id;
    game.onDone(true); game = null;
    return [shop, vaultPrompt, g, money >= 1000, wanted.stars];
  });
  assert.ok(r[0][0] >= 120 && r[0][1] >= 2 && r[0][2] && r[0][3], `the shop till: ${JSON.stringify(r[0])}`);
  assert.deepStrictEqual(r.slice(1), [true, 'lockpick', true, 3]);
}));

test('dog walkers: out with their dogs in the morning, at lunch and before dinner, never at night; you can pet the dog', () => withPage(async page => {
  const counts = await page.evaluate(() => {
    const dogsAt = t => people.filter(p => p.role === 'dogwalker' && activity(p, t) === 'wander' && t >= 7 && t < 20).length;
    return { walkers: people.filter(p => p.role === 'dogwalker').length, morning: dogsAt(8.3), lunch: dogsAt(13.3), evening: dogsAt(18.5), night: dogsAt(23), early: dogsAt(5) };
  });
  assert.ok(counts.walkers > 30, JSON.stringify(counts));
  assert.ok(counts.morning > 10 && counts.lunch > 10 && counts.evening > 10, JSON.stringify(counts));
  assert.strictEqual(counts.night + counts.early, 0);
  const pet = await page.evaluate(() => {
    tod = 8.3; mode = 'walk';
    const m = people.find(p => p.role === 'dogwalker'); m.hidden = false; m.act = 'wander';
    const d = dogOf(m); px = d.x; py = d.y + 0.05;
    const prompt = promptText(); interact();
    return [walkingDog(m), /pet the dog/.test(prompt) || /pick their pocket|talk/.test(prompt), msgText.length > 0];
  });
  assert.deepStrictEqual(pet, [true, true, true]);
}));

test('the stock exchange: trade with the broker while the market is open; your shares are still yours after a reload', () => withPage(async page => {
  await page.evaluate(() => { dayNum = 1; tod = 11; money = 500; enterRoom('exchange', { word: 'EXCHANGE', neon: GREEN, ret: [px, py, a], line: '' }, [10, 5.6, -Math.PI / 2]); });
  assert.match(await page.evaluate(() => promptText()), /trade \(market open\)/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'market');
  await page.keyboard.press('Space'); // lot of 10
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight'); // buy 10 DUMP
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => [shares.DUMP && shares.DUMP.n, money < 500]);
  assert.deepStrictEqual(after, [10, true]);
  await page.keyboard.press('KeyE');
  await page.evaluate(() => saveGame());
  await page.reload(); await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => shares.DUMP && shares.DUMP.n), 10, 'kept in the save');
  await page.evaluate(() => newGame && localStorage.removeItem('ascii-city-save'));
}));

test('the Velvet Rope: $20 at the door (not with the cops after you), tip the dancers, $40 for a private dance', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 22; money = 200; mode = 'walk';
    const sh = CLUB.sh, open = openAt(sh, 22) && !openAt(sh, 12);
    wanted.stars = 1; lookHit = { d: 0.2, mx: CLUB.bx * 8 + 5, my: CLUB.by * 8 + 2 }; interact();
    const refused = mode === 'walk' && /Not with the cops/.test(msgText);
    wanted.stars = 0; interact();
    const inside = [mode, room && room.kind, money];
    px = 9; py = 4.6; const stagePrompt = promptText(); interact();
    px = 13.4; py = 10.8; const vipPrompt = promptText(); interact();
    return { open, refused, inside, stagePrompt, money, vipPrompt, game: game && game.g.id };
  });
  assert.ok(r.open && r.refused, JSON.stringify(r));
  assert.deepStrictEqual(r.inside, ['room', 'stripclub', 180]);
  assert.match(r.stagePrompt, /tip the dancer/);
  assert.match(r.vipPrompt, /private dance/);
  assert.deepStrictEqual([r.money, r.game], [135, 'lapdance']);
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => money === 134 && game.g.tips === 1), 'a dollar tip');
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game), null);
}));

test('the Velvet Rope\'s private dancer is six characters in every frame (the joke has to be accurate); a cigarette machine by the bar', () => withPage(async page => {
  const r = await page.evaluate(() => {
    const counts = LAP_FRAMES.map(f => f.join('').replace(/ /g, '').length);
    enterRoom('stripclub', { word: 'VELVET', neon: MAG, ret: [px, py, a], line: '' }, [9, 11, -Math.PI / 2]);
    px = 1.6; py = 9.8; const prompt = promptText(); interact();
    return [counts, LAP_LINES.some(l => /six characters/.test(l)), prompt, panelOpen()];
  });
  assert.deepStrictEqual(r, [[6, 6, 6, 6, 6, 6, 6, 6], true, 'E: cigarette machine', true]);
}));

test('the marina: buy a boat, take her out (chase camera and at the helm), tie up somewhere else; she is still there after a reload', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 12; money = 9000; mode = 'walk';
    const b = fleet.find(o => o.deal === 'sale' && o.kind === 'cruiser'), s = SLOTS[b.slot], fy = MARINA.fingers[Math.floor(b.slot / 4)];
    px = s.x; py = fy; a = Math.atan2(s.y - fy, 0);
    const prompt = promptText(); interact(); const bought = [b.deal, money];
    interact(); return { prompt, bought, mode, name: b.name };
  });
  assert.match(r.prompt, /E: buy the cabin cruiser/);
  assert.deepStrictEqual([r.bought, r.mode], [['mine', 3000], 'sea']);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyV'); await page.waitForTimeout(300); // at the helm
  await page.keyboard.press('KeyV'); await page.waitForTimeout(200);
  const moved = await page.evaluate(() => { const at = [sea.x, sea.y]; sea.v = 0; sea.x = MARINA.x + 0.9; sea.y = MARINA.fingers[1] + 0.38; sea.hx = 1; sea.hy = 0; a = 0;
    const p = promptText(); interact(); return { at, p, mode, x: fleet.find(o => o.deal === 'mine').x }; });
  assert.match(moved.p, /E: tie up/);
  assert.strictEqual(moved.mode, 'walk');
  await page.evaluate(() => saveGame());
  await page.reload(); await page.waitForTimeout(400);
  const kept = await page.evaluate(() => fleet.filter(o => o.deal === 'mine').map(o => [o.kind, o.name, Math.round(o.x * 10) / 10]));
  assert.deepStrictEqual(kept, [['cruiser', r.name, Math.round(moved.x * 10) / 10]]);
  await page.evaluate(() => localStorage.removeItem('ascii-city-save'));
}));

test('talking to people indoors: walk up to someone in a cafe or a station and they chat (the counter still serves you)', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 14; mode = 'walk';
    enterRoom('cafe', { word: 'CAFE', neon: MAG, ret: [px, py, a], line: 'What can I get you?' }, [5, 6.3, -Math.PI / 2]);
    const arts = [ART.keeper, ART.sitter, ART.sitterBack], k = room.def.keeper;
    const s = room.props.find(o => arts.includes(o.art) && Math.hypot(o.x - k[0], o.y - k[1]) > 2);
    px = s.x; py = s.y + 0.9; a = -Math.PI / 2;
    const prompt = promptText(); interact();
    const cafeLine = msgText;
    px = k[0]; py = k[1] + 1; a = -Math.PI / 2; const counter = promptText();
    leaveRoom(); enterRoom('station', { st: 0, word: stations[0].name, t0: T - 12, ret: [px, py, a] }, [11, 4.8, 0]);
    let sprompt = ''; // (someone the train isn't standing beside: boarding it rightly comes first)
    for (const p2 of room.props.filter(o => arts.includes(o.art))) { px = p2.x + 0.8; py = p2.y; a = Math.PI; sprompt = promptText(); if (sprompt === 'E: talk') break; }
    interact();
    return { prompt, cafeLine, counter, sprompt, stationLine: msgText };
  });
  assert.strictEqual(r.prompt, 'E: talk');
  assert.ok(await page.evaluate(l => ROOM_TALK.cafe.some(x => l.includes(x)) || l.includes('coffee') || l.startsWith('"'), r.cafeLine), r.cafeLine);
  assert.match(r.counter, /E: shop/);
  assert.strictEqual(r.sprompt, 'E: talk');
  assert.match(r.stationLine, /^".+"$/);
}));

test('the capsule hotel: in through the door and up the aisle without the front desk in the way; the desk still books a pod', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 22; mode = 'walk';
    enterRoom('capsule', { word: 'CAPSULE', neon: CYAN, ret: [px, py, a], line: 'Welcome.' }, [3, 10.4, -Math.PI / 2]);
    const blocked = []; for (let y = 10.6; y > 2; y -= 0.2) for (const x of [2.6, 3, 3.4]) if (!free(x, y)) blocked.push([x, +y.toFixed(1)]);
    px = 5.2; py = 10.5; a = -Math.PI / 2;
    return { blocked, desk: promptText() };
  });
  assert.deepStrictEqual(r.blocked, []);
  assert.match(r.desk, /a pod for the night/);
}));

test('breaking into the casino: shut from 2am, so the lock can be picked before dawn; inside, the cashier\'s cage is the vault', () => withPage(async page => {
  const r = await page.evaluate(() => {
    const sh = CASINO.sh, shut3 = !openAt(sh, 3), open22 = openAt(sh, 22);
    tod = 3; mode = 'walk';
    enterRoom('casino', { ...sh, cell: [CASINO.bx * 8 + 4, CASINO.by * 8 + 5], ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]);
    px = 11; py = 3.4; a = -Math.PI / 2;
    return { shut3, open22, prompt: promptText(), noTables: casinoSpot() === null };
  });
  assert.deepStrictEqual([r.shut3, r.open22, r.noTables], [true, true, true]);
  assert.match(r.prompt, /crack the vault/);
}));

test('arrested along with your cab driver: a cell together, and he is not happy about it', () => withPage(async page => {
  const r = await page.evaluate(() => {
    me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; setDest(5); me.rush = true;
    addWanted('steal', px, py, false);
    jailWithCabbie();
    const cab = room.props.find(s => s.cabbie);
    px = cab.x; py = cab.y + 0.9; a = -Math.PI / 2;
    const prompt = promptText(); interact();
    return { kind: room.kind, me, cab: !!cab, prompt, said: msgText, stars: wanted.stars };
  });
  assert.deepStrictEqual([r.kind, r.me, r.cab, r.stars], ['jail', null, true, 0]);
  assert.match(r.prompt, /talk to your cab driver/);
  assert.match(r.said, /^Your cab driver: "/);
}));

test('the big map: opened from the pause menu, dragged and zoomed, Esc back to the pause menu', () => withPage(async page => {
  await page.evaluate(() => openPause());
  await page.click('[data-act="map"]');
  const start = await page.evaluate(() => [bigMapOpen(), BIGMAP.cx, BIGMAP.cy, BIGMAP.z, px, py]);
  assert.ok(start[0] && Math.abs(start[1] - start[4]) < 0.01 && Math.abs(start[2] - start[5]) < 0.01, 'opens on you');
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(440, 300, { steps: 4 }); await page.mouse.up();
  const moved = await page.evaluate(() => [rel(BIGMAP.cx - px) * BIGMAP.z, rel(BIGMAP.cy - py) * BIGMAP.z]);
  assert.ok(Math.abs(moved[0] - 200) < 2 && Math.abs(moved[1] - 100) < 2, 'the map follows the drag ' + moved);
  await page.mouse.wheel(0, -500); await page.waitForTimeout(100);
  assert.ok(await page.evaluate(z => BIGMAP.z > z, start[3]), 'the wheel zooms in');
  for (let k = 0; k < 20; k++) await page.mouse.wheel(0, 800);
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => Math.abs(BIGMAP.z * N - Math.max(innerWidth, innerHeight)) < 1), 'zoomed out, the whole city just fills the screen');
  await page.keyboard.press('Escape');
  assert.deepStrictEqual(await page.evaluate(() => [bigMapOpen(), paused, pauseEl.style.display]), [false, true, 'flex']);
}));

test('dev tools (F2): search and jump to a place, spawn an item, give money, set the day, time and weather', () => withPage(async page => {
  await page.keyboard.press('F2');
  assert.ok(await page.evaluate(() => devOpen() && paused));
  await page.keyboard.type('marina'); await page.keyboard.press('Enter'); // the first match
  assert.deepStrictEqual(await page.evaluate(() => [devOpen(), paused, inMarina(px, py)]), [false, false, true]);
  await page.keyboard.press('F2');
  await page.click('#dev [data-tab="items"]'); await page.keyboard.type('soccer'); await page.click('#dev [data-dev="0"]');
  await page.click('#dev [data-tab="money"]'); await page.click('#dev [data-dev="1"]'); // +$1,000
  await page.click('#dev [data-tab="time"]');
  for (const label of ['Noon', 'Sun', 'fog']) await page.evaluate(l => [...document.querySelectorAll('#dev [data-dev]')].find(x => x.textContent === l).click(), label); // (the menu redraws after each)
  await page.keyboard.press('Escape');
  const r = await page.evaluate(() => [inv.map(i => i.id), money, Math.floor(tod), weekday(), weather, devOpen()]); // (the clock's running again)
  assert.deepStrictEqual(r, [['ball'], 1100, 12, 'Sun', 'fog', false]);
}));
