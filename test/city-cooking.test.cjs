'use strict';
// ASCII City: cooking (city/cooking.js). The pantry and the recipes, getting the makings out of your bag and the
// fridge, the pan itself (keep the heat in the green, flip and stir and add when it says), what you get, and what it
// does for you. Run headless in a vm. (The stove, the panel and the save: the browser test.)
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');
const j = (ev, expr) => JSON.parse(ev(`JSON.stringify(${expr})`)); // (arrays out of the vm aren't this realm's)

// play a recipe's pan: { careful } keeps the heat mid-band and makes every move on time; { hot } holds the flame full on;
// { lazy } keeps the heat right but never makes a move
function cook(ev, recipe, how = 'careful') {
  ev(`var g = GAMES.cook(Math.random, '', { recipe: '${recipe}' }), [lo, hi] = HOW[RECIPE['${recipe}'].how].band;
      for (let t = 0; t < 90 && !g.over; t += 1 / 30) { const s = g.state(), m = s.moves.find(m => m.state === 'now');
        const on = '${how}' === 'hot' || s.heat < (lo + hi) / 2, move = '${how}' === 'careful' && m && m.t > 0.25;
        g.step(1 / 30, { act: on ? 1 : 0, upP: move && m.key === 'up' ? 1 : 0, downP: move && m.key === 'down' ? 1 : 0 }); }`);
  return j(ev, '[g.result, g.score]');
}

test('the pantry and the recipes: every recipe needs real things you can buy, can be cooked somewhere, and makes real food', () => {
  const { ev } = loadCity();
  const bad = j(ev, `RECIPES.filter(r => !r.needs.every(n => n === 'fish' || ITEMS[n] && ITEMS[n].kind === 'ingredient') || !r.where.length || !r.where.every(w => STATION_NAME[w]) || !HOW[r.how] || ITEMS[r.id].kind !== 'food').map(r => r.id)`);
  assert.deepStrictEqual(bad, []);
  assert.ok(ev('RECIPES.length') >= 20, 'a proper list');
  for (const s of ['stove', 'grill', 'fire']) assert.ok(ev(`recipesAt('${s}').length`) >= 6, `plenty to make at the ${s}`);
  const unsold = j(ev, "Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'ingredient' && !Object.values(STOCK_WORD).some(s => s.includes(id)))");
  assert.deepStrictEqual(unsold, [], 'every ingredient is on a shelf somewhere');
  assert.ok(ev("stockFor('', 'GROCERY').includes('rawchicken') && stockFor('', 'MARKET').includes('tomatoes') && stockFor('', 'DELI').includes('cheese') && stockFor('', 'BODEGA').includes('eggs')"));
  assert.ok(ev("isFridgeItem({ id: 'butter' }) && isFridgeItem({ id: 'panfish' })"), 'the fridge keeps the pantry and what you cooked');
});

test('the pan: careful hands make it perfect; the flame full on burns it; never flipping or stirring spoils it', () => {
  const { ev } = loadCity();
  for (const r of ['panfish', 'bolognese', 'roastchicken', 'skewers', 'tomatosoup']) {
    assert.strictEqual(cook(ev, r, 'careful')[0], 'perfect', `${r}, done right`);
    assert.strictEqual(cook(ev, r, 'hot')[0], 'burnt', `${r}, scorched`);
    assert.notStrictEqual(cook(ev, r, 'lazy')[0], 'perfect', `${r}, never turned`);
  }
  ev("var g = GAMES.cook(Math.random, '', { recipe: 'bolognese' }); for (let t = 0; t < 1; t += 1 / 30) g.step(1 / 30, { act: 1 })");
  assert.ok(ev('g.state().heat') > 0.5, 'holding SPACE turns the heat up');
  ev("for (let t = 0; t < 1; t += 1 / 30) g.step(1 / 30, {})");
  assert.ok(ev('g.state().heat') < 0.4, 'letting go lets it fall');
  ev("var g2 = GAMES.cook(Math.random, '', { recipe: 'bolognese' }), fired = []; for (let t = 0; t < 6 && !g2.state().moves.some(m => m.state === 'now'); t += 1 / 30) fired.push(...g2.step(1 / 30, { act: g2.state().heat < 0.45 ? 1 : 0 }))");
  assert.match(ev("g2.state().moves.find(m => m.state === 'now').label"), /^ADD THE /, 'the extra things go in first, when it says');
});

test('dishing up: the makings come out of your bag and the fridge, the dish goes in your bag with the fish named in it', () => {
  const { ev } = loadCity();
  ev(`clearInventory(); carryItem({ id: 'mackerel', uses: 0, kg: 0.9 }); carryItem({ id: 'cod', uses: 0, kg: 6.4 }); var fridge = [{ id: 'butter', uses: 0 }, { id: 'eggs', uses: 0 }]`);
  assert.ok(ev("canMake(RECIPE.panfish, fridge) && !canMake(RECIPE.panfish, [])"), 'the butter is in the fridge');
  assert.ok(!ev("canMake(RECIPE.fishchips, fridge)"), 'no potatoes');
  assert.match(ev("serveDish(RECIPE.panfish, 'perfect', fridge)"), /^Perfect\. Pan-fried mackerel/);
  assert.deepStrictEqual(j(ev, 'inv.map(it => it.id)'), ['cod', 'panfish'], 'the first fish used, the butter gone');
  assert.deepStrictEqual(j(ev, 'fridge.map(it => it.id)'), ['eggs']);
  assert.deepStrictEqual(j(ev, 'inv[1]'), { id: 'panfish', uses: 3, q: 'perfect', of: 'mackerel' });
  ev("fridge.push({ id: 'butter', uses: 0 }); serveDish(RECIPE.panfish, 'fine', fridge)");
  assert.strictEqual(ev('inv[1].uses'), 6, 'a big cod goes further');
  assert.strictEqual(ev('dishName(inv[1])'), 'pan-fried cod');
  assert.match(ev("serveDish(RECIPE.panfish, 'fine', fridge)"), /nothing to cook/, 'and with nothing left, nothing happens');
  assert.ok(ev("!canMake(RECIPE.fishstick, []) || inv.every(it => ITEMS[it.id].kind !== 'wish')"));
  ev("clearInventory(); carryItem({ id: 'goldkoi', uses: 0, kg: 2 })");
  assert.ok(!ev('canMake(RECIPE.fishstick, [])'), 'the golden koi is not dinner');
});

test('eating it: perfect fills you more than burnt, and leaves you well fed (hungry and thirsty at half the pace) a while', () => {
  const { ev } = loadCity();
  const bite = q => ev(`needs.food = 20; clearInventory(); carryItem({ id: 'bolognese', uses: 5, q: '${q}' }); fx.fed = 0; useHeld({ indoors: true }); needs.food`);
  const perfect = bite('perfect'), fine = bite('fine'), burnt = bite('burnt');
  assert.ok(perfect > fine && fine > burnt, `${perfect} > ${fine} > ${burnt}`);
  ev(`needs.food = 20; clearInventory(); carryItem({ id: 'bolognese', uses: 5, q: 'perfect' }); fx.fed = 0; useHeld({ indoors: true })`);
  assert.ok(ev('fx.fed') > 500, 'well fed');
  ev('var f0 = needs.food; stepNeeds(60, true); var fedDrop = f0 - needs.food; fx.fed = 0; f0 = needs.food; stepNeeds(60, true); var plainDrop = f0 - needs.food');
  assert.ok(Math.abs(ev('fedDrop') * 2 - ev('plainDrop')) < 1e-6, 'half the pace');
  assert.match(ev("clearInventory(); carryItem({ id: 'toast', uses: 2, q: 'burnt' }); useHeld({ indoors: true })[0]"), /burnt|Black/);
  assert.match(ev("clearInventory(); carryItem({ id: 'onion', uses: 0 }); useHeld({ indoors: true })[0]"), /cook|pan/, 'you don\'t eat an onion like an apple');
});

test('somewhere to cook out of doors: two beach grills, one in a park, a campfire on Lighthouse Island, all on dry ground and solid', () => {
  const { ev } = loadCity();
  const spots = j(ev, "GRILLS.map(o => ({ on: o.on, dry: !isWater(o.x, o.y) && !map[idx(Math.floor(o.x), Math.floor(o.y))], solid: solidAt(o.x, o.y, 0), kind: blockKind(Math.floor(o.x / 8) & (NB - 1), Math.floor(o.y / 8) & (NB - 1)), isle: onIsland(o.x, o.y) }))");
  assert.deepStrictEqual(spots.map(s => s.on).sort(), ['fire', 'grill', 'grill', 'grill']);
  for (const s of spots) { assert.ok(s.dry, JSON.stringify(s)); assert.ok(s.solid, 'you walk round it, not through it'); }
  assert.ok(spots.find(s => s.on === 'fire').isle);
  assert.strictEqual(spots.filter(s => s.kind === 'waterfront').length, 2);
  assert.ok(spots.some(s => s.kind === 'park'));
});

