'use strict';
// ASCII City: buying, carrying and using things (city/goods.js), run headless in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const fresh = () => { const { ev } = loadCity(); return { ev, j: e => JSON.parse(ev(`JSON.stringify(${e})`)) }; };

test('every shop and cart sells things that exist', () => {
  const { j } = fresh();
  const bad = j(`[...Object.values(STOCK_WORD), ...Object.values(STOCK_ROOM), ...Object.values(VENDOR_STOCK)].flat().filter(id => !ITEMS[id])`);
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
  ev("mode = 'walk'; px = 9 * 8 + 1; py = 10 * 8 + 4; buy('ball'); held = 1; useHeld({ indoors: false, x: px, y: py, a: Math.PI / 2 })");
  assert.ok(ev('!!ball'), 'kicked out into the street');
  assert.strictEqual(ev("inv.some(i => i.id === 'ball')"), false);
  ev('for (let k = 0; k < 400; k++) stepGoods(0.05)');
  const r = j('ball && { moved: Math.hypot(rel(ball.x - px), rel(ball.y - py)), v: Math.hypot(ball.vx, ball.vy), solid: map[idx(Math.floor(ball.x), Math.floor(ball.y))] }');
  assert.ok(r && r.moved > 0.5 && r.v < 0.05 && !r.solid, JSON.stringify(r));
  ev('px = ball.x; py = ball.y');
  assert.strictEqual(ev('pickUpBall()'), true);
  assert.strictEqual(ev("inv.some(i => i.id === 'ball')"), true);
});
