'use strict';
// Multiplayer (city/net.js) in the real page: two tabs join the same room over the local (BroadcastChannel) transport,
// so nothing goes over the network. Each sees the other on the street, drawn with a name over their head; T opens the
// chat box (the keys stay out of the game), Enter sends, and it arrives in the other's log and over their head; the
// clock and weather come from whoever keeps the clock; inside, only someone who came in by the same door is there; at
// the wheel they're a car; and leaving takes them out of the other's world.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const BASE = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href + '?net=local';
const URL_ = BASE;
// several players are several tabs in one browser: none of them may be throttled for being in the background, or a busy
// machine starves their timers and a player looks to have left
const NET_ARGS = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']; // (chat and the shared clock: on as released)

test('two players: seen in the street, chat in a bubble, one clock, the same room, a car, and leaving', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async (url = URL_) => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open();
    await A.evaluate(() => localStorage.clear());
    const room = 'test-' + Date.now().toString(36);
    await A.evaluate(r => netJoin(r, 'Ann'), room);
    await B.evaluate(r => netJoin(r, 'Bob'), room);
    const met = () => [...net.peers.values()].some(p => p.hello);
    await A.waitForFunction(met, null, { timeout: 8000, polling: 100 });
    await B.waitForFunction(met, null, { timeout: 8000, polling: 100 });
    assert.deepEqual(await A.evaluate(() => [...net.peers.values()].map(p => p.name)), ['Bob']);
    assert.deepEqual(await B.evaluate(() => [...net.peers.values()].map(p => p.name)), ['Ann']);
    assert.notEqual(await A.evaluate(() => net.clockOwner), await B.evaluate(() => net.clockOwner), 'exactly one keeps the clock');

    // on the same street, Bob half a cell in front of Ann and facing her: drawn, where he is, walking
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; pitch = 0; }, spot);
    await B.evaluate(s => { mode = 'walk'; room = null; px = mod(s.x + Math.cos(s.a) * 0.5, N); py = mod(s.y + Math.sin(s.a) * 0.5, N); a = s.a + Math.PI; }, spot);
    // (a tab in the background gets no animation frames: each check draws a frame itself)
    const look = P => P.evaluate(() => { render(0); const p = [...net.peers.values()][0]; return { drawn: p.drawn, d: p.view && Math.hypot(rel(p.view.x - px), rel(p.view.y - py)), rk: p.view && p.view.rk, veh: p.view && p.view.veh && p.view.veh.kind }; });
    const until = async (P, ok, what) => { for (let k = 0; k < 60; k++) { const v = await look(P); if (ok(v)) return v; await P.waitForTimeout(100); } assert.fail(what + ': ' + JSON.stringify(await look(P))); };
    const seen = await until(A, v => v.drawn && Math.abs(v.d - 0.5) < 0.02, 'drawn where he is');
    assert.equal(seen.rk, 'out');

    // T on Bob's tab: the chat box, the typing stays out of the game, Enter sends
    await B.bringToFront();
    await B.keyboard.press('KeyT');
    assert.equal(await B.evaluate(() => netTyping()), true, 'T opens the chat box');
    await B.keyboard.type('wave at me');
    assert.deepEqual(await B.evaluate(() => ({ w: K.KeyW || 0, a: K.KeyA || 0 })), { w: 0, a: 0 }, 'typing W or A doesn\'t walk');
    await B.keyboard.press('Enter');
    assert.equal(await B.evaluate(() => netTyping()), false, 'Enter sends and closes it');
    await A.waitForFunction(() => net.chat.some(m => m.who === 'Bob' && m.text === 'wave at me'), null, { timeout: 3000, polling: 100 });
    assert.deepEqual(await A.evaluate(() => [...net.peers.values()][0].bubble.lines), ['wave at me'], 'over his head as well');
    // drawn this frame: the name and the bubble over him, and the log
    await A.evaluate(() => { paused = true; render(0); paused = false; });

    // the clock: whoever keeps it sets the time and the sky; the other follows within a couple of seconds
    const [keeper, follower] = await A.evaluate(() => net.clockOwner) ? [A, B] : [B, A];
    await keeper.evaluate(() => { tod = 20.5; weather = 'rain'; wTimer = 1e9; }); // (and the keeper's own sky holds still for the test)
    const inStep = async () => { // the follower's time and sky match the keeper's (whose clock is still running)
      for (let k = 0; k < 60; k++) {
        const [kt, kw] = await keeper.evaluate(() => [tod, weather]), [ft, fw] = await follower.evaluate(() => [tod, weather]);
        if (Math.abs(kt - ft) < 0.15 && kw === fw && fw === 'rain') return;
        await follower.waitForTimeout(100);
      }
      assert.fail('the clocks never agreed');
    };
    await inStep();
    await follower.evaluate(() => { tod = 3; weather = 'snow'; }); // (anything they do themselves is put back)
    await inStep();

    // inside: Ann in the lighthouse, Bob outside isn't there; Bob in by the same door is
    const enter = (P, spawn) => P.evaluate(s => { mode = 'walk'; room = null; px = LIGHTHOUSE.x; py = LIGHTHOUSE.y; enterRoom('lighthouse', { word: 'LIGHTHOUSE', ret: [LIGHTHOUSE.x, LIGHTHOUSE.y, 0], line: 'hi' }, s); return netRoomKey(); }, spawn);
    const key = await enter(A, [4, 6.2, -Math.PI / 2]);
    await A.waitForTimeout(400);
    assert.equal((await look(A)).drawn, false, 'someone outside isn\'t in here');
    assert.equal(await enter(B, [4, 4.6, Math.PI / 2]), key);
    await until(A, v => v.drawn && v.rk === key, 'in by the same door: there');

    // at the wheel: a car
    await A.evaluate(() => leaveRoom()); await B.evaluate(() => leaveRoom());
    const car = await B.evaluate(() => { const c = cars.find(c => c.kind === 'car' && !c.patrol && !c.ev); px = c.x; py = c.y; mode = 'drive'; me = c; c.player = true; c.parked = false; a = Math.atan2(c.hy, c.hx); return { x: c.x, y: c.y, hx: c.hx, hy: c.hy }; });
    await A.evaluate(c => { mode = 'walk'; room = null; px = mod(c.x - c.hy * 0.6, N); py = mod(c.y + c.hx * 0.6, N); a = Math.atan2(c.y - py, c.x - px); pitch = 0; }, car);
    await until(A, v => v.drawn && v.veh === 'car', 'at the wheel: a car');

    // leaving: gone from the other's world, and a line in the log
    await B.evaluate(() => netLeave());
    await A.waitForFunction(() => net.peers.size === 0, null, { timeout: 6000, polling: 100 });
    assert.ok(await A.evaluate(() => net.chat.some(m => m.text === 'Bob left.')));
    assert.equal(await A.evaluate(() => net.clockOwner), true, 'alone: the clock is yours again');
    await A.evaluate(() => { netLeave(); localStorage.clear(); });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ghosts only (?netfeatures=none): each sees the other (on a skateboard too), but T is just T and each keeps their own clock', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE + '&netfeatures=none');
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'ghosts-' + Date.now().toString(36);
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    const met = () => [...net.peers.values()].some(p => p.hello && !p.mismatch);
    await A.waitForFunction(met, null, { timeout: 8000, polling: 100 });
    await B.waitForFunction(met, null, { timeout: 8000, polling: 100 });
    assert.deepEqual(await A.evaluate(() => ({ chat: NET_FEATURES.chat, clock: NET_FEATURES.clock })), { chat: false, clock: false });
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; pitch = 0; tod = 12; weather = 'clear'; }, spot);
    await B.evaluate(s => { mode = 'walk'; room = null; px = mod(s.x + Math.cos(s.a) * 0.5, N); py = mod(s.y + Math.sin(s.a) * 0.5, N); a = s.a + Math.PI; tod = 22; weather = 'rain'; }, spot);
    let seen = null;
    for (let k = 0; k < 60 && !(seen && seen.drawn && Math.abs(seen.d - 0.5) < 0.02); k++) {
      seen = await A.evaluate(() => { render(0); const p = [...net.peers.values()][0]; return { drawn: p.drawn, d: p.view && Math.hypot(rel(p.view.x - px), rel(p.view.y - py)) }; });
      await A.waitForTimeout(100);
    }
    assert.ok(seen.drawn && Math.abs(seen.d - 0.5) < 0.02, 'the ghost, where he is: ' + JSON.stringify(seen));
    await A.bringToFront();
    await A.keyboard.press('KeyT');
    assert.equal(await A.evaluate(() => netTyping()), false, 'no chat box');
    assert.equal(await A.evaluate(() => netSay('hello')), false, 'and nothing sent');
    // on a skateboard: the board under them and the rider side on to it, not someone standing on air
    await B.evaluate(() => { clearInventory(); carryItem({ id: 'skateboard', uses: 0 }); held = 0; fx.skating = true; SKB.yaw = 1.2; SKB.pitch = SKB.roll = 0; });
    let drawnBoard = null;
    for (let k = 0; k < 40 && !(drawnBoard && drawnBoard.board && drawnBoard.rider); k++) {
      drawnBoard = await A.evaluate(() => {
        let board = 0, rider = 0; const b0 = drawSkateBoard, r0 = drawFigure;
        drawSkateBoard = (...x) => { board++; return b0(...x); }; drawFigure = (...x) => { if (/^(ride|push|crouch|skateair)/.test(x[7])) rider++; return r0(...x); };
        try { render(0); } finally { drawSkateBoard = b0; drawFigure = r0; }
        const v = [...net.peers.values()][0].view; return { board, rider, yaw: v && v.sk && v.sk.yaw };
      });
      await A.waitForTimeout(100);
    }
    assert.ok(drawnBoard.board && drawnBoard.rider, 'Bob on his board: ' + JSON.stringify(drawnBoard));
    assert.ok(Number.isFinite(drawnBoard.yaw), 'with the way his board points (his own skate physics moves it on from the value set here)');
    await A.waitForTimeout(2500); // (longer than the clock's broadcast interval)
    assert.ok(Math.abs(await A.evaluate(() => tod) - 12) < 0.5, 'Ann keeps her own time');
    assert.equal(await B.evaluate(() => weather), 'rain', 'and Bob his own weather');
    await A.evaluate(() => { netLeave(); localStorage.clear(); }); await B.evaluate(() => netLeave());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('spray paint: a tag one player sprays is on everyone\'s wall, a late arrival gets it, it blocks the spot, and goes when they leave', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'paint-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => { tags.length = 0; reindexTags(); netJoin(r, 'Ann'); }, room);
    await B.evaluate(r => { tags.length = 0; reindexTags(); netJoin(r, 'Bob'); }, room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    // Bob, up against a shop wall with a can, sprays
    const sprayed = await B.evaluate(() => {
      clearInventory(); carryItem({ id: 'spraypaint', uses: 6 }); held = 0; mode = 'walk'; room = null; paused = true;
      for (const d of doors.filter(d => d.use === 'shop')) for (let k = 0; k < 8; k++) {
        px = d.x; py = d.y; a = k * Math.PI / 4; pitch = 0; render(0);
        const tg = sprayTarget(); if (!tg || !paintable(tg.cell)) continue;
        sprayTag(); if (tags.length) return { tag: tags[0], px, py, a };
      }
      return null;
    });
    assert.ok(sprayed, 'Bob found a wall and sprayed it');
    const has = (P, t) => P.evaluate(t => (tagIndex.get(t.cell) || []).some(x => x.face === t.face && x.u === t.u), t);
    for (let k = 0; k < 30 && !(await has(A, sprayed.tag)); k++) await A.waitForTimeout(100);
    assert.equal(await has(A, sprayed.tag), true, 'on Ann\'s wall');
    assert.equal(await A.evaluate(() => tags.length), 0, 'but not in Ann\'s own tags (or her save)');
    // drawn: Ann where Bob stood sees paint on the wall in front of her that a frame without Bob's tags doesn't have
    const painted = await A.evaluate(s => {
      mode = 'walk'; room = null; px = s.px; py = s.py; a = s.a; pitch = 0; paused = true;
      render(0); const withTag = CH.join('');
      const keep = net.on; net.on = false; reindexTags(); render(0); const without = CH.join(''); net.on = keep; reindexTags();
      return withTag !== without;
    }, sprayed);
    assert.equal(painted, true, 'and painted there');
    // someone joining later gets it too
    const C = await open();
    await C.evaluate(r => { tags.length = 0; reindexTags(); netJoin(r, 'Cat'); }, room);
    for (let k = 0; k < 60 && !(await has(C, sprayed.tag)); k++) await C.waitForTimeout(100);
    assert.equal(await has(C, sprayed.tag), true, 'a late arrival sees it');
    // the spot's taken, whoever's tag it is
    const again = await A.evaluate(() => { clearInventory(); carryItem({ id: 'spraypaint', uses: 6 }); held = 0; sprayTag(); return { msg: msgText, mine: tags.length }; });
    assert.deepEqual(again, { msg: 'There\'s a tag there already. Find a clean wall.', mine: 0 });
    // Bob leaves: his tag comes off the others' walls
    await B.evaluate(() => netLeave());
    for (let k = 0; k < 80 && (await has(A, sprayed.tag)); k++) await A.waitForTimeout(100);
    assert.equal(await has(A, sprayed.tag), false, 'gone with him');
    await A.evaluate(() => { netLeave(); localStorage.clear(); }); await C.evaluate(() => netLeave());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('shared cars: Bob\'s car in Ann\'s traffic, a lift (carried along, out by E, out when he parks, out when he goes), dents and bullets to the owner, and taking one he left', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'cars-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const until = async (P, f, arg, what) => { for (let k = 0; k < 80; k++) { if (await P.evaluate(f, arg)) return; await P.waitForTimeout(100); } assert.fail(what); };
    const drive = () => B.evaluate(() => { const c = cars.find(c => c.kind === 'car' && !c.patrol && !c.ev && c.body !== TAXI && !c.remote); mode = 'walk'; room = null; px = c.x; py = c.y; me = c; mode = 'drive'; c.player = true; c.parked = false; c.v = 0; c.dmg = 0; a = Math.atan2(c.hy, c.hx); return { x: c.x, y: c.y, hx: c.hx, hy: c.hy }; });
    const beside = c => { mode = 'walk'; room = null; me = null; px = mod(c.x - c.hy * 0.3, N); py = mod(c.y + c.hx * 0.3, N); a = 0; };

    // Bob at the wheel: a stand-in in Ann's traffic that her traffic never drives
    let car = await drive();
    await A.evaluate(beside, car);
    await until(A, () => [...net.cars.values()].some(c => !c.parked && cars.includes(c) && c.remote), null, 'Bob\'s car in Ann\'s traffic');
    assert.equal(await A.evaluate(() => { const c = [...net.cars.values()][0], x = c.x; stepTraffic(0.5, T); return c.x === x; }), true, 'her traffic leaves it be');

    // a lift: E by it, carried along when he drives, E to get out
    assert.equal(await A.evaluate(() => promptText()), 'E: ride with Bob');
    await A.evaluate(() => interact());
    await until(A, () => mode === 'ride', null, 'Ann gets in');
    assert.equal(await B.evaluate(() => net.riders.size), 1);
    await B.evaluate(() => { me.x = mod(me.x + me.hx * 2, N); me.y = mod(me.y + me.hy * 2, N); me.ex = me.x; me.ey = me.y; px = me.x; py = me.y; });
    await until(A, c => Math.hypot(rel(px - (c.x + c.hx * 2)), rel(py - (c.y + c.hy * 2))) < 0.12, car, 'carried along');
    await A.evaluate(() => interact());
    assert.deepEqual(await A.evaluate(() => [mode, !!me]), ['walk', false], 'E gets her out');
    await until(B, () => net.riders.size === 0, null, 'Bob\'s told');
    // back in, and Bob parks: she's put out
    car = await B.evaluate(() => ({ x: me.x, y: me.y, hx: me.hx, hy: me.hy }));
    await A.evaluate(beside, car); await A.waitForTimeout(300);
    await A.evaluate(() => interact()); await until(A, () => mode === 'ride', null, 'in again');
    await B.evaluate(() => leaveCar());
    await until(A, () => mode === 'walk', null, 'put out when he parks');

    // parked: a crash and a bullet dent it, on Bob's side (the owner's)
    await until(A, () => [...net.cars.values()].some(c => c.parked), null, 'parked stand-in');
    await A.evaluate(() => { damageCar([...net.cars.values()][0], 16); });
    await until(B, () => ([...net.mine][0]?.dmg || 0) >= 16, null, 'dented on Bob\'s side');
    assert.equal(await B.evaluate(() => [...net.mine][0].alarmT !== undefined), true, 'and its alarm goes');
    const shot = await A.evaluate(c => { clearInventory(); carryItem({ id: 'revolver', uses: 6 }); held = 0; gun.cool = 0; gun.reload = 0; mode = 'walk'; px = mod(c.x - c.hy * 0.5, N); py = mod(c.y + c.hx * 0.5, N); a = Math.atan2(rel(c.y - py), rel(c.x - px)); const s = fireGun(px, py, walkGround(px, py) + 0.12, a, -0.12); return s && s.what; }, car);
    assert.equal(shot, 'car', 'Ann\'s bullet hits the stand-in');
    await until(B, () => ([...net.mine][0]?.dmg || 0) >= 28, null, 'and Bob\'s car takes it');

    // Ann takes the car Bob left: hers, and gone from his city
    await A.evaluate(c => { clearInventory(); mode = 'walk'; px = mod(c.x - c.hy * 0.3, N); py = mod(c.y + c.hx * 0.3, N); }, car);
    assert.equal(await A.evaluate(() => promptText()), 'E: take Bob\'s car');
    await B.evaluate(() => { window.leftCar = [...net.mine][0]; });
    await A.evaluate(() => interact());
    await until(A, () => mode === 'drive' && me && !me.remote, null, 'Ann drives it');
    await until(B, () => !cars.includes(window.leftCar) && net.mine.size === 0, null, 'gone from Bob\'s city');
    await until(B, () => [...net.cars.values()].some(c => !c.parked && net.peers.get(c.owner)?.name === 'Ann'), null, 'Bob sees Ann driving it');

    // a lift with Bob again, then he leaves the room: she's put out, and his cars are gone from hers
    await A.evaluate(() => leaveCar());
    car = await drive();
    await A.evaluate(beside, car); await A.waitForTimeout(400);
    // (wherever this car happens to be, E might find a machine or a door first: ask for the lift directly)
    await until(A, () => !!netCarNear(), null, 'his new car in Ann\'s traffic');
    await A.evaluate(() => netCarUse()); await until(A, () => mode === 'ride', null, 'in a third time');
    await B.evaluate(() => netLeave());
    await until(A, () => mode === 'walk' && ![...net.cars.values()].some(c => net.peers.get(c.owner)?.name === 'Bob'), null, 'put out when he goes');
    await A.evaluate(() => { netLeave(); localStorage.clear(); });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('freehand spray paint: what Bob sprays is on Ann\'s walls (and kept), someone arriving later gets it, and nothing doubles', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      await page.evaluate(() => paintLoad([]));
      return page;
    };
    const A = await open(), B = await open(), room = 'spray-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const until = async (P, f, arg, what) => { for (let k = 0; k < 80; k++) { if (await P.evaluate(f, arg)) return; await P.waitForTimeout(100); } assert.fail(what + ': ' + await P.evaluate(() => sprayDots.length)); };
    // Bob sprays a stroke of 40 dots (as stepSprayPaint does: paintDots announces them)
    await B.evaluate(() => { const d = doors.find(d => d.use === 'shop'), cell = idx(Math.floor(d.x), Math.floor(d.y)); paintDots(Array.from({ length: 40 }, (_, k) => [cell, 0, d.x + k * 0.002, 0.15, 0.01, 4, 1000 + k])); });
    await until(A, () => sprayDots.length === 40, null, 'on Ann\'s walls');
    assert.equal(await A.evaluate(() => paintSave().length), 40, 'and in what Ann\'s save keeps');
    // Cat arrives: both send her what they've got; she gets the 40 once, not twice
    const C = await open();
    await C.evaluate(r => netJoin(r, 'Cat'), room);
    await until(C, () => sprayDots.length === 40, null, 'Cat gets it');
    await C.waitForTimeout(1000);
    assert.equal(await C.evaluate(() => sprayDots.length), 40, 'once, though Ann and Bob both sent it');
    // Bob leaves and comes back: his paint isn't added again
    await B.evaluate(() => netLeave()); await A.waitForFunction(() => net.peers.size === 1, null, { timeout: 8000, polling: 100 });
    await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].filter(p => p.hello).length === 2, null, { timeout: 8000, polling: 100 });
    await A.waitForTimeout(1000);
    assert.equal(await A.evaluate(() => sprayDots.length), 40, 'still 40 after he rejoins');
    for (const P of [A, B, C]) await P.evaluate(() => netLeave());
    await A.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('guns: Ann\'s shot hits Bob (his game takes the damage), enough put him in hospital and lying in the street for her, peaceful (either of them) spares him, and indoors too', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'guns-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const until = async (P, f, arg, what) => { for (let k = 0; k < 80; k++) { if (await P.evaluate(f, arg)) return; await P.waitForTimeout(100); } assert.fail(what); };
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    const facing = s => { mode = 'walk'; room = null; px = mod(s.x + Math.cos(s.a) * 0.6, N); py = mod(s.y + Math.sin(s.a) * 0.6, N); a = s.a + Math.PI; needs.health = 100; wakeT = 0; };
    const inFront = () => until(A, () => { render(0); const p = [...net.peers.values()][0]; return p.view && p.view.rk === 'out' && Math.abs(Math.hypot(rel(p.view.x - px), rel(p.view.y - py)) - 0.6) < 0.02; }, null, 'Bob in front of Ann');
    await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; pitch = 0; clearInventory(); carryItem({ id: 'revolver', uses: 6 }); held = 0; for (const p of people) p.hidden = true; }, spot);
    await B.evaluate(facing, spot);
    await inFront();
    const fire = (indoors = false) => A.evaluate(i => { inv[0].uses = 6; gun.cool = 0; gun.reload = 0; render(0); const r = fireGun(px, py, i ? eye - 0.3 : eye, a, 0, i); return r && r.what; }, indoors);

    assert.equal(await fire(), 'player', 'the round stops at Bob');
    await until(B, () => needs.health < 100 && gun.copShots.some(s => s.hit), null, 'Bob hit, on his side');
    for (let k = 0; k < 5 && !(await B.evaluate(() => mode === 'room')); k++) { await fire(); await A.waitForTimeout(150); }
    await until(B, () => mode === 'room' && room.kind === 'hospital', null, 'Bob in hospital');
    await until(A, () => net.chat.some(m => m.text === 'Bob went down, shot by you.'), null, 'Ann told');
    assert.equal(await A.evaluate(() => { const f = [...net.peers.values()][0].fallen; return !!f && f.until > netNow(); }), true, 'lying where he fell, for her');

    // peaceful, on either side: the round goes past, and he's unhurt
    await B.evaluate(() => { leaveRoom(); net.peaceful = true; }); await B.evaluate(facing, spot);
    await inFront();
    await until(A, () => netViewOf([...net.peers.values()][0])?.peaceful, null, 'Bob peaceful');
    assert.equal(await fire(), 'air', 'Bob peaceful: it goes past');
    await B.evaluate(() => { net.peaceful = false; }); await A.evaluate(() => { net.peaceful = true; });
    await until(A, () => !netViewOf([...net.peers.values()][0])?.peaceful, null, 'Bob not peaceful');
    assert.equal(await fire(), 'air', 'Ann peaceful: no player to hit');
    await A.waitForTimeout(600);
    assert.equal(await B.evaluate(() => needs.health), 100, 'unhurt');
    await A.evaluate(() => { net.peaceful = false; });

    // indoors: the same, in the same room
    const enter = (P, s) => P.evaluate(s => { mode = 'walk'; room = null; px = LIGHTHOUSE.x; py = LIGHTHOUSE.y; enterRoom('lighthouse', { word: 'LIGHTHOUSE', ret: [LIGHTHOUSE.x, LIGHTHOUSE.y, 0], line: 'hi' }, s); }, s);
    await enter(A, [4, 6.2, -Math.PI / 2]); await enter(B, [4, 4.0, Math.PI / 2]);
    await until(A, () => { render(0); const p = [...net.peers.values()][0]; return p.view && p.view.rk === netRoomKey(); }, null, 'same room');
    assert.equal(await fire(true), 'player');
    await until(B, () => needs.health < 100, null, 'hurt indoors');
    for (const P of [A, B]) await P.evaluate(() => netLeave());
    await A.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('rod hooks: Ann\'s cast catches Bob, he\'s held at the end of her line, Q reels him in to her feet; again, and he struggles free', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'hook-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const until = async (P, f, arg, what) => { for (let k = 0; k < 100; k++) { if (await P.evaluate(f, arg)) return; await P.waitForTimeout(100); } assert.fail(what); };
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    const place = async () => {
      await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; pitch = 0; clearInventory(); carryItem({ id: 'rod', uses: 0 }); held = 0; fishing = null; for (const p of people) p.hidden = true; }, spot);
      await B.evaluate(s => { mode = 'walk'; room = null; px = mod(s.x + Math.cos(s.a) * 0.6, N); py = mod(s.y + Math.sin(s.a) * 0.6, N); a = s.a + Math.PI; }, spot);
      await until(A, () => { render(0); const p = [...net.peers.values()][0]; return p.view && Math.abs(Math.hypot(rel(p.view.x - px), rel(p.view.y - py)) - 0.6) < 0.02; }, null, 'Bob in front of Ann');
      await until(B, () => { const v = netViewOf([...net.peers.values()][0]); return v && Math.abs(Math.hypot(rel(v.x - px), rel(v.y - py)) - 0.6) < 0.02; }, null, 'and Ann where Bob sees her'); // (she was moved here: let it reach him)
    };
    // a short cast (as letting go of Q does), stepped through its flight
    const cast = () => A.evaluate(() => { fishing = { st: 'wind', t: 0, power: 0.2, rod: 'rod' }; castLine(); for (let k = 0; k < 60 && fishing && fishing.st === 'fly'; k++) { T += 0.02; stepFishing(0.02); } return fishing && fishing.st; });

    await place();
    assert.equal(await cast(), 'hooked', 'the lure catches Bob');
    await until(B, () => !!net.hooked, null, 'Bob on the line, in his game');
    const held = await B.evaluate(() => { const s = netViewOf([...net.peers.values()][0]); px = mod(px + (px - s.x) * 2, N); py = mod(py + (py - s.y) * 2, N); netHookFrame(0.016); return Math.hypot(rel(px - s.x), rel(py - s.y)); });
    assert.ok(held < 0.75, 'walking off, he\'s held at the end of the line: ' + held);
    await A.evaluate(() => rodUse({ indoors: false })); // (Q)
    await until(B, () => net.hooked && net.hooked.haul, null, 'reeling');
    await until(B, () => !net.hooked, null, 'reeled in to her feet');
    await until(A, () => !net.hooking && /at your feet/.test(msgText), null, 'Ann told');

    await A.evaluate(() => { fishing = null; }); await place();
    assert.equal(await cast(), 'hooked');
    await until(B, () => !!net.hooked, null, 'hooked again');
    await B.evaluate(() => { for (let k = 0; k < 8; k++) { K.Space = 1; netHookFrame(0.016); K.Space = 0; netHookFrame(0.016); } });
    assert.equal(await B.evaluate(() => !!net.hooked), false, 'mashing Space works it loose');
    await until(A, () => !net.hooking && /works the hook loose/.test(msgText), null, 'Ann told he got free');
    for (const P of [A, B]) await P.evaluate(() => netLeave());
    await A.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('police: the chase after Bob is in Ann\'s street (lights, siren, the officer running) but never after her; busted with her aboard, she\'s out with a star', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'cops-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const until = async (P, f, arg, what) => { for (let k = 0; k < 100; k++) { if (await P.evaluate(f, arg)) return; await P.waitForTimeout(100); } assert.fail(what); };
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; pitch = 0; clearWanted(); }, spot);
    // Bob, wanted: a cruiser and an officer on foot after him (as crime.js sends them)
    await B.evaluate(s => { mode = 'walk'; room = null; px = mod(s.x + Math.cos(s.a) * 1.2, N); py = mod(s.y + Math.sin(s.a) * 1.2, N);
      addWanted('gunfire', px, py, true);
      const c = cars.find(c => c.patrol && !playerCar(c)); c.pursuit = true; c.x = mod(px + 0.6, N); c.y = py; c.ex = c.x; c.ey = c.y;
      const f = footCops[0]; f.chase = true; f.x = mod(px - 0.3, N); f.y = py; }, spot);
    await until(A, () => [...net.cars.values()].some(c => c.cop), null, 'Bob\'s cruiser in Ann\'s traffic');
    assert.deepEqual(await A.evaluate(() => { const c = [...net.cars.values()].find(c => c.cop); return { inCars: cars.includes(c), lightsAndSiren: code(c), pursuit: !!c.pursuit }; }),
      { inCars: true, lightsAndSiren: true, pursuit: false }, 'lit up and wailing, and never one of hers');
    assert.ok(await A.evaluate(() => { let n = 0; const o = drawFigure; drawFigure = (...x) => { if (x[6]?.shape?.includes('copcap')) n++; return o(...x); }; try { render(0); } finally { drawFigure = o; } return n > 0; }), 'his officer on foot, running');
    for (let k = 0; k < 20; k++) await A.evaluate(() => stepCrime(0.05));
    assert.deepEqual(await A.evaluate(() => ({ stars: wanted.stars, busted: wanted.busted, mine: cars.filter(c => c.pursuit).length })), { stars: 0, busted: false, mine: 0 }, 'Ann\'s police don\'t want her for it');
    assert.equal(await A.evaluate(() => netCopCarNear({ x: [...net.cars.values()].find(c => c.cop).x, y: [...net.cars.values()].find(c => c.cop).y })), true, 'her own patrol car there would be hidden');

    // Bob drives, Ann rides, Bob's busted: she's put out, and wanted
    const car = await B.evaluate(() => { clearWanted(); const c = cars.find(c => c.kind === 'car' && !c.patrol && !c.ev && c.body !== TAXI && !c.remote); px = c.x; py = c.y; me = c; mode = 'drive'; c.player = true; c.parked = false; c.v = 0; a = Math.atan2(c.hy, c.hx); return { x: c.x, y: c.y, hx: c.hx, hy: c.hy }; });
    await A.evaluate(c => { clearWanted(); mode = 'walk'; room = null; me = null; px = mod(c.x - c.hy * 0.3, N); py = mod(c.y + c.hx * 0.3, N); }, car);
    await until(A, () => !!netCarNear(), null, 'Bob\'s car near'); await A.evaluate(() => netCarUse());
    await until(A, () => mode === 'ride', null, 'Ann rides');
    await B.evaluate(() => { addWanted('gunfire', px, py, true); wanted.busted = true; });
    await until(A, () => mode === 'walk', null, 'Ann put out');
    assert.deepEqual(await A.evaluate(() => ({ stars: wanted.stars, crime: wanted.crime })), { stars: 1, crime: 'riding with a wanted driver' });
    for (const P of [A, B]) await P.evaluate(() => { clearWanted(); netLeave(); });
    await A.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('what else others see: paused (can\'t be shot, says so), spraying, a bail, peeing, a boat, an aircraft, who\'s riding in a car, and everyone on the maps; Chat for phones and pads', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'seen-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; pitch = 0; for (const p of people) p.hidden = true; }, spot);
    await B.evaluate(s => { mode = 'walk'; room = null; px = worldCoord(s.x + Math.cos(s.a) * 0.6); py = worldCoord(s.y + Math.sin(s.a) * 0.6); a = s.a + Math.PI; needs.health = 100; }, spot);
    // each check: Bob sets something up and sends an update at once (so his own game can't move on first); Ann looks
    const sent = setup => B.evaluate(new Function(setup + '; net.lastSent = null; netSendTick(netNow());'));
    const seen = async (check, what) => { for (let k = 0; k < 40; k++) { const v = await A.evaluate(new Function('const p = [...net.peers.values()][0], v = netViewOf(p); return ' + check)); if (v) return v; await A.waitForTimeout(100); } assert.fail(what); };
    const calls = (P, names) => P.evaluate(names => { const n = {}, saved = {}; for (const f of names) { n[f] = 0; saved[f] = window[f]; window[f] = (...x) => { n[f]++; return saved[f](...x); }; } try { render(0); } finally { for (const f of names) window[f] = saved[f]; } return n; }, names);

    await seen('v && Math.abs(Math.hypot(rel(v.x - px), rel(v.y - py)) - 0.6) < 0.02', 'Bob in front of Ann');
    // paused: shots pass through him, and his name says so
    await sent('paused = true');
    await seen('v && v.away', 'Bob away');
    assert.equal(await A.evaluate(() => { clearInventory(); carryItem({ id: 'revolver', uses: 6 }); held = 0; gun.cool = 0; render(0); const r = fireGun(px, py, eye, a, 0, false); return r && r.what; }), 'air', 'the round goes past him');
    await A.waitForTimeout(300);
    assert.equal(await B.evaluate(() => needs.health), 100);
    await sent('paused = false');
    // spraying: arms out, a mist off the can
    await sent("clearInventory(); carryItem({ id: 'spraypaint', uses: 6 }); held = 0; K.KeyQ = 1");
    assert.equal(await seen('v && v.spray && v.pose', 'spraying'), 'reach');
    await B.evaluate(() => { K.KeyQ = 0; clearInventory(); });
    // a bail: tumbling, the board off on its own
    // (a bail faked this way isn't one his own skate code could draw: sent, then put back before his next frame)
    await B.evaluate(() => { clearInventory(); carryItem({ id: 'skateboard', uses: 0 }); held = 0; fx.skating = true; SK.bailAt = [px, py, a, a]; SK.bail = 1; SK.bailData = { t0: T, board: [worldCoord(px + 0.1), py, skateGround(px, py)], yaw: 0.3, roll: 1 };
      net.lastSent = null; netSendTick(netNow()); SK.bailAt = null; SK.bailData = null; SK.bail = 0; fx.skating = false; net.sendT = 5; }); // (and hold his next update back while Ann looks)
    assert.match(await seen('v && /^tumble/.test(v.pose) && v.pose', 'bail'), /^tumble/);
    assert.ok((await calls(A, ['drawSkateBoard'])).drawSkateBoard >= 1, 'the board drawn where it went');
    await B.evaluate(() => { net.sendT = 0; clearInventory(); });
    // peeing: his stream runs through Ann's own pee.js, from where he stands
    await sent("pee = { left: 30, t: 1, at: placeKey(), loo: null, seen: 99, caught: true }");
    await seen('v && v.pee', 'peeing');
    assert.ok(await A.evaluate(() => { peeDrops.length = 0; for (let k = 0; k < 30; k++) { T += 1 / 60; netPeeFrame(1 / 60); } const v = netViewOf([...net.peers.values()][0]); return peeDrops.length > 10 && peeDrops.every(d => Math.hypot(rel(d.x - v.x), rel(d.y - v.y)) < 0.3); }), 'his stream, in her street');
    await B.evaluate(() => { pee = null; });
    // at the helm of a boat, then flying
    await sent("sea = { kind: Object.keys(BOAT_KINDS)[0], x: px, y: py, hx: 1, hy: 0, v: 0.5, col: RED }; mode = 'sea'");
    await seen("v && v.craft && v.craft.k === 'sea'", 'boat');
    assert.equal((await calls(A, ['drawBoat3D'])).drawBoat3D >= 1, true, 'his boat drawn');
    await sent("sea = null; const ac = aircraft[0]; pilot = ac; mode = 'air'; ac.x = px; ac.y = py; ac.z = 1.5");
    await seen("v && v.craft && v.craft.k === 'air'", 'aircraft');
    const air = await calls(A, ['drawPlaneCraft', 'drawHeliCraft']);
    assert.equal(air.drawPlaneCraft + air.drawHeliCraft >= 1, true, 'his aircraft drawn');
    await B.evaluate(() => { pilot.state = 'parked'; pilot = null; mode = 'walk'; });
    // on the maps: the minimap's marks and the big map both have him
    const mapped = await A.evaluate(() => { const q = netMapPlayers(); return q.length === 1 && q[0].name === 'Bob' && !q[0].inside; });
    assert.equal(mapped, true);
    await B.evaluate(() => { mode = 'walk'; room = null; px = LIGHTHOUSE.x; py = LIGHTHOUSE.y; enterRoom('lighthouse', { word: 'LIGHTHOUSE', ret: [LIGHTHOUSE.x, LIGHTHOUSE.y, 0], line: 'hi' }, [4, 6.2, 0]); net.lastSent = null; netSendTick(netNow()); });
    for (let k = 0; k < 40 && !(await A.evaluate(() => netMapPlayers()[0]?.inside)); k++) await A.waitForTimeout(100);
    assert.deepEqual(await A.evaluate(() => { const q = netMapPlayers()[0]; return [q.inside, Math.round(q.x * 10) / 10 === Math.round(LIGHTHOUSE.x * 10) / 10]; }), [true, true], 'inside: shown at the door he went in by');
    await B.evaluate(() => leaveRoom());
    // Bob in Ann's car: the tag over it has him too
    const car = await A.evaluate(() => { clearInventory(); const c = cars.find(c => c.kind === 'car' && !c.patrol && !c.ev && c.body !== TAXI); px = c.x; py = c.y; me = c; mode = 'drive'; c.player = true; c.parked = false; c.v = 0; a = Math.atan2(c.hy, c.hx); return { x: c.x, y: c.y, hx: c.hx, hy: c.hy }; });
    await B.evaluate(c => { mode = 'walk'; room = null; me = null; px = worldCoord(c.x - c.hy * 0.3); py = worldCoord(c.y + c.hx * 0.3); }, car);
    for (let k = 0; k < 40 && !(await B.evaluate(() => !!netCarNear())); k++) await B.waitForTimeout(100);
    await B.evaluate(() => netCarUse());
    for (let k = 0; k < 40 && !(await B.evaluate(() => mode === 'ride')); k++) await B.waitForTimeout(100);
    const C = await open();
    await C.evaluate(r => netJoin(r, 'Cat'), room);
    await C.evaluate(c => { mode = 'walk'; room = null; px = worldCoord(c.x - c.hy * 0.8); py = worldCoord(c.y + c.hx * 0.8); a = Math.atan2(rel(c.y - py), rel(c.x - px)); pitch = 0; }, car);
    let tag = '';
    for (let k = 0; k < 60 && !/\+ Bob/.test(tag); k++) { tag = await C.evaluate(() => { render(0); return [...net.peers.values()].map(p => p.tagName || '').join('|'); }); await C.waitForTimeout(100); }
    assert.match(tag, /Ann \+ Bob/, 'the car\'s tag names its passenger');
    // phones and pads: Chat in the More sheet (and so in a controller's Actions)
    assert.equal(await A.evaluate(() => SHEET.some(([l, k, w]) => l === 'Chat' && k === 'KeyT' && (!w || w()))), true);
    for (const P of [A, B, C]) await P.evaluate(() => netLeave());
    await A.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('car hits, pickpocketing and soccer balls between players: knocked flat then hospital; a clean lift and a caught one; a ball passed on, only its owner picks it up', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'pvp-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const until = async (P, f, arg, what) => { for (let k = 0; k < 80; k++) { if (await P.evaluate(f, arg)) return; await P.waitForTimeout(100); } assert.fail(what); };
    const seeB = (cond, what) => until(A, new Function('const v = netViewOf([...net.peers.values()][0]); return v && (' + cond + ');'), null, what);
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; pitch = 0; for (const p of people) p.hidden = true; }, spot);
    await B.evaluate(s => { mode = 'walk'; room = null; px = worldCoord(s.x + Math.cos(s.a) * 0.6); py = worldCoord(s.y + Math.sin(s.a) * 0.6); a = s.a + Math.PI; needs.health = 100; wakeT = 0; }, spot);
    await seeB('Math.abs(Math.hypot(rel(v.x - px), rel(v.y - py)) - 0.6) < 0.02', 'Bob in front');

    // hit by Ann's car (as drive() finds him at the bumper): hurt and flat for a moment, which Ann sees; then hard enough for hospital
    await A.evaluate(() => { const c = cars.find(c => c.kind === 'car' && !c.patrol && !c.ev && c.body !== TAXI && !c.remote); me = c; mode = 'drive'; c.player = true; c.parked = false; c.v = 1.2; window.myCar = c; });
    assert.equal(await A.evaluate(() => { myCar.v = 1.2; const v = netViewOf([...net.peers.values()][0]); return netCarHitsPlayer(myCar, v.x, v.y); }), true); // (the speed set here: her own driving would slow the car between steps)
    await until(B, () => !!net.knocked && needs.health < 100 && needs.health > 0, null, 'Bob knocked flat, hurt');
    await seeB("v.pose === 'down'", 'Ann sees him down');
    await until(B, () => !net.knocked, null, 'up again');
    await A.evaluate(() => { net.runT.clear(); myCar.v = 2.2; }); await B.evaluate(() => { needs.health = 20; });
    await seeB("v.pose !== 'down'", 'up, for Ann');
    for (let k = 0; k < 10 && !(await B.evaluate(() => mode === 'room')); k++) { // (till Ann's view of him has caught up with where the first hit left him)
      await A.evaluate(() => { net.runT.clear(); myCar.v = 2.2; const v = netViewOf([...net.peers.values()][0]); netCarHitsPlayer(myCar, v.x, v.y); });
      await A.waitForTimeout(300);
    }
    await until(B, () => mode === 'room' && room.kind === 'hospital', null, 'Bob in hospital');
    await until(A, () => net.chat.some(m => m.text === 'Bob went down, hit by your car.'), null, 'Ann told');
    await A.evaluate(() => { clearWanted(); leaveCar(); }); await B.evaluate(() => leaveRoom());

    // pickpocketing: Ann right behind Bob, who faces away
    await A.evaluate(s => { mode = 'walk'; me = null; px = s.x; py = s.y; a = s.a; money = 0; }, spot);
    await B.evaluate(s => { mode = 'walk'; room = null; px = worldCoord(s.x + Math.cos(s.a) * 0.2); py = worldCoord(s.y + Math.sin(s.a) * 0.2); a = s.a; money = 200; }, spot);
    await seeB('Math.abs(Math.hypot(rel(v.x - px), rel(v.y - py)) - 0.2) < 0.02 && Math.abs(v.a - a) < 0.1', 'Bob ahead, facing away');
    assert.equal(await A.evaluate(() => crimePrompt()), 'G: pick Bob\'s pocket');
    await A.evaluate(() => netPickpocket(netPickTarget()));
    await until(B, () => !!net.picked, null, 'a hand in Bob\'s pocket');
    await A.evaluate(() => { const cb = game.onDone; game = null; cb(true); }); // (Ann wins the minigame before he notices)
    await until(A, () => money === 20, null, 'Ann lifts a tenth');
    assert.equal(await B.evaluate(() => money), 180, 'out of Bob\'s pocket');
    await B.evaluate(() => net.pickCool.clear());
    await A.evaluate(() => netPickpocket(netPickTarget()));
    await until(B, () => net.picked && net.picked.noticed, null, 'Bob feels it');
    await B.evaluate(() => { a += Math.PI; }); // (and turns round)
    await until(A, () => !net.picking && !game && /catches you|grabs your wrist/.test(msgText), null, 'Ann caught, the game over');
    assert.equal(await A.evaluate(() => money), 20, 'nothing more');
    // peaceful: not a target
    await B.evaluate(() => { a -= Math.PI; net.peaceful = true; });
    await seeB('v.peaceful', 'Bob peaceful');
    assert.equal(await A.evaluate(() => netPickTarget()), null, 'a peaceful player can\'t be pickpocketed');
    await B.evaluate(() => { net.peaceful = false; });
    await A.evaluate(() => clearWanted());

    // a ball: Bob's, kicked; Ann walks into it and runs it; she can't pick it up, he can, and then it's gone for her
    await B.evaluate(s => { a = s.a; kickBall(px, py, a, 0.3); }, spot);
    await until(A, () => net.balls.size === 1 && [...net.balls.values()][0].runner !== net.selfId, null, 'Ann sees Bob\'s ball');
    await A.evaluate(() => { const b = [...net.balls.values()][0]; px = b.x; py = b.y; netBallFrame(0.016, netNow()); });
    assert.equal(await A.evaluate(() => [...net.balls.values()][0].runner === net.selfId), true, 'touched: Ann runs it');
    await until(B, () => !ball && net.balls.has(netMyBallId()), null, 'Bob\'s game hands it over');
    assert.deepEqual(await A.evaluate(() => [pickUpBall(), inv.some(i => i.id === 'ball')]), [false, false], 'not hers to pick up');
    await B.evaluate(() => { const b = net.balls.get(netMyBallId()); px = worldCoord(b.x + 0.2); py = b.y; }); // (by his own copy of it)
    assert.equal(await B.evaluate(() => promptText()), 'E: pick up the ball');
    assert.deepEqual(await B.evaluate(() => [pickUpBall(), inv.some(i => i.id === 'ball')]), [true, true], 'his to pick up');
    await until(A, () => net.balls.size === 0, null, 'gone for Ann');
    for (const P of [A, B]) await P.evaluate(() => { clearWanted(); netLeave(); });
    await A.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the players menu and visiting: Tab shows everyone, whisper, give money and an item, pick up what they put down, invite home and visit; ride in their boat and their aircraft; a taxi fare', async () => {
  const browser = await chromium.launch({ args: NET_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_);
      await page.waitForFunction(() => typeof netJoin === 'function' && Number.isFinite(eye));
      return page;
    };
    const A = await open(), B = await open(), room = 'soc-' + Date.now().toString(36);
    await A.evaluate(() => localStorage.clear());
    await A.evaluate(r => netJoin(r, 'Ann'), room); await B.evaluate(r => netJoin(r, 'Bob'), room);
    await A.waitForFunction(() => [...net.peers.values()].some(p => p.hello), null, { timeout: 8000, polling: 100 });
    const until = async (P, f, arg, what) => { for (let k = 0; k < 80; k++) { if (await P.evaluate(f, arg)) return; await P.waitForTimeout(100); } assert.fail(what); };
    const spot = await A.evaluate(() => { const d = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); return { x: d.x, y: d.y, a: d.ny ? 0 : Math.PI / 2 }; });
    await A.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; a = s.a; money = 100; clearInventory(); carryItem({ id: 'candy', uses: 1 }); }, spot);
    await B.evaluate(s => { mode = 'walk'; room = null; px = worldCoord(s.x + 0.5); py = s.y; money = 100; clearInventory(); }, spot);

    // Tab: open while held, gone when let go; click something and it stays
    await A.bringToFront(); await A.keyboard.down('Tab');
    assert.equal(await A.evaluate(() => netPlayersOpen()), true);
    assert.match(await A.evaluate(() => netPlayersEl.textContent), /Bob/);
    await A.keyboard.up('Tab');
    assert.equal(await A.evaluate(() => netPlayersOpen()), false, 'let go: gone');
    await A.keyboard.down('Tab'); await A.click('[data-np-act="whisper"]'); await A.keyboard.up('Tab');
    assert.equal(await A.evaluate(() => netPlayersOpen()), true, 'doing something: it stays');
    await A.fill('[data-np="input"]', 'psst bob'); await A.click('[data-np-act="send"]');
    await until(B, () => net.chat.some(m => m.who === 'Ann (whispers)' && m.text === 'psst bob'), null, 'Bob gets the whisper');
    assert.equal(await B.evaluate(() => !!net.peers.values().next().value.bubble), false, 'a whisper: no speech bubble');
    await A.click('[data-np-act="cancel"]'); await A.click('[data-np-act="cash"]'); await A.fill('[data-np="input"]', '25'); await A.click('[data-np-act="send"]');
    await until(B, () => money === 125, null, 'Bob gets $25');
    assert.equal(await A.evaluate(() => money), 75);
    await A.click('[data-np-act="item"]'); await A.click('[data-np-act="give"]');
    await until(B, () => inv.some(i => i.id === 'candy'), null, 'Bob gets the candy');
    await until(A, () => net.gifts.size === 0 && inv.length === 0, null, 'and it\'s gone from Ann\'s bag for good');
    await A.click('[data-np-act="done"]');

    // something Ann puts down: Bob sees it, and picking it up takes it out of her street
    await A.evaluate(() => { carryItem({ id: 'candy', uses: 1 }); held = 0; dropHere(); netSendDrops(); });
    const dpos = await A.evaluate(() => { const d = dropped.find(d => d.at === ''); return [d.x, d.y]; });
    await until(B, () => [...net.peers.values()][0].drops?.length === 1, null, 'Bob sees it');
    await B.evaluate(d => { px = d[0]; py = d[1]; }, dpos);
    assert.match(await B.evaluate(() => promptText()), /pick up the candy bar \(Ann put it down\)/);
    await B.evaluate(() => interact());
    await until(B, () => inv.filter(i => i.id === 'candy').length === 2, null, 'in Bob\'s bag');
    assert.equal(await A.evaluate(() => dropped.filter(d => d.at === '').length), 0, 'gone from Ann\'s street');

    // invited home: Bob gets in as a guest, in the same room as Ann in her own flat; her bed and closet aren't his
    await A.evaluate(() => { const sh = Object.values(SHOP).find(x => x && x.kind === SHOP_APTS), cell = Object.keys(SHOP).map(Number).find(k => SHOP[k] === sh); owned.homes.push({ cell, kind: Object.keys(ITEMS).find(k => ITEMS[k].kind === 'home'), decor: [], fridge: [], pet: null }); netInvite([...net.peers.values()][0]); });
    await until(B, () => net.invites.size === 1, null, 'Bob invited');
    const guest = await B.evaluate(() => { const [from, v] = [...net.invites][0]; netEnterAsGuest({ ...v, from }); return { rk: netRoomKey(), guest: !!room.guestHome, spot: homeSpot() }; });
    assert.equal(guest.guest, true);
    assert.equal(guest.spot, null, 'nothing of hers to use');
    const host = await A.evaluate(() => { const h = owned.homes[0], kind = homeRoomKind(h.kind); enterRoom(kind, { word: 'HOME', ret: [px, py, a], cell: [h.cell % N, Math.floor(h.cell / N)] }, ROOM_DEFS[kind].entry); return netRoomKey(); });
    assert.equal(host, guest.rk, 'the same flat');
    await until(A, () => { render(0); return [...net.peers.values()][0].drawn; }, null, 'Ann sees Bob in her flat');
    await A.evaluate(() => leaveRoom()); await B.evaluate(() => leaveRoom());

    // in Ann's boat, put out when she leaves the helm
    await A.evaluate(s => { const b = { kind: Object.keys(BOAT_KINDS)[0], x: worldCoord(s.x + 0.3), y: s.y, hx: 1, hy: 0, v: 0, col: RED }; sea = b; mode = 'sea'; px = b.x; py = b.y; }, spot);
    await B.evaluate(s => { mode = 'walk'; room = null; px = s.x; py = s.y; }, spot);
    await until(B, () => /ride in Ann's boat/.test(promptText()), null, 'by the boat');
    await B.evaluate(() => netCraftUse()); await until(B, () => mode === 'ride' && net.ride.craft === 'sea', null, 'aboard');
    await A.evaluate(() => { sea = null; mode = 'walk'; });
    await until(B, () => mode === 'walk', null, 'off when she is');
    // in her helicopter; out at 30m: with a parachute
    await A.evaluate(s => { const ac = aircraft.find(c => PLANE_TYPES[c.type].heli) || aircraft[0]; ac.x = worldCoord(s.x + 0.3); ac.y = s.y; ac.z = walkGround(ac.x, ac.y); px = ac.x; py = ac.y; enterAircraft(ac); }, spot);
    await B.evaluate(s => { mode = 'walk'; px = s.x; py = s.y; }, spot);
    await until(B, () => netCraftNear()?.k === 'air' && netCraftNear().stopped, null, 'by the aircraft, down on the ground');
    await B.evaluate(() => netCraftUse()); await until(B, () => mode === 'ride' && net.ride.craft === 'air', null, 'aboard the aircraft');
    assert.deepEqual(await B.evaluate(() => { net.ride.z = walkGround(px, py) + 3; netGetOut(); return [mode, !!chute, body.z > 20]; }), ['walk', true, true], 'out up there: falling, the cord to pull');
    await B.evaluate(() => { chute = null; body.z = 0; });
    await A.evaluate(() => { pilot.state = 'parked'; pilot = null; mode = 'walk'; });

    // a cab on Ann's shift: Bob rides, and pays the fare when he gets out
    await A.evaluate(s => { const c = cars.find(c => c.body === TAXI && !c.remote); startTaxiShift(c); c.x = worldCoord(s.x + 0.3); c.y = s.y; c.ex = c.x; c.ey = c.y; c.v = 0; px = c.x; py = c.y; money = 0; }, spot);
    await B.evaluate(s => { mode = 'walk'; px = s.x; py = s.y; money = 50; }, spot);
    await until(B, () => !!netCarNear() && !netCarNear().parked, null, 'the cab by Bob');
    await B.evaluate(() => netCarUse()); await until(B, () => mode === 'ride', null, 'in the cab');
    for (let k = 0; k < 6; k++) { await A.evaluate(() => { me.x = worldCoord(me.x + me.hx * 0.5); me.y = worldCoord(me.y + me.hy * 0.5); me.ex = me.x; me.ey = me.y; px = me.x; py = me.y; }); await B.waitForTimeout(250); }
    await B.waitForTimeout(500);
    await B.evaluate(() => netGetOut());
    await until(A, () => money > 0, null, 'Ann paid');
    assert.equal(await A.evaluate(() => money), await B.evaluate(() => Math.round((50 - money) * 100) / 100), 'what he paid, she got');
    for (const P of [A, B]) await P.evaluate(() => netLeave());
    await A.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
