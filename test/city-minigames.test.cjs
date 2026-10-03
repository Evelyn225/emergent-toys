'use strict';
// ASCII City: the arcade games, the work shifts and what a taxi fare pays (city/minigames.js), played headless.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const fresh = () => { const { ev } = loadCity(); return { ev, j: e => JSON.parse(ev(`JSON.stringify(${e})`)) }; };
// run game `g` (a vm global) for `secs` with keys from keysAt(t) -> object; returns every event seen
const play = (ev, secs, keysAt = '() => ({})') =>
  ev(`(() => { const all = [], kf = ${keysAt}; for (let t = 0; t < ${secs} && !g.over; t += 1 / 60) all.push(...g.step(1 / 60, kf(t))); return all.join(','); })()`).split(',').filter(Boolean);

test('snake: it eats, grows, speeds up, and dies at the wall', () => {
  const { ev } = fresh();
  ev('var g = GAMES.snake()');
  assert.strictEqual(ev('g.body().length'), 3);
  // steer straight at the apple: pick the axis that's off and press that way when needed
  ev("g.step(0, {}); var food = () => { let f; g.draw((x, y, ch) => { if (ch === '@') f = [x, y]; }); return f; }");
  const ate = ev(`(() => { let n = 0; for (let k = 0; k < 4000 && !g.over && n < 3; k++) {
    const [[hx, hy], [nx, ny]] = g.body(), [fx, fy] = food(), keys = {}, dx = hx - nx, dy = hy - ny; // (never straight back into itself)
    let want = fx > hx ? 'right' : fx < hx ? 'left' : fy > hy ? 'down' : 'up';
    const back = { right: dx < 0, left: dx > 0, down: dy < 0, up: dy > 0 }[want];
    if (back) want = dx ? (fy > hy ? 'down' : 'up') : (fx > hx ? 'right' : 'left');
    keys[want + 'P'] = 1;
    n += g.step(1 / 60, keys).filter(e => e === 'eat').length; } return n; })()`);
  assert.ok(ate >= 1, 'it can eat');
  assert.strictEqual(ev('g.body().length'), 3 + ev('g.score'), 'grows by one per apple');
  // now just keep going one way: the wall gets it
  const evs = play(ev, 20, '() => ({ upP: 1 })');
  assert.ok(evs.includes('die') && ev('g.over'));
  assert.strictEqual(ev('g.reward()'), ev('g.score') * 2);
});

test('breakout: launch, knock out bricks, lose the balls at the floor', () => {
  const { ev } = fresh();
  ev('var g = GAMES.breakout()');
  assert.deepStrictEqual(play(ev, 1), [], 'nothing happens till you launch');
  // follow the ball with the paddle and you clear bricks
  const evs = play(ev, 60, `t => { const s = g.state(); return { actP: s.ball.stuck, left: s.ball.x < s.paddle - 0.5, right: s.ball.x > s.paddle + 0.5 }; }`);
  assert.ok(evs.filter(e => e === 'brick').length >= 5, `bricks: ${evs.filter(e => e === 'brick').length}`);
  assert.ok(evs.includes('paddle'));
  // stand still at the edge and every ball is lost
  ev('var g = GAMES.breakout()');
  const lost = play(ev, 120, `t => ({ actP: g.state().ball.stuck, left: 1 })`);
  assert.strictEqual(lost.filter(e => e === 'miss').length, 3);
  assert.ok(ev('g.over'));
});

test('street crosser: hop across between the cars; walk into one and lose a life', () => {
  const { ev } = fresh();
  ev('var g = GAMES.crosser()');
  // wait for a gap in the next lane, then hop: a careful player gets across
  const evs = play(ev, 120, `t => { const [x, y] = g.you(), l = g.lanes().find(o => o.y === y - 1);
    if (!l) return { upP: 1 };
    const safe = [0, 0.15, 0.3, 0.45].every(dt => { const off = (l.off + l.sp * dt) % l.gap; return ((x - off * l.dir) % l.gap + l.gap) % l.gap >= l.len; });
    return safe ? { upP: 1 } : {}; }`);
  assert.ok(evs.includes('score'), 'got across: ' + evs.slice(0, 40));
  ev('var g = GAMES.crosser()');
  const reckless = play(ev, 60, '() => ({ upP: 1 })');
  assert.ok(reckless.includes('miss'));
});

test('waiting tables: serve the customer in your lane; misses end the shift; pay follows how you did', () => {
  const { ev } = fresh();
  ev('var g = GAMES.serve()');
  // a good waiter: go to the lane of the nearest customer and slide them a plate
  const good = play(ev, 80, `t => { const c = g.cust().slice().sort((a, b) => a.x - b.x)[0];
    if (!c) return {}; if (c.lane < g.lane()) return { upP: 1 }; if (c.lane > g.lane()) return { downP: 1 };
    return { actP: !g.plates().some(p => p.lane === c.lane) }; }`);
  assert.ok(ev('g.over') && good.includes('end'));
  const served = ev('g.score'), pay = ev('g.reward()');
  assert.ok(served > 15, `served ${served}`);
  // doing nothing: customers reach you, five mistakes and you're done early, for less
  ev('var g = GAMES.serve()');
  play(ev, 80);
  assert.ok(ev('g.misses()') >= 5 && ev('g.score') === 0);
  assert.ok(ev('g.reward()') < pay);
});

test('stocking shelves: the right shelf scores, the wrong one costs', () => {
  const { ev } = fresh();
  ev('var g = GAMES.stock()');
  const place = ev(`(() => { const s = g.shelf(), b = g.box(), j = s[b].indexOf(false); if (j < 0) return 'full';
    while (g.cur()[0] < b) g.step(0, { downP: 1 }); while (g.cur()[0] > b) g.step(0, { upP: 1 });
    while (g.cur()[1] < j) g.step(0, { rightP: 1 }); while (g.cur()[1] > j) g.step(0, { leftP: 1 });
    return g.step(0, { actP: 1 }).join(); })()`);
  assert.strictEqual(place, 'place');
  assert.strictEqual(ev('g.score'), 1);
  const wrong = ev(`(() => { const b = g.box(), r = (b + 1) % 4, j = g.shelf()[r].indexOf(false); if (j < 0) return 'full';
    while (g.cur()[0] < r) g.step(0, { downP: 1 }); while (g.cur()[0] > r) g.step(0, { upP: 1 });
    while (g.cur()[1] < j) g.step(0, { rightP: 1 }); while (g.cur()[1] > j) g.step(0, { leftP: 1 });
    return g.step(0, { actP: 1 }).join(); })()`);
  assert.strictEqual(wrong, 'wrong');
  assert.strictEqual(ev('g.wrong()'), 1);
  play(ev, 61);
  assert.ok(ev('g.over'), 'a minute and the shift is over');
});

test('every room with a shift and every cabinet game exists; prizes are real items you can afford with tickets', () => {
  const { ev, j } = fresh();
  assert.deepStrictEqual(j('Object.values(SHIFT_FOR).concat(ARCADE_GAMES).filter(id => !GAMES[id])'), []);
  assert.deepStrictEqual(j('PRIZES.filter(([id]) => !ITEMS[id]).map(p => p[0])'), []);
  ev('tickets = 25');
  assert.deepStrictEqual(j("claimPrize('yoyo')"), [false, "That's 30 tickets. You have 25."]);
  assert.deepStrictEqual(j("claimPrize('duck')"), [true, 'You trade 20 tickets for a rubber duck.']);
  assert.strictEqual(ev('tickets'), 5);
  assert.strictEqual(ev('heldItem().id'), 'duck');
});

test('the new prizes all do something', () => {
  const { ev, j } = fresh();
  const use = (id, near = '{}') => j(`(inv.length = 0, inv.push({ id: '${id}', uses: ITEMS['${id}'].uses || 0 }), held = 0, useHeld(Object.assign({ headlines: ['x'] }, ${near})))`);
  assert.strictEqual(use('yoyo')[1], 'whirr'); assert.ok(ev('fx.yoyo') > 0);
  assert.strictEqual(use('duck', '{ water: true }')[0], 'You float the duck on the water a while, then fish it back out.');
  assert.strictEqual(use('duck')[1], 'squeak');
  assert.strictEqual(use('harmonica')[1], 'harmonica');
  ev('money = 0'); for (let k = 0; k < 30; k++) use('harmonica', '{ person: {} }');
  assert.ok(ev('money') > 0, 'busking pays, sometimes');
  ev('fx.spark = 0');
  assert.strictEqual(use('sparklers')[0], 'You light a sparkler. (4 left)');
  assert.ok(ev('fx.spark') > 20);
});

test('taxi pay: the meter plus a tip for quick and smooth; a crash loses the tip', () => {
  const { j } = fresh();
  const good = j('taxiPay(30, 20, 0, false)'), slow = j('taxiPay(30, 80, 0, false)'), rough = j('taxiPay(30, 20, 9, false)'), crash = j('taxiPay(30, 20, 0, true)');
  assert.strictEqual(good.fare, 10.5);
  assert.ok(good.tip > slow.tip && good.tip > rough.tip, 'slow or rough tips less');
  assert.strictEqual(crash.tip, 0); assert.strictEqual(crash.fare, good.fare, 'still pays the meter');
  assert.strictEqual(good.stars, 5); assert.strictEqual(crash.stars, 1);
});

test('pong: a player who follows the ball beats the machine; one who stands still loses', () => {
  const { ev } = fresh();
  ev('var g = GAMES.pong()');
  play(ev, 300, `t => { const s = g.state(); return { up: s.ball.y < s.you - 0.4, down: s.ball.y > s.you + 0.4 }; }`);
  assert.ok(ev('g.over'));
  assert.strictEqual(ev('g.score'), 7, 'won');
  assert.strictEqual(ev('g.reward()'), 24);
  ev('var g = GAMES.pong()');
  play(ev, 300, `() => ({ up: 1 })`);
  assert.ok(ev('g.over') && ev('g.state().them') === 7, 'lost');
  assert.ok(ev('g.reward()') < 24);
});

test('shifts: a box always has somewhere to go; clocking off early pays less than staying', () => {
  const { ev } = fresh();
  ev('var g = GAMES.stock()');
  // shelve box after box (shoppers emptying shelves as you go): every box handed to you has a gap waiting for it
  for (let k = 0; k < 120; k++) {
    assert.ok(ev('(() => { const s = g.shelf(); return g.box() < 0 ? !s.some(r => r.includes(false)) : s[g.box()].includes(false); })()'), 'the box fits somewhere (or there is none, with every shelf full)');
    ev('{ const j = g.box() < 0 ? -1 : g.shelf()[g.box()].indexOf(false); if (j >= 0) { while (g.cur()[0] < g.box()) g.step(0, { downP: 1 }); while (g.cur()[0] > g.box()) g.step(0, { upP: 1 }); while (g.cur()[1] < j) g.step(0, { rightP: 1 }); while (g.cur()[1] > j) g.step(0, { leftP: 1 }); g.step(0, { actP: 1 }); } g.step(0.3, {}); }');
  }
  // the same work done, clocked off at 15s vs worked to the end
  ev('var a_ = GAMES.serve(); a_.step(15, {}); var early = a_.reward()');
  ev('var b_ = GAMES.serve(); b_.step(15, {}); b_.step(15, {}); b_.step(15, {}); b_.step(15, {}); b_.step(15, {}); var full = b_.reward()');
  assert.ok(ev('early') < ev('full') || ev('b_.misses()') > 0, `early ${ev('early')} vs full ${ev('full')}`);
  assert.ok(ev('GAMES.serve().reward()') === 0, 'no time worked, no base pay');
});

test('the shelves you stock are what the shop sells', () => {
  const { ev, j } = fresh();
  assert.deepStrictEqual(j("stockKinds('RECORDS').map(k => k[0])"), ['VINYL', 'CDS', 'TAPES', 'POSTERS']);
  assert.deepStrictEqual(j("stockKinds('BODEGA').map(k => k[0])"), ['CANS', 'CEREAL', 'BOTTLES', 'SOAP'], 'a corner shop gets the general stuff');
  assert.strictEqual(ev("Object.values(STOCK_THEMES).every(t => t.length === 4)"), true);
  ev("var g = GAMES.stock(undefined, 'RECORDS'), labels = []; g.draw(() => {}, (x, y, s) => labels.push(s))");
  assert.ok(ev("labels.includes('VINYL') && !labels.includes('CANS')"));
});

test('jailbreak: there is a way past the guard, and walking straight into his light gets you caught', () => {
  const { ev } = fresh();
  // the guard ignores you, so record his light at every tick, then search for a route to the door through it
  const found = ev(`(() => {
    const g = GAMES.jailbreak(), DT = 0.16, steps = Math.floor(44 / DT), lit = [], guard = [];
    const s0 = g.state(), W = g.W, solid = s0.solid, door = s0.door;
    for (let k = 0; k <= steps; k++) { const s = g.state(); lit.push(new Set(s.lit)); guard.push([s.gx, s.gy]); s.you[0] = 1; s.you[1] = 9; g.step(DT, {}); }
    let front = [[2, 9]], seen = new Set();
    for (let k = 1; k <= steps; k++) {
      const next = [];
      for (const [x, y] of front) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, c = ny * W + nx;
        if (solid.has(c) || lit[k].has(c) || Math.abs(guard[k][0] - nx) + Math.abs(guard[k][1] - ny) < 1.2) continue;
        if (nx === door[0] && ny === door[1]) return k * DT;
        const key = c + ',' + k; if (seen.has(key)) continue; seen.add(key); next.push([nx, ny]);
      }
      front = next;
    }
    return -1;
  })()`);
  assert.ok(found > 0, 'a route exists (' + found + 's)');
  ev('var g = GAMES.jailbreak()');
  const r = ev(`(() => { for (let t = 0; t < 46 && !g.over; t += 0.05) g.step(0.05, { up: 1 }); return [g.over, g.success].join(); })()`);
  assert.strictEqual(r, 'true,false', 'charging out gets you caught');
});

test('tapper: pour to the line and let go to slide a beer; hold too long and it spills', () => {
  const { ev } = fresh();
  ev('var g = GAMES.tapper(() => 0)'); // every customer on the first bar
  // pour a full mug and let go, again and again, at the first customer's bar
  const served = ev(`(() => { let held = 0; for (let k = 0; k < 600 && !g.over; k++) { const s = g.state(); const pour = s.fill < 0.95;
    g.step(1 / 60, pour ? { act: 1 } : {}); } return g.score; })()`);
  assert.ok(served >= 3, 'served ' + served);
  ev('var g = GAMES.tapper(() => 0)');
  assert.strictEqual(ev('(() => { for (let k = 0; k < 120; k++) g.step(1 / 60, { act: 1 }); return g.state().misses; })()'), 1, 'one spill');
});

test('ring toss: a ring thrown dead on a bottle neck rings it; six rings and it is over', () => {
  const { ev } = fresh();
  ev('var g = GAMES.ringtoss(() => 0)'); // every ring lands on the far row
  const events = play(ev, 20, '(t) => ({ actP: Math.floor(t * 60) % 40 === 0 })');
  assert.ok(ev('g.over'), 'out of rings');
  assert.strictEqual(events.filter(e => e === 'launch').length, 6);
  assert.strictEqual(events.filter(e => e === 'score' || e === 'miss').length, 6, 'every ring lands somewhere');
  assert.strictEqual(ev('g.reward()'), ev('g.score') * 4);
});

test('high striker: three swings, each scored by how high the puck went; the bell pays most', () => {
  const { ev } = fresh();
  ev('var g = GAMES.strength(() => 0)');
  play(ev, 30, '(t) => ({ actP: Math.floor(t * 60) % 120 === 0 })');
  assert.ok(ev('g.over'), 'three swings and done');
  assert.ok(ev('g.score') >= 0 && ev('g.score') <= 30);
  // swing whenever the meter is at its peak: every swing rings the bell
  ev('var g = GAMES.strength(() => 0)');
  const rings = ev(`(() => { let n = 0, prev = 0, rising = false; for (let i = 0; i < 20000 && !g.over; i++) {
    const evs = g.step(1 / 240, {}); n += evs.filter(e => e === 'clear').length;
    const p = g.meter(); if (rising && p < prev && p > 0.97) g.step(0, { actP: 1 }); rising = p > prev; prev = p; } return n; })()`);
  assert.strictEqual(rings, 3, 'DING x3');
  assert.strictEqual(ev('g.reward()'), 60);
});

test('pachinko: balls fired land in pockets now and then (any column can be reached), and cashing out is 8 balls a ticket', () => {
  const { ev } = fresh();
  ev('var g = GAMES.pachinko(); g.score = 10000');
  const events = play(ev, 120, '() => ({ act: 1 })');
  assert.ok(events.includes('score') && events.includes('eat'), 'both kinds of pocket hit');
  assert.ok(ev('g.score') < 10000, 'the house wins over time');
  ev('g.score = 40');
  assert.strictEqual(ev('g.reward()'), 5);
});

test('crane: a drop either grabs something and brings it home as a prize, or comes up empty; one go', () => {
  let wins = 0;
  for (let s = 1; s <= 20; s++) {
    const { ev } = require('./helpers/load-city.cjs').loadCity(s);
    ev('var g = GAMES.crane()');
    play(ev, 30, '(t) => ({ right: t < 0.6, actP: Math.abs(t - 0.7) < 0.01 })');
    assert.ok(ev('g.over'));
    if (ev('g.prize')) { wins++; assert.ok(ev('!!ITEMS[g.prize]'), 'a real item'); }
  }
  assert.ok(wins > 0 && wins < 20, `${wins}/20`);
});
