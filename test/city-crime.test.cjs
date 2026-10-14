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
  assert.notStrictEqual(step(1), 'busted', 'officers cannot grab you on the first frame inside');
  assert.equal(ev('roomCops.length'), 0, 'officers are still coming through the entrance');
  assert.strictEqual(step(3), 'busted');
  assert.ok(ev('roomCops.length') > 0, 'officers actually entered the room');
});

test('settling a pursuit cancels officers who have not entered the room yet', () => {
  const { ev, step } = scene();
  ev("addWanted('hit', px, py, true); mode='room'; room={ret:[px,py,0],def:{},kind:'store',W:5,H:5,grid:['#####','#...#','#...#','#...#','##D##'],props:[]};px=2.5;py=2.8;var ROOMW={cell:(x,y)=>room.grid[y]?.[x]==='.'?0:3}");
  step(.1);
  assert.ok(ev('roomLead'));
  ev('clearWanted()');
  step(4);
  assert.equal(ev('roomCops.length'), 0);
  assert.equal(ev('roomLead'), null);
});

test('a cruiser on your bumper tells you to pull over without a phantom PIT', () => {
  const { ev, step } = scene();
  ev("addWanted('steal', px, py, true); var mine = cars.find(c => !c.patrol && !c.ev); mine.player = true; me = mine; mode = 'drive'; me.v = 2; me.x = px; me.y = py");
  ev('var cop = cars.find(c => c.pursuit); cop.x = me.x + 0.8; cop.y = me.y; cop.ex = cop.x; cop.ey = cop.y');
  const evs = ev(`(() => { const r = []; for (let k = 0; k < 100; k++) { T += 0.05; me.v = 2; cop.x = me.x + 0.8; cop.ex = cop.x; const w = stepCrime(0.05); if (w === 'pullover' || w === 'pit') r.push(w); if (w === 'pit') break; } return r.join(); })()`);
  assert.strictEqual(evs, 'pullover');
  assert.ok(!ev('me.spunT > T'), 'proximity alone cannot spin the car');
});

// ---- more heat: 5 stars, roadblocks, the helicopter, the spray shop; and car damage
// at the wheel heading east along a long straight street, a cruiser-free city round you
function driving() {
  const s = scene();
  s.ev(`(() => {
    let spot = null;
    for (let y = 1; y < N && !spot; y += 8) for (let x = 2; x < N && !spot; x += 8) {
      let ok = true; for (let d = 0; d < 22; d++) if (ROAD[idx(x + d, y)] !== 2 && ROAD[idx(x + d, y)] !== 3) { ok = false; break; }
      if (ok && ROAD[idx(x, y)] === 2) spot = [x + 0.5, y + 0.4];
    }
    var c = addCar({ x: spot[0], y: spot[1], hx: 1, hy: 0, body: GREEN }); me = c; c.player = true; c.travelA = 0; mode = 'drive'; a = 0; px = c.x; py = c.y;
    far();
  })()`);
  return s;
}

test('wanted goes up to five stars, with more units at each; ramming a cruiser or running down an officer adds to it', () => {
  const { ev } = scene();
  ev("footCops[0].x = px + 3; footCops[0].y = py; footCops[0].chase = false");
  ev("crime('bankjob')"); assert.strictEqual(ev('wanted.stars'), 3);
  ev("crime('ram')"); assert.strictEqual(ev('wanted.stars'), 4, 'ramming a police car: one more');
  assert.strictEqual(ev('wanted.crime'), 'ramming a police car');
  ev("crime('hitcop')"); assert.strictEqual(ev('wanted.stars'), 5, 'and as many as there are');
  ev("crime('hitcop')"); assert.strictEqual(ev('wanted.stars'), 5);
  assert.strictEqual(ev('cars.filter(c => c.pursuit).length'), 7, 'seven units at five stars');
  assert.deepStrictEqual([ev('ESCAPE_T[5]'), ev('fineFor(5)')], [100, 1000]);
});

test('roadblocks: at four stars, three cruisers across the street ahead of you, with officers who stay put while you drive; packed up once the heat is off', () => {
  const { ev, step } = driving();
  ev("addWanted('bankjob', px, py, true)");
  step(0.5);
  assert.strictEqual(ev('roadblocks.length'), 0, 'not at three stars');
  ev("addWanted('ram', px, py, true)");
  step(0.1);
  assert.strictEqual(ev('roadblocks.length'), 1, 'four: one goes up');
  const b = JSON.parse(ev('JSON.stringify((({ x, y, cars, cops }) => ({ ahead: rel(x - px), across: rel(y - py), cars: cars.map(c => [+rel(c.y - py).toFixed(2), c.parked, c.patrol, Math.abs(c.hx * me.hx + c.hy * me.hy)]), cops: cops.length }))(roadblocks[0]))'));
  assert.ok(b.ahead >= 10 && b.ahead <= 20, `a block or two ahead (${b.ahead})`);
  assert.strictEqual(b.cars.length, 3);
  assert.ok(b.cars.every(([, parked, patrol, along]) => parked && patrol && along < 0.01), 'parked cruisers, lying across the street');
  const gaps = b.cars.map(c => c[0]).sort((p, q) => p - q);
  assert.ok(gaps[1] - gaps[0] - 2 * 0.24 > 0.22, 'a gap a car can just get through');
  assert.strictEqual(b.cops, 2);
  step(3);
  assert.ok(ev('roadblocks[0].cops.every(c => !c.chase)'), 'the officers hold the line while you are at the wheel');
  assert.strictEqual(ev('roadblocks.length'), 1, 'one at a time');
  ev('clearWanted(); px = mod(px - 40, N); me.x = px');
  step(0.1);
  assert.strictEqual(ev('roadblocks.length'), 0, 'heat off, and out of sight: gone');
  assert.ok(!ev('cars.some(c => c.roadblock)') && !ev('footCops.some(c => c.post)'));
});

test('the helicopter: at five stars it comes out, its light finds you in the open, a roof over your head hides you, and it flies off when the heat is off', () => {
  const { ev, step } = scene();
  ev("addWanted('bankjob', px, py, true); addWanted('hitcop', px, py, true)");
  ev('for (const c of cars) if (c.pursuit) { c.x = mod(px + 100, N); c.ex = c.x; } footCops.forEach(c => { c.x = mod(px + 120, N); c.chase = false; })'); // (only the helicopter's looking)
  step(0.05);
  assert.ok(ev('!!heli'), 'up it goes');
  assert.ok(ev('near(heli.x, heli.y, px, py)') > 20, 'from somewhere off over the rooftops');
  step(30);
  assert.ok(ev('near(heli.sx, heli.sy, px, py) < SPOT_R'), 'its light on you');
  assert.strictEqual(ev('wanted.seen'), true);
  assert.strictEqual(ev('wanted.hideT'), 0);
  ev("mode = 'room'; room = { ret: [px, py, 0], def: {}, kind: 'store' }");
  step(1);
  assert.strictEqual(ev('wanted.seen'), false, 'indoors, it can not see you');
  ev("mode = 'walk'; room = null; clearWanted()");
  step(40);
  assert.ok(ev('!heli'), 'heat off: it flies away');
});

test('the spray shop: at an AUTO REPAIR door, a respray clears the stars and the damage, in a new colour; not with a cop watching, not if you are broke', () => {
  const { ev } = driving();
  ev("var d = doors.find(o => o.sh.word === 'AUTO REPAIR'); me.x = d.x - d.nx * 6; me.y = d.y - d.ny * 6; px = me.x; py = me.y; far()");
  assert.strictEqual(ev('sprayShopAt(me.x, me.y) === d'), true);
  assert.strictEqual(ev('sprayShopAt(mod(me.x + 3, N), me.y)'), null);
  ev("money = 500; me.body = RED; damageCar(me, 60); addWanted('bankjob', px, py, false)");
  ev('footCops[0].x = px + 2; footCops[0].y = py');
  assert.strictEqual(ev('sprayRefusal(me)'), 'seen', 'a cop right there: no');
  ev('far()');
  assert.strictEqual(ev('sprayRefusal(me)'), '');
  assert.strictEqual(ev('applyRespray(me)'), true, 'the stars were there to lose');
  assert.deepStrictEqual([ev('wanted.stars'), ev('me.dmg'), ev('me.body !== RED')], [0, 0, true]);
  ev('money = 20');
  assert.strictEqual(ev('sprayRefusal(me)'), 'money');
});

test('car damage: crashes add up, a smoking car is down on power, past the top it burns and then goes up; the traffic gets out of a burning car', () => {
  const { ev } = driving();
  assert.strictEqual(ev('crashDamage(0.9)'), 0 + ev('(0.9 - 0.6) * 22'));
  assert.strictEqual(ev('crashDamage(0.5)'), 0, 'a bump does nothing');
  ev('damageCar(me, 30)'); assert.strictEqual(ev('carPower(me)'), 1, 'dented, runs fine');
  ev('damageCar(me, 30)'); assert.strictEqual(ev('carPower(me)'), 0.9, 'smoking');
  ev('damageCar(me, 20)'); assert.strictEqual(ev('carPower(me)'), 0.7, 'black smoke');
  assert.strictEqual(ev('burning(me)'), false);
  ev('damageCar(me, 40)'); assert.deepStrictEqual([ev('me.dmg'), ev('burning(me)')], [100, true], 'on fire');
  assert.strictEqual(ev('me.parked || false'), false, 'yours keeps going (for now)');
  const gone = ev('(() => { let n = []; for (let t = 0; t < BURN_T + 0.2; t += 0.1) n = n.concat(stepCarFires(0.1)); return n.includes(me) && me.wrecked; })()');
  assert.strictEqual(gone, true, 'and up it goes');
  ev('damageCar(me, 10)'); assert.strictEqual(ev('me.dmg'), 100, 'a wreck takes no more');
  ev('repairCar(me)'); assert.deepStrictEqual([ev('me.dmg'), ev('me.wrecked'), ev('burning(me)')], [0, false, false]);
  // a car in the traffic, on fire: it stops, and its driver bails out (and it's out of the chase if it was in it)
  ev('var o = cars.find(c => !c.player && !c.parked && !c.patrol); o.pursuit = true; damageCar(o, 100)');
  assert.deepStrictEqual([ev('o.parked'), ev('o.v'), ev('o.bail'), ev('o.pursuit')], [true, 0, true, false]);
});

test('wrecks in the traffic are towed once you are well away; a car left smoking goes back into the traffic mended', () => {
  const { ev } = driving();
  ev('var w = cars.find(c => !c.player && !c.patrol); damageCar(w, 100); w.wrecked = true');
  ev('var s = cars.find(c => !c.player && !c.patrol && c !== w); s.parked = true; s.dmg = 60');
  ev('w.x = mod(px + 35, N); s.x = mod(px + 50, N); stepTraffic(0.05, T)');
  assert.strictEqual(ev('cars.includes(w)'), false, 'towed');
  assert.deepStrictEqual([ev('cars.includes(s)'), ev('s.parked'), ev('s.dmg')], [true, false, 0], 'back on the road, mended');
});
