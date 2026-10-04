'use strict';
// ASCII City: hunger, thirst and health (city/needs.js), run headless in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

test('food fills hunger and drink fills thirst; water is best for thirst, a meal is worth more than a snack', () => {
  const { ev } = loadCity();
  const j = e => JSON.parse(ev(`JSON.stringify(${e})`));
  const [burger, candy, water, beer, shake] = j("['burger', 'candy', 'water', 'beer', 'milkshake'].map(id => nourish(id, ITEMS[id]))");
  assert.ok(burger[0] > candy[0] && burger[1] === 0, 'a burger is a meal, and no drink');
  assert.ok(water[1] > beer[1] && water[0] === 0, 'water beats beer for thirst');
  assert.ok(shake[0] > 0 && shake[1] > 0, 'a milkshake counts for both');
  // eating every bite of a burger
  ev("needs.food = 10; needs.drink = 50; inv.length = 0; buy('burger'); held = 0; for (let k = 0; k < 4; k++) useHeld()");
  assert.ok(Math.abs(j('needs.food') - (10 + burger[0])) < 0.01 && j('needs.drink') === 50);
  assert.strictEqual(j('inv.length'), 0, 'all gone');
  // food heals a little; drink doesn't
  ev("needs.health = 50; buy('burger'); held = 0; for (let k = 0; k < 4; k++) useHeld()");
  assert.ok(Math.abs(j('needs.health') - (50 + burger[0] * j('FOOD_HEALS'))) < 0.01, 'a burger patches you up');
  ev("needs.health = 50; buy('water'); held = 0; for (let k = 0; k < 3; k++) useHeld()");
  assert.strictEqual(j('needs.health'), 50);
});

test('the meters run down in real time, thirst first; empty, your health goes; at nothing you pass out, at the wheel you hang on', () => {
  const { ev } = loadCity();
  const j = e => JSON.parse(ev(`JSON.stringify(${e})`));
  const run = (secs, canFaint = true) => ev(`(() => { let r = ''; for (let t = 0; t < ${secs}; t += 1) { const s = stepNeeds(1, ${canFaint}); if (s === 'faint') return 'faint'; if (s) r = s; } return r; })()`);
  ev('refillNeeds()');
  run(15 * 60);
  const [f, d] = j('[needs.food, needs.drink]');
  assert.ok(d < f && Math.abs(d - 50) < 1 && Math.abs(f - 62.5) < 1, `half an hour drains thirst, 40 minutes hunger (${f}, ${d})`);
  assert.strictEqual(j('needs.health'), 100);
  ev('needs.drink = 0; needs.food = 80; needs.health = 100');
  assert.match(run(60), /bone dry/, 'warned');
  assert.ok(j('needs.health') < 80, 'health draining');
  ev('needs.health = 100'); assert.notStrictEqual(run(10 * 60, false), 'faint', 'driving: no faint');
  assert.strictEqual(j('needs.health'), 1);
  assert.strictEqual(run(5), 'faint');
  ev('money = 90');
  assert.strictEqual(j('hospitalised()'), 90, 'the bill, or all you have');
  assert.deepStrictEqual(j('[money, needs.health, needs.drink >= 50]'), [0, 100, true]);
  // fed and watered, health comes back slowly
  ev('needs.food = needs.drink = 100; needs.health = 40'); run(60);
  assert.ok(j('needs.health') > 45 && j('needs.health') < 50);
});

test('falls: a storey is nothing, a few storeys hurt, a tall building is the hospital', () => {
  const { ev } = loadCity();
  assert.strictEqual(ev('fallHurt(3.5)'), 0);
  assert.ok(ev('fallHurt(12)') > 20 && ev('fallHurt(12)') < 50);
  assert.ok(ev('fallHurt(30)') >= 100);
});
