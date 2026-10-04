'use strict';
// ASCII City: buying, carrying and using things (city/goods.js), run headless in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const fresh = () => { const { ev } = loadCity(); return { ev, j: e => JSON.parse(ev(`JSON.stringify(${e})`)) }; };

test('every shop and cart sells things that exist', () => {
  const { j } = fresh();
  const bad = j(`[...Object.values(STOCK_WORD), ...Object.values(STOCK_ROOM), ...Object.values(VENDOR_STOCK), ...Object.values(VENDING).map(v => v.stock)].flat().filter(id => !ITEMS[id])`);
  assert.deepStrictEqual(bad, []);
  assert.deepStrictEqual(j("stockFor('store', 'LIQUOR')"), ['beer', 'whiskey', 'cigarettes', 'chips']);
  assert.deepStrictEqual(j("stockFor('bar', 'BAR')"), ['beer', 'whiskey', 'cocktail'], 'a bar with no word list of its own');
  assert.deepStrictEqual(j("stockFor('petshop', 'PET SHOP')"), [], 'not everywhere sells something');
  assert.ok(j("VENDOR_STOCK['HOT DOGS'].includes('hotdog')"));
});

test('buying: start with $100, pay the price, 8 things at most', () => {
  const { ev, j } = fresh();
  assert.strictEqual(ev('money'), 100);
  assert.deepStrictEqual(j("buy('coffee')"), [true, 'You buy a coffee. ($3.00)']);
  assert.strictEqual(ev('money'), 97);
  assert.strictEqual(ev('inv.length'), 1);
  assert.strictEqual(j("buy('skateboard')")[0], true);
  assert.strictEqual(j("buy('skateboard')")[0], false, "can't afford a second");
  for (let k = 0; k < 6; k++) ev("buy('water')");
  assert.deepStrictEqual(j("buy('water')"), [false, 'Your hands are full.']);
  assert.strictEqual(ev('inv.length'), 8);
});

test('food and drink: used up in bites and sips, with effects that wear off', () => {
  const { ev, j } = fresh();
  ev("buy('coffee'); held = 0");
  const near = "{ indoors: false, x: px, y: py, a: 0, rain: 0, person: null, headlines: ['X'] }";
  for (let k = 0; k < 3; k++) assert.match(j(`useHeld(${near})`)[0], /sip/);
  assert.match(j(`useHeld(${near})`)[0], /finish/);
  assert.strictEqual(ev('inv.length'), 0);
  assert.ok(ev('fx.caffeine') > 0 && ev('footSpeed()') > 1, 'caffeinated: faster');
  ev("buy('whiskey'); useHeld(" + near + "); useHeld(" + near + ")");
  assert.ok(ev('fx.booze') > 0.3, 'whiskey goes to your head');
  ev('for (let k = 0; k < 5000; k++) stepGoods(0.1)');
  assert.strictEqual(ev('fx.caffeine'), 0);
  assert.strictEqual(ev('fx.booze'), 0);
});

test('cigarettes: light one, take drags, five in a pack', () => {
  const { ev, j } = fresh();
  ev("buy('cigarettes')");
  const near = "{ indoors: false, x: px, y: py, a: 0, rain: 0, person: null, headlines: ['X'] }";
  assert.match(j(`useHeld(${near})`)[0], /light a cigarette. \(4 left\)/);
  assert.ok(ev('fx.smoke') > 0);
  assert.match(j(`useHeld(${near})`)[0], /drag/);
  ev('for (let k = 0; k < 500; k++) stepGoods(0.1)');
  assert.strictEqual(ev('fx.smoke'), 0, 'burned down');
});

test('the skateboard only rolls outside; the ball rolls, stops, and comes back', () => {
  const { ev, j } = fresh();
  ev("buy('skateboard')");
  assert.match(j("useHeld({ indoors: true })")[0], /Not in here/);
  ev("useHeld({ indoors: false })");
  assert.strictEqual(ev('fx.skating && footSpeed() > 1.5'), true);
  ev("mode = 'walk'; px = 12 * 8 + 1; py = 10 * 8 + 4; buy('ball'); held = 1; useHeld({ indoors: false, x: px, y: py, a: Math.PI / 2 })");
  assert.ok(ev('!!ball'), 'kicked out into the street');
  assert.strictEqual(ev("inv.some(i => i.id === 'ball')"), false);
  ev('for (let k = 0; k < 400; k++) stepGoods(0.05)');
  const r = j('ball && { moved: Math.hypot(rel(ball.x - px), rel(ball.y - py)), v: Math.hypot(ball.vx, ball.vy), solid: map[idx(Math.floor(ball.x), Math.floor(ball.y))] }');
  assert.ok(r && r.moved > 0.5 && r.v < 0.05 && !r.solid, JSON.stringify(r));
  ev('px = ball.x; py = ball.y');
  assert.strictEqual(ev('pickUpBall()'), true);
  assert.strictEqual(ev("inv.some(i => i.id === 'ball')"), true);
});

test('the ball bounces off fences, containers and lamp posts as well as buildings, and never starts inside a wall', () => {
  const { ev, j } = fresh();
  // straight at a thin fence (a construction site's hoarding), hard: it comes back off it
  const r = j(`(() => {
    const f = solids.find(o => o.kind === 'hoarding' && o.c === 1); // along x: kick across it, in y
    mode = 'walk'; const side = Math.sign(rel(py - f.y)) || 1; px = f.x; py = mod(f.y + 0.3, N);
    kickBall(px, py, -Math.PI / 2, 4); for (let k = 0; k < 200; k++) stepBall(0.05);
    const throughFence = rel(ball.y - f.y) < 0;
    const l = lamps[40]; px = mod(l.x - 0.3, N); py = l.y; kickBall(px, py, 0, 4); for (let k = 0; k < 6; k++) stepBall(0.05);
    const throughLamp = rel(ball.x - l.x) > 0.05 && Math.abs(rel(ball.y - l.y)) < 0.02;
    // against a wall, facing it: the ball stays on your side
    let wx = 0, wy = 0; for (let k = 0; k < N * N; k++) { const x = k % N, y = k / N | 0; if (map[k] > 0.5 && !map[idx(x, y + 1)] && !map[idx(x, y + 2)]) { wx = x + 0.5; wy = y + 1.06; break; } }
    px = wx; py = wy; kickBall(px, py, -Math.PI / 2); const inWall = map[idx(Math.floor(ball.x), Math.floor(ball.y))] > 0;
    for (let k = 0; k < 100; k++) stepBall(0.05);
    return { throughFence, throughLamp, inWall, after: map[idx(Math.floor(ball.x), Math.floor(ball.y))] > 0 };
  })()`);
  assert.deepStrictEqual(r, { throughFence: false, throughLamp: false, inWall: false, after: false });
});

test('storage: put things in your unit and take them out again; one unit, limited room', () => {
  const { ev, j } = fresh();
  ev("money = 500; buy('skateboard'); buy('beer'); buy('book'); held = 1");
  assert.deepStrictEqual(j('storeSlot(0)'), [true, 'You put the skateboard in your unit.']);
  assert.deepStrictEqual(j('inv.map(i => i.id)'), ['beer', 'book']);
  assert.strictEqual(ev('ITEMS[heldItem().id].name'), 'beer', 'still holding the same thing');
  assert.deepStrictEqual(j('stored.map(i => i.id)'), ['skateboard']);
  ev('inv[0].uses = 2; storeSlot(0)');
  assert.strictEqual(ev("stored.find(i => i.id === 'beer').uses"), 2, 'a half-drunk beer stays half drunk');
  assert.deepStrictEqual(j('retrieveSlot(0)'), [true, 'You take the skateboard out of your unit.']);
  assert.deepStrictEqual(j('storeSlot(5)'), [false, 'Nothing there.']);
  for (let k = 0; k < 7; k++) ev("buy('water')");
  assert.deepStrictEqual(j('retrieveSlot(0)'), [false, 'Your hands are full.']);
  assert.deepStrictEqual(j("stockFor('storage', 'STORAGE')"), [], 'storage sells nothing: it keeps your things');
});

test('pawn shops buy your gear back for 40%, but not food; you keep holding what you held', () => {
  const { ev, j } = fresh();
  ev("money = 200; buy('skateboard'); buy('sandwich'); buy('newspaper'); held = 1");
  assert.deepStrictEqual(j('sellSlot(0, SELL_RATE.PAWN)'), [true, 'You sell the skateboard for $24.00.']);
  assert.strictEqual(ev('money'), 200 - 60 - 7 - 1 + 24);
  assert.strictEqual(ev('ITEMS[heldItem().id].name'), 'sandwich', 'still holding the sandwich');
  assert.deepStrictEqual(j('sellSlot(0, SELL_RATE.PAWN)'), [false, `"We don't take sandwich."`]);
  assert.strictEqual(ev("sellPrice({ id: 'newspaper' }, SELL_RATE.PAWN)"), 0.5, 'rounded to the quarter');
  assert.deepStrictEqual(j('sellSlot(4, SELL_RATE.PAWN)'), [false, 'Nothing there.']);
  assert.strictEqual(ev('SELL_RATE.BODEGA'), undefined, 'only pawn shops buy');
});

test('vending machines: drinks, snacks and cigarettes on the sidewalk, backed by a wall, facing the street, solid', () => {
  const { ev, j } = fresh();
  const kinds = j('machines.reduce((o, m) => (o[m.kind] = (o[m.kind] || 0) + 1, o), {})');
  for (const k of ['DRINKS', 'SNACKS', 'CIGARETTES']) assert.ok(kinds[k] > 30, `plenty of ${k} machines (${kinds[k]})`);
  const bad = j(`machines.filter(m => {
    const fx = -m.s * m.fs, fy = m.c * m.fs; // the way it faces
    return map[idx(m.x, m.y)] || !map[idx(m.x - fx * 0.1, m.y - fy * 0.1)] || map[idx(m.x + fx * 0.3, m.y + fy * 0.3)]
      || !machineAt(m.x, m.y, 0) || machineAt(m.x + fx * 0.2, m.y + fy * 0.2, 0.02)
      || stations.some(t => Math.hypot(rel(t.x - m.x), t.y - m.y) < 0.7);
  }).length`);
  assert.strictEqual(bad, 0, 'on open ground, a wall behind, the street in front, clear of subway stairs');
  assert.deepStrictEqual(j('VENDING.CIGARETTES.stock'), ['cigarettes']);
});

test('things you put down stay where they are, as they were, till you pick them up', () => {
  const { ev, j } = fresh();
  ev("money = 100; buy('burger'); inv[0].uses = 2; buy('coffee'); held = 0");
  assert.strictEqual(ev("dropHeldAt(10, 20, '')"), 'burger');
  ev("held = 0; dropHeldAt(3, 4, 'room:5,5')");
  assert.deepStrictEqual(j('inv'), []);
  assert.strictEqual(ev("droppedNear(10.1, 20, 'room:5,5', 0.2)"), null, 'the room and the street are different places');
  assert.strictEqual(ev("droppedNear(3.5, 4, 'room:5,5', 1).id"), 'coffee');
  assert.deepStrictEqual(j("pickUpDropped(droppedNear(10.1, 20, '', 0.2))"), [true, 'You pick up the burger.']);
  assert.deepStrictEqual(j('inv'), [{ id: 'burger', uses: 2 }], 'still half eaten');
  assert.strictEqual(ev('dropped.length'), 1);
  ev("for (let k = 0; k < 7; k++) buy('water')");
  assert.deepStrictEqual(j("pickUpDropped(dropped[0])"), [false, 'Your hands are full.']);
});

test('you can hold nothing: pick the same slot again, and nothing is in your hand', () => {
  const { ev } = fresh();
  ev("money = 50; buy('coffee'); buy('book')");
  assert.strictEqual(ev('held'), 1);
  ev('holdSlot(1)');
  assert.strictEqual(ev('heldItem()'), null, 'put away');
  assert.strictEqual(ev("useHeld({})[0]"), 'Your hands are empty.');
  ev('storeSlot(0)');
  assert.strictEqual(ev('held'), -1, 'stays empty-handed when something else is put away');
  ev('holdSlot(0)');
  assert.strictEqual(ev('heldItem().id'), 'book');
});

test('the boombox: a random tape when you switch it on, B steps through them in order', () => {
  const { ev } = fresh();
  ev("money = 100; buy('boombox')");
  ev('useHeld({})');
  assert.strictEqual(ev('fx.boombox && BOOMBOX_SONGS.includes(fx.song)'), true);
  const seen = new Set();
  for (let k = 0; k < 4; k++) seen.add(ev('nextSong()'));
  assert.strictEqual(seen.size, 4, 'every tape comes round');
  const before = ev('fx.song'); ev('nextSong(); nextSong(); nextSong(); nextSong()');
  assert.strictEqual(ev('fx.song'), before, 'once round and you are back where you started');
});

test('property: a car from the lot is parked on the street outside, yours, and stays put; a home is the nearest apartment building', () => {
  const { ev } = loadCity();
  ev("money = 10000; mode = 'walk'; px = 5 * 8 + 2.1; py = 9 * 8 + 4");
  assert.strictEqual(ev("buy('car_sports')[0]"), true);
  const c = ev('(() => { const c = owned.cars[0]; return { road: ROAD[idx(Math.floor(c.x), Math.floor(c.y))], owned: c.owned, parked: c.parked, d: Math.hypot(rel(c.x - px), rel(c.y - py)) }; })()');
  assert.ok(c.road === 1 || c.road === 2, 'on a street');
  assert.ok(c.owned && c.parked && c.d < 2, JSON.stringify(c));
  ev('var at = [owned.cars[0].x, owned.cars[0].y]; px += 100; for (let k = 0; k < 200; k++) stepTraffic(0.05, T += 0.05)');
  assert.ok(ev('owned.cars[0].x === at[0] && owned.cars[0].y === at[1] && owned.cars[0].parked'), 'nobody takes it, however far you go');
  ev('px -= 100');
  assert.strictEqual(ev("money"), 6000);
  assert.strictEqual(ev("buy('home_studio')[0]"), true);
  assert.strictEqual(ev('SHOP[owned.homes[0].cell].kind === SHOP_APTS'), true);
  assert.strictEqual(ev("buy('home_loft')[0] && owned.homes[1].cell !== owned.homes[0].cell"), false, "can't afford a loft now (and it would be a different building)");
  assert.strictEqual(ev("buy('car_hatch')[0] && money"), 3050, 'a second car, for what was left');
  assert.strictEqual(ev("buy('car_sports')[1]"), "Sports car is $4000.00. You can't afford it.");
});
