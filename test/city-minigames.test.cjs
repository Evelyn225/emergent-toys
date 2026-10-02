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
    const [hx, hy] = g.body()[0], [fx, fy] = food(), keys = {};
    if (fx > hx) keys.rightP = 1; else if (fx < hx) keys.leftP = 1; else if (fy > hy) keys.downP = 1; else keys.upP = 1;
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
