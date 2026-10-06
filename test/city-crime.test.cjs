'use strict';
// ASCII City: crime and the police (city/crime.js) and the crime minigames, run headless in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

// a fresh city with you on a street corner; helpers to clear the scene and put a cop where you want one
function scene() {
  const { ev } = loadCity();
  ev(`mode = 'walk'; px = 5 * 8 + 1; py = 9 * 8 + 1; // the middle of an intersection, nothing in the way
      var far = () => { for (const p of people) { p.x = mod(px + 120, N); p.y = py; } for (const c of cars) if (c.patrol) { c.x = mod(px + 120, N); c.ex = c.x; } for (const c of footCops) { c.x = mod(px + 120, N); c.y = py; } };
      far()`);
  const step = (secs, dt = 0.05) => ev(`(() => { let r = ''; for (let t = 0; t < ${secs}; t += ${dt}) { T += ${dt}; r = stepCrime(${dt}) || r; } return r; })()`);
  return { ev, step };
}

test('nobody sees, nothing happens; police too far off, nothing either', () => {
  const { ev, step } = scene();
  assert.strictEqual(ev("crime('hit')"), '', 'no witnesses');
  assert.strictEqual(ev('wanted.stars'), 0);
  // a passer-by sees it, but there are no police anywhere near to send
  ev('people[0].x = px + 2; people[0].y = py; people[0].hidden = false');
  assert.strictEqual(ev("crime('crash')"), 'reported');
  step(8);
  assert.strictEqual(ev('wanted.stars'), 0, 'reported, but no unit within reach');
});

test('a cop who sees it: wanted at once, with units on the way; a passer-by calls it in a few seconds later', () => {
  const { ev, step } = scene();
  ev('footCops[0].x = px + 3; footCops[0].y = py; footCops[0].chase = false');
  assert.strictEqual(ev("crime('hit')"), 'cop');
  assert.strictEqual(ev('wanted.stars'), 2);
  assert.strictEqual(ev('cars.filter(c => c.pursuit).length'), 3, 'two stars, three cars');
  const { ev: e2, step: s2 } = scene();
  e2('people[0].x = px + 2; people[0].y = py; people[0].hidden = false; footCops[0].x = px + 30; footCops[0].y = py'); // a cop within reach, not in sight
  assert.strictEqual(e2("crime('steal')"), 'reported');
  assert.strictEqual(e2('wanted.stars'), 0, 'not yet');
  s2(6);
  assert.strictEqual(e2('wanted.stars'), 1, 'the call came in');
});

test('a red light only counts with a cop right there', () => {
  const { ev } = scene();
  assert.strictEqual(ev('redLightCrime(px, py)'), false);
  ev('footCops[0].x = px + 1.5; footCops[0].y = py');
  assert.strictEqual(ev('redLightCrime(px, py)'), true);
  assert.strictEqual(ev('wanted.stars'), 1);
});

test('out of sight long enough, and they give up', () => {
  const { ev, step } = scene();
  ev("addWanted('crash', px, py, true)"); // one star
  ev('for (const c of cars) if (c.pursuit) { c.x = mod(px + 100, N); c.ex = c.x; }'); // the units are far off
  ev('footCops.forEach(c => { c.x = mod(px + 120, N); })');
  ev("mode = 'room'; room = { ret: [px, py, 0], def: {}, kind: 'store' }"); // ducked into a shop: nobody can see you
  assert.strictEqual(step(ev('ESCAPE_T[1]') + 1), 'lost');
  assert.strictEqual(ev('wanted.stars'), 0);
  assert.strictEqual(ev('cars.some(c => c.pursuit)'), false, 'the cars stand down');
});

test('running from a cruiser: the officer who jumps out sprints you down, and if you outrun him the car drops another', () => {
  const { ev } = scene();
  ev("addWanted('crash', px, py, true); var cop = cars.find(c => c.pursuit); cop.x = px - 1; cop.y = py; cop.ex = cop.x; cop.ey = cop.y; cop.v = 0");
  // you run off down the road at a sprint (0.8 cells a second); the car stays where it is
  const run = secs => ev(`(() => { let r = ''; for (let t = 0; t < ${secs} && r !== 'busted'; t += 0.05) { T += 0.05; px = mod(px + 0.8 * 0.05, N); cop.x = px - 1; r = stepCrime(0.05) || r; } return r; })()`);
  assert.strictEqual(run(6), 'busted', 'the sprinting officer catches you');
  const { ev: e2 } = scene();
  e2("addWanted('crash', px, py, true); var cop = cars.find(c => c.pursuit); cop.x = px - 1; cop.y = py; cop.ex = cop.x; cop.ey = cop.y");
  e2('T += 0.05; stepCrime(0.05)');
  assert.strictEqual(e2('cop.drops'), 1);
  // the first officer gets left far behind (you're on a skateboard, say), the car keeps up and lets out another
  e2('for (let t = 0; t < 9; t += 0.05) { T += 0.05; px = mod(px + 1.6 * 0.05, N); cop.x = px - 1; stepCrime(0.05); }');
  assert.strictEqual(e2('cop.drops'), 2);
});

test('a cop on foot who reaches you: busted. The fine settles it; jail takes what you carry but not your money', () => {
  const { ev, step } = scene();
  ev("money = 500; buy('coffee'); buy('book'); addWanted('crash', px, py, true)");
  ev('footCops[0].x = px + 0.6; footCops[0].y = py; footCops[0].chase = true');
  assert.strictEqual(step(3), 'busted');
  assert.strictEqual(ev('payFine()'), true);
  assert.strictEqual(ev('money'), 500 - 3 - 12 - 50);
  assert.strictEqual(ev('wanted.stars'), 0);
  ev("addWanted('hit', px, py, true); goToJail()");
  assert.strictEqual(ev('inv.length'), 0, 'everything confiscated');
  assert.strictEqual(ev('money'), 435, 'money kept');
  assert.strictEqual(ev('wanted.stars'), 0);
});

test('the police on foot walk their beat along the sidewalks, never into buildings', () => {
  const { ev } = loadCity();
  ev('for (let k = 0; k < 4000; k++) { stepCrime(0.05); T += 0.05; }');
  assert.strictEqual(ev('footCops.filter(c => map[idx(Math.floor(c.x), Math.floor(c.y))]).length'), 0);
  assert.ok(ev('footCops.every(c => { const lx = mod(c.x, 8), ly = mod(c.y, 8); return lx < 2 || ly < 2; })'), 'on the streets');
});

test('crime minigames: stop the marker in the green to pick a pocket, set every pin to pick a lock', () => {
  const { ev } = loadCity();
  ev('var g = GAMES.pickpocket()');
  // press exactly when the marker's inside the zone (the game's own zone, read from its drawing)
  const won = ev(`(() => { for (let t = 0; t < 30 && !g.over; t += 1 / 120) { let z = []; let m = -1;
    g.draw((x, y, ch) => { if (y === 3 && ch === '=') z.push(x); if (y === 2 && ch === 'v') m = x; }, () => {});
    g.step(1 / 120, { actP: m >= Math.min(...z) + 1 && m <= Math.max(...z) - 1 }); } return g.success; })()`);
  assert.strictEqual(won, true);
  ev('var g = GAMES.pickpocket()');
  assert.strictEqual(ev('(() => { g.step(0.01, {}); g.draw(() => {}, () => {}); return g.step(0.01, { actP: 1 }).join(); })()').includes('die') || ev('g.success'), true, 'a wild grab gets you caught (or, rarely, lucky)');
  ev('var g = GAMES.lockpick()');
  assert.strictEqual(ev('(() => { for (let t = 0; t < 60 && !g.over; t += 1 / 60) { const s = g.state(); g.step(1 / 60, { up: s.h[s.cur] < s.shear[s.cur] - 0.02, actP: Math.abs(s.h[s.cur] - s.shear[s.cur]) < 0.03 }); } return g.success; })()'), true);
  ev('var g = GAMES.lockpick()');
  assert.strictEqual(ev('(() => { for (let t = 0; t < 60 && !g.over; t += 1 / 60) g.step(1 / 60, { up: 1 }); return g.success; })()'), false, 'shove it up and it slips');
});

test('a cop with your last seen entrance searches the room and arrests you in sight', () => {
  const { ev, step } = scene();
  ev("addWanted('hit', px, py, true)");
  ev("mode = 'room'; room = { ret: [px, py, 0], def: {}, kind: 'store', W: 5, H: 5, grid: ['#####', '#...#', '#...#', '#...#', '##D##'], props: [] }; px = 2.5; py = 2.8");
  // The browser's wall adapter, restricted to this fixture's empty floor / solid walls.
  ev("var ROOMW = { cell: (x, y) => room.grid[y]?.[x] === '.' ? 0 : 3 }");
  assert.strictEqual(step(2), 'busted');
  assert.ok(ev('roomCops.length') > 0, 'officers actually entered the room');
});

test('a cruiser on your bumper tells you to pull over without a phantom PIT', () => {
  const { ev, step } = scene();
  ev("addWanted('steal', px, py, true); var mine = cars.find(c => !c.patrol && !c.ev); mine.player = true; me = mine; mode = 'drive'; me.v = 2; me.x = px; me.y = py");
  ev('var cop = cars.find(c => c.pursuit); cop.x = me.x + 0.8; cop.y = me.y; cop.ex = cop.x; cop.ey = cop.y');
  const evs = ev(`(() => { const r = []; for (let k = 0; k < 100; k++) { T += 0.05; me.v = 2; cop.x = me.x + 0.8; cop.ex = cop.x; const w = stepCrime(0.05); if (w === 'pullover' || w === 'pit') r.push(w); if (w === 'pit') break; } return r.join(); })()`);
  assert.strictEqual(evs, 'pullover');
  assert.ok(!ev('me.spunT > T'), 'proximity alone cannot spin the car');
});
