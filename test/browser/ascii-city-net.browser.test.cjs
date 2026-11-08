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
const URL_ = BASE + '&netfeatures=chat,clock'; // (both built, not yet released: switched on here)

test('two players: seen in the street, chat in a bubble, one clock, the same room, a car, and leaving', async () => {
  const browser = await chromium.launch();
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
    await keeper.evaluate(() => { tod = 20.5; weather = 'rain'; });
    const inStep = async () => { // the follower's time and sky match the keeper's (whose clock is still running)
      for (let k = 0; k < 60; k++) {
        const [kt, kw] = await keeper.evaluate(() => [tod, weather]), [ft, fw] = await follower.evaluate(() => [tod, weather]);
        if (Math.abs(kt - ft) < 0.1 && kw === fw && fw === 'rain') return;
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

test('as released: ghosts only. Each sees the other, but T is just T and each keeps their own clock', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1170, height: 720 } }), errors = [];
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE);
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
    await A.waitForTimeout(2500); // (longer than the clock's broadcast interval)
    assert.ok(Math.abs(await A.evaluate(() => tod) - 12) < 0.5, 'Ann keeps her own time');
    assert.equal(await B.evaluate(() => weather), 'rain', 'and Bob his own weather');
    await A.evaluate(() => { netLeave(); localStorage.clear(); }); await B.evaluate(() => netLeave());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
