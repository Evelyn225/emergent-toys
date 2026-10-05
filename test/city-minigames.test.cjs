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
  // wait for a gap in the next lane, then hop: a careful player gets across, most games (each game its own seeded
  // traffic, so the city's random numbers don't shift it)
  let across = 0;
  for (let seed = 1; seed <= 10; seed++) {
    ev(`var q = ${seed * 977}, srnd = () => { q = q * 16807 % 2147483647; return q / 2147483647; }; var g = GAMES.crosser(srnd)`);
    const evs = play(ev, 120, `t => { const [x, y] = g.you(), l = g.lanes().find(o => o.y === y - 1);
      if (!l) return { upP: 1 };
      const safe = [0, 0.15, 0.3, 0.45].every(dt => { const off = (l.off + l.sp * dt) % l.gap; return ((x - off * l.dir) % l.gap + l.gap) % l.gap >= l.len; });
      return safe ? { upP: 1 } : {}; }`);
    if (evs.includes('score')) across++;
  }
  assert.ok(across >= 8, `got across in ${across} of 10`);
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

test('jailbreak: there is a way past the guards, and walking straight into the light gets you caught', () => {
  const { ev } = fresh();
  // the guards ignore you, so record their light at every tick, then search for a route to the door through it
  const found = ev(`(() => {
    const g = GAMES.jailbreak(), DT = 0.16, steps = Math.floor((g.state().limit - 1) / DT), lit = [], guard = [];
    const s0 = g.state(), W = g.W, solid = s0.solid, door = s0.door;
    for (let k = 0; k <= steps; k++) { const s = g.state(); lit.push(new Set(s.lit)); guard.push(s.guards.map(q => q.slice())); s.you[0] = 1; s.you[1] = 9; g.step(DT, {}); }
    let front = [[2, 9]], seen = new Set();
    for (let k = 1; k <= steps; k++) {
      const next = [];
      for (const [x, y] of front) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, c = ny * W + nx;
        if (solid.has(c) || lit[k].has(c) || guard[k].some(([gx, gy]) => Math.abs(gx - nx) + Math.abs(gy - ny) < 1.2)) continue;
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
  // throw whenever the guide is dead on a bottle: every ring rings one (the old game dropped rings on a random row)
  ev('var g = GAMES.ringtoss(() => 0.99)');
  const hits = ev(`(() => { let n = 0; for (let i = 0; i < 6000 && !g.over; i++) { const t = g.target(); n += g.step(1 / 120, { actP: !!(t && t.exact) }).filter(e => e === 'score').length; } return n; })()`);
  assert.strictEqual(hits, 6, 'six for six');
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

test('pachinko: balls fired land in pockets now and then (any column can be reached), and cashing out is 8 balls a ticket of what you won', () => {
  const { ev } = fresh();
  ev('var g = GAMES.pachinko(); g.score = 10000');
  const events = play(ev, 120, '() => ({ act: 1 })');
  assert.ok(events.includes('score') && events.includes('eat'), 'both kinds of pocket hit');
  // the house wins over time: across a handful of players (any one of them can come out ahead, it's that close)
  let left = 0;
  for (let s = 1; s <= 8; s++) {
    const { ev: e } = require('./helpers/load-city.cjs').loadCity(s);
    left += e('var g = GAMES.pachinko(); g.score = 10000; (() => { for (let t = 0; t < 120; t += 1 / 60) g.step(1 / 60, { act: 1 }); return g.score; })()');
  }
  assert.ok(left < 80000, `the house wins over time (${left})`);
  ev('var g = GAMES.pachinko()');
  assert.strictEqual(ev('g.reward()'), 0, 'the tray you paid for is no tickets: walking straight out wins nothing');
  ev('g.score = 80'); assert.strictEqual(ev('g.reward()'), 5, '40 balls up, 5 tickets');
  ev('g.score = 12'); assert.strictEqual(ev('g.reward()'), 0, 'down is nothing (not less than nothing)');
});

test('pachinko shows how each ball did (a +N in a pocket, an x where it drains, the reels\' verdict); the house keeps a cut, the jade dragon wins it back', () => {
  const { ev } = fresh();
  ev('var g = GAMES.pachinko(), seen = { win: 0, drain: 0, verdict: 0 }');
  ev('for (let t = 0; t < 40 && !g.over; t += 1 / 60) { g.step(1 / 60, { act: 1 }); for (const q of g.pops()) q.text === "x" ? seen.drain++ : seen.win++; if (g.verdict()) seen.verdict++; }');
  const seen = JSON.parse(ev('JSON.stringify(seen)'));
  assert.ok(seen.win && seen.drain && seen.verdict, JSON.stringify(seen));
  // aiming at the middle, over sixty trays (a jackpot or two swings a handful a lot): the house keeps a cut; carry the jade dragon and it's about even
  const ret = jade => {
    let fired = 0, back = 0;
    for (let s = 1; s <= 60; s++) {
      const { ev: e } = require('./helpers/load-city.cjs').loadCity(s);
      if (jade) e(`inv.push({ id: '${jade}', uses: 0 })`);
      e('var g = GAMES.pachinko()');
      const [f, end] = JSON.parse(e('JSON.stringify((() => { let n = 0; for (let t = 0; t < 400 && !g.over; t += 1 / 60) n += g.step(1 / 60, { act: 1 }).filter(x => x === "launch").length; for (let t = 0; t < 3; t += 1 / 60) g.step(1 / 60, {}); return [n, g.score]; })())'));
      fired += f; back += end - 40 + f;
    }
    return back / fired;
  };
  const plain = ret(''), dragon = ret('jadedragon');
  assert.ok(plain > 0.74 && plain < 0.94, `the house keeps a cut: returns ${plain.toFixed(2)} a ball`);
  assert.ok(dragon > 0.9 && dragon < 1.16, `with the jade dragon, about even: ${dragon.toFixed(2)} a ball`);
});

test('duck pond: dip the hook on a duck and up it comes with its tickets on the bottom; a miss costs nothing; three ducks a go', () => {
  const { ev, j } = fresh();
  ev('var g = GAMES.ducks()');
  const worths = j('g.ducks.map(d => d.worth)');
  assert.strictEqual(worths.length, 12);
  assert.ok(worths.every(v => [1, 2, 3, 5, 10, 25, 50].includes(v)), JSON.stringify(worths));
  // dip where nothing is: a splash, and you still have three hooks
  ev('(() => { for (let k = 0; k < 600 && g.under(); k++) g.step(1 / 60, {}); })()');
  const missed = play(ev, 0.5, '(t) => ({ actP: t < 0.02 })');
  assert.ok(missed.includes('miss'), missed.join());
  // three ducks: wait for one under the hook, dip, see its number, again
  let total = 0;
  for (let n = 0; n < 3; n++) {
    ev('(() => { for (let k = 0; k < 2000 && !g.under(); k++) g.step(1 / 60, {}); })()');
    const want = ev('g.under().worth');
    const evs = play(ev, 4, '(t) => ({ actP: t < 0.02 })');
    assert.ok(evs.includes('eat'), 'hooked one');
    total += want;
    assert.strictEqual(ev('g.score'), total, 'its tickets are the number on the bottom');
  }
  assert.strictEqual(ev('g.over'), true, 'three ducks and you are done');
  assert.strictEqual(ev('g.ducks.length'), 9);
  assert.strictEqual(ev('g.reward()'), total);
  // over many ponds: about four tickets a duck, now and then a gold one
  let golds = 0, sum = 0, n = 0;
  for (let s = 1; s <= 40; s++) { const { ev: e } = require('./helpers/load-city.cjs').loadCity(s); const ds = JSON.parse(e('JSON.stringify(GAMES.ducks().ducks)')); golds += ds.some(d => d.gold); for (const d of ds) if (!d.gold) { sum += d.worth; n++; } }
  assert.ok(sum / n > 3 && sum / n < 5.5, `a plain duck averages ${(sum / n).toFixed(2)} tickets`);
  assert.ok(golds > 8 && golds < 32, `a gold duck in ${golds} ponds of 40`);
});

test('balloon darts: the aim wanders; a dart pops the balloon it lands on (3 tickets, a star card behind it 15 more), misses stick in the cork; three darts', () => {
  const { ev, j } = fresh();
  ev('var g = GAMES.darts()');
  assert.strictEqual(ev('g.balloons.length'), 24);
  assert.ok(ev('g.balloons.filter(b => b.star).length') >= 1, 'a star or two behind them');
  const a0 = j('g.aim()'); ev('for (let k = 0; k < 40; k++) g.step(1 / 60, {})'); const a1 = j('g.aim()');
  assert.ok(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) > 0.05, 'the reticle won\'t keep still');
  // wait for a plain balloon under the reticle and throw: +3
  ev('(() => { for (let k = 0; k < 3000; k++) { const b = g.hitAt(...g.aim().map(Math.round)); if (b && !b.star) return; g.step(1 / 60, { left: (k / 240 | 0) % 2 === 0, right: (k / 240 | 0) % 2 === 1, up: (k / 700 | 0) % 2 === 0, down: (k / 700 | 0) % 2 === 1 }); } })()');
  let evs = play(ev, 1, '(t) => ({ actP: t < 0.02 })');
  assert.ok(evs.includes('score'), evs.join()); assert.strictEqual(ev('g.score'), 3);
  // a star: +18
  ev('(() => { for (let k = 0; k < 6000; k++) { const b = g.hitAt(...g.aim().map(Math.round)); if (b && b.star) return; g.step(1 / 60, { left: (k / 240 | 0) % 2 === 0, right: (k / 240 | 0) % 2 === 1, up: (k / 700 | 0) % 2 === 0, down: (k / 700 | 0) % 2 === 1 }); } })()');
  const before = ev('g.score');
  if (ev('!!(g.hitAt(...g.aim().map(Math.round)) || {}).star')) { evs = play(ev, 1, '(t) => ({ actP: t < 0.02 })'); assert.ok(evs.includes('clear')); assert.ok(ev('g.score') - before >= 18); }
  // the last dart, at nothing: into the cork, and that's the game
  ev('(() => { for (let k = 0; k < 6000 && g.hitAt(...g.aim().map(Math.round)); k++) g.step(1 / 60, { left: (k / 240 | 0) % 2 === 0, right: (k / 240 | 0) % 2 === 1, up: (k / 700 | 0) % 2 === 0, down: (k / 700 | 0) % 2 === 1 }); })()');
  if (!ev('g.over')) { evs = play(ev, 1, '(t) => ({ actP: t < 0.02 })'); assert.ok(evs.includes('end'), evs.join()); }
  assert.strictEqual(ev('g.over'), true);
  assert.strictEqual(ev('g.reward()'), ev('g.score'));
  // three of a colour is a sweep: +6 on top
  ev('var g = GAMES.darts(); for (const b of g.balloons) { b.col = RED; b.star = false; }');
  for (let n = 0; n < 3; n++) { ev('(() => { for (let k = 0; k < 6000 && !g.hitAt(...g.aim().map(Math.round)); k++) g.step(1 / 60, { left: (k / 240 | 0) % 2 === 0, right: (k / 240 | 0) % 2 === 1, up: (k / 700 | 0) % 2 === 0, down: (k / 700 | 0) % 2 === 1 }); })()'); play(ev, 1, '(t) => ({ actP: t < 0.02 })'); }
  assert.strictEqual(ev('g.score'), 3 * 3 + 6);
});

test('goldfish scooping: dip the net under a fish and lift, it\'s yours (tickets, and one in a bag); the paper wears through in the water', () => {
  const { ev, j } = fresh();
  ev('var g = GAMES.goldfish()');
  assert.strictEqual(ev('g.fish.length'), 11);
  // park the net over a fish, dip, lift
  ev('(() => { const f = g.fish[0]; for (const o of g.fish.slice(1)) { o.x = 3; o.y = 8; } for (let k = 0; k < 400; k++) { const [nx, ny] = g.net(); f.x = nx; f.y = ny; f.a = 0; if (Math.hypot(f.x - nx, f.y - ny) < 0.3) break; g.step(1 / 60, {}); } })()');
  ev('g.step(1 / 60, { act: 1 }); g.fish[0].x = g.net()[0]; g.fish[0].y = g.net()[1]');
  const evs = j('g.step(1 / 60, {})');
  assert.ok(evs.includes('score') || evs.includes('clear'), JSON.stringify(evs));
  assert.ok(ev('g.score') >= 2 && ev("g.prize") === 'goldfish', 'tickets, and a fish to take home');
  // hold it in the water, waving it about: the paper goes
  ev('for (let k = 0; k < 1200 && !g.over; k++) g.step(1 / 60, { act: 1, left: k % 60 < 30, right: k % 60 >= 30 })');
  assert.strictEqual(ev('g.over'), true, 'torn');
});

test('the fortune teller can promise a gold duck, and the next pond has one', () => {
  const { ev } = fresh();
  for (let k = 0; k < 5; k++) { ev('goldenDuckDue = true; var g = GAMES.ducks()'); assert.ok(ev('g.ducks.some(d => d.gold)')); assert.strictEqual(ev('goldenDuckDue'), false); }
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

test('mahjong: four sets and a pair wins, the waits are right, and a sensible player wins about as often as anyone', () => {
  const { ev } = fresh();
  assert.strictEqual(ev('mjWins([0,0,0, 1,2,3, 9,10,11, 20,20,20, 26,26])'), true, 'a pung, two runs, a pung, a pair');
  assert.strictEqual(ev('mjWins([0,1,2,3,4,5,6,7,8,9,10,11,12,13])'), false, 'no pair');
  assert.strictEqual(ev('mjWins([7,8,9, 0,0,0, 1,1,1, 2,2,2, 3,3])'), false, '8o 9o 1| is not a run (no wrapping across suits)');
  assert.deepStrictEqual(JSON.parse(ev('JSON.stringify(mjWaits([0,0,0, 1,2,3, 9,10,11, 20,20,20, 26]))')), [26]);
  const tally = {};
  for (let s = 1; s <= 60; s++) { // (each deal its own seeded shuffle, so the world's own random numbers don't shift it)
    const w = ev(`(() => { let q = ${s * 7919}; const rnd = () => { q = q + 0x6D2B79F5 | 0; let t = Math.imul(q ^ q >>> 15, 1 | q); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const g = GAMES.mahjong(rnd); for (let i = 0; i < 60 * 900 && !g.over; i++) { const st = g.state(); let k = {};
      if (st === 'you') k = mjWins(g.hands[0]) ? { upP: 1 } : g.cursor() === mjDiscard(g.hands[0], () => 0.5) ? { actP: 1 } : { rightP: 1 }; else if (st === 'claim') k = { upP: 1 };
      g.step(1 / 30, k); } return g.over ? g.result.winner : 'stuck'; })()`);
    tally[w] = (tally[w] || 0) + 1;
  }
  assert.ok(!tally.stuck, JSON.stringify(tally));
  const others = ((tally[1] || 0) + (tally[2] || 0) + (tally[3] || 0)) / 3;
  assert.ok((tally[0] || 0) >= others * 0.5, `you won ${tally[0]} of 60, each of the others about ${others.toFixed(1)} (${JSON.stringify(tally)})`);
  ev('var g = GAMES.mahjong(); g.result = { winner: 0 }');
  assert.strictEqual(ev('g.reward()'), 20, 'the pot');
});

test('the gardeners: leave the beds and they die; water the driest and pull the weeds and most of them live, for better pay', () => {
  const { ev } = fresh();
  ev('var g = GAMES.garden()');
  play(ev, 61);
  const idle = [ev('g.alive()'), ev('g.reward()')];
  assert.ok(ev('g.over'));
  assert.ok(idle[0] < 6, `left alone, ${idle[0]} of 18 survive`);
  ev('var g = GAMES.garden()');
  // walk the cursor to whichever bed needs it most (a weed, or the least water) and tend it
  play(ev, 61, `(() => { let tap = false; return () => {
    tap = !tap; if (!tap) return {};
    const b = g.beds, live = b.map((x, k) => [x, k]).filter(([x]) => !x.dead);
    const [, want] = live.reduce((m, p) => (p[0].weed ? -1 : p[0].w) < (m[0].weed ? -1 : m[0].w) ? p : m);
    const c = g.cursor(), cx = c % 6, cy = c / 6 | 0, wx = want % 6, wy = want / 6 | 0;
    return wx < cx ? { leftP: 1 } : wx > cx ? { rightP: 1 } : wy < cy ? { upP: 1 } : wy > cy ? { downP: 1 } : { actP: 1 };
  }; })()`);
  const good = [ev('g.alive()'), ev('g.reward()')];
  assert.ok(good[0] >= 12, `tended, ${good[0]} of 18 survive`);
  assert.ok(good[1] > idle[1] + 5 && good[1] < 40, `pay: ${good[1]} vs ${idle[1]} idle`);
});

test('jade: the shop sells a bangle and a dragon; carrying them adds a little luck, and luck tips the pachinko pockets your way', () => {
  const { ev, j } = fresh();
  assert.deepStrictEqual(j("stockFor('jade', 'JADE')"), ['jadebangle', 'jadedragon']);
  assert.strictEqual(ev('luck()'), 0);
  ev("inv.push({ id: 'jadebangle', uses: 0 })"); assert.strictEqual(ev('luck()'), 0.03);
  ev("inv.push({ id: 'jadedragon', uses: 0 })"); assert.ok(Math.abs(ev('luck()') - 0.11) < 1e-9);
  ev("inv.push({ id: 'plushcat', uses: 0 })"); assert.ok(Math.abs(ev('luck()') - 0.13) < 1e-9, 'the lucky cat adds a little');
  // with luck, more land in a pocket (over a few players: luck's a nudge, not a sure thing)
  const run = lucky => [3, 7, 11, 19].reduce((t, seed) => t + runOne(lucky, seed), 0);
  const runOne = (lucky, seed) => { const { ev: e } = require('./helpers/load-city.cjs').loadCity(seed);
    if (lucky) e("inv.push({ id: 'jadebangle', uses: 0 }, { id: 'jadedragon', uses: 0 })");
    e('var g = GAMES.pachinko(); g.score = 400');
    return e(`(() => { let pockets = 0; for (let t = 0; t < 120 && !g.over; t += 1 / 60) for (const v of g.step(1 / 60, { act: true, left: Math.sin(t) > 0, right: Math.sin(t) < 0 })) if (v === 'eat' || v === 'score') pockets++; return pockets; })()`); };
  assert.ok(run(true) > run(false), 'luck helps');
});

test('the stock market: prices wander but stay positive, only trade while it is open, buy and sell with a $1 fee', () => {
  const { ev, j } = fresh();
  ev('for (let k = 0; k < 2000; k++) marketTick()');
  assert.ok(j('STOCKS.every(s => s.price >= 1 && s.price < 100000 && s.hist.length === 48)'), 'sane prices');
  ev('dayNum = 5; tod = 12'); // a Saturday
  assert.deepStrictEqual(j("buyShares('DUMP', 1)")[0], false, 'closed at the weekend');
  ev('dayNum = 1; tod = 8'); assert.strictEqual(j("buyShares('DUMP', 1)")[0], false, 'closed before 9:30');
  ev("dayNum = 1; tod = 11; money = 1000; stockBy('DUMP').price = 20");
  assert.strictEqual(j("buyShares('DUMP', 10)")[0], true);
  assert.strictEqual(ev('money'), 1000 - 201, 'ten at $20, plus the fee');
  assert.strictEqual(j('shares.DUMP.n'), 10);
  ev("stockBy('DUMP').price = 25");
  assert.match(j("sellShares('DUMP', 4)")[1], /up \$20\.00/);
  assert.strictEqual(ev('money'), 799 + 99, 'four at $25, less the fee');
  assert.strictEqual(j('shares.DUMP.n'), 6);
  assert.strictEqual(j("sellShares('DUMP', 100)")[0], true, 'selling more than you have sells what you have');
  assert.strictEqual(ev('shares.DUMP === undefined'), true, 'none left');
  assert.strictEqual(j("buyShares('BYTE', 1000)")[0], false, "can't buy what you can't afford");
  // the clock: ticks while open, nothing overnight, a jump at the bell
  ev('dayNum = 1; tod = 10; MARKET.lastMin = null; stepMarket(); var t0 = MARKET.tick; tod = 11; stepMarket()');
  assert.strictEqual(ev('MARKET.tick - t0'), 12, 'an hour open: twelve ticks');
  ev('tod = 20; stepMarket(); var t1 = MARKET.tick; tod = 23; stepMarket()');
  assert.strictEqual(ev('MARKET.tick - t1'), 0, 'nothing at night');
});
