'use strict';
// ASCII City: the revolver (city/gun.js). Under the pawnbroker's counter after nine, loading it, where a shot goes, a
// killing and what follows (the body, the ambulance, somebody new in their place), the panic, the law (how many stars,
// the police only shooting once you have, no fine for a killing), and the papers. Run headless in a vm. (The gun in
// your hand, the crosshair, the fortune teller's tip: the browser test.)
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');
const j = (ev, expr) => JSON.parse(ev(`JSON.stringify(${expr})`)); // (arrays out of the vm aren't this realm's)

// armed and loaded, at night, on the sidewalk outside a shop facing along it, with nobody else about but `who` 0.6
// ahead (and the police all far away). at(k): k back along the sidewalk behind you
function armed(ev) {
  ev(`tod = 22; money = 5000; clearInventory(); buy('revolver'); buy('ammo'); held = 0; reloadGun(); for (let t = 0; t < 2; t += 0.05) { T += 0.05; stepGun(0.05); }
      var door = doors.find(d => d.use === 'shop' && d.dist === 'midtown'); mode = 'walk'; px = door.x; py = door.y; a = door.ny ? 0 : Math.PI / 2;
      var at = k => ({ x: mod(px - Math.cos(a) * k, N), y: mod(py - Math.sin(a) * k, N) });
      clearWanted(); reports.length = 0;
      for (const p of people) { p.hidden = true; p.x = mod(px + 40, N); }
      for (const c of footCops) { c.x = mod(px + 120, N); c.y = py; c.goal = null; }
      for (const c of cars) if (c.patrol) { c.x = mod(px + 120, N); }
      var who = people[0]; Object.assign(who, at(-0.6), { hidden: false, path: [], talk: 0, wait: 0 });`);
}
const fire = (ev, slope = 0) => ev(`(() => { const s = fireGun(px, py, 0.17, a, ${slope}); return s && (s.empty ? 'empty' : s.what); })()`);

test('under the counter: the pawnbroker has it from nine till two, not for the police\'s most wanted, and it can\'t be lifted', () => {
  const { ev } = loadCity();
  assert.deepStrictEqual(j(ev, "(tod = 12, stockFor('pawn', 'PAWN'))"), ['telescope', 'skateboard', 'boombox', 'umbrella', 'vinyl']);
  assert.deepStrictEqual(j(ev, "(tod = 21.5, stockFor('pawn', 'PAWN')).slice(-2)"), ['revolver', 'ammo']);
  assert.ok(ev("tod = 1.5; stockFor('pawn', 'PAWN').includes('revolver') && openAt({ kind: SHOP_LIT, hours: hoursOf('PAWN') }, 1.5)"), 'still there at half one, and still open');
  assert.deepStrictEqual(j(ev, "(tod = 22, stealable(stockFor('pawn', 'PAWN'))).filter(id => ITEMS[id].kind === 'gun' || ITEMS[id].kind === 'ammo')"), []);
  ev("money = 5000; clearInventory(); addWanted('steal', px, py, true)");
  assert.match(ev("buy('revolver')[1]"), /police/);
  ev('clearWanted()');
  const [ok, line] = j(ev, "buy('revolver')");
  assert.ok(ok); assert.match(line, /under the counter/); assert.match(line, /box of rounds/, 'it comes empty');
  assert.strictEqual(ev('money'), 4400);
  assert.ok(ev("sellPrice({ id: 'revolver', uses: 0 }, SELL_RATE.PAWN) > 0"), 'and they\'ll buy it back');
});

test('loading it: empty, it clicks; R thumbs six in from the box; six shots and it\'s empty again', () => {
  const { ev } = loadCity();
  ev("tod = 22; money = 5000; clearInventory(); buy('revolver'); held = 0");
  assert.strictEqual(ev("fireGun(px, py, 0.17, 0, 0).empty"), true);
  assert.match(ev("reloadGun()[0]"), /No rounds/);
  ev("buy('ammo'); held = 0");
  assert.deepStrictEqual(j(ev, 'reloadGun()'), ['', 'reload']);
  assert.strictEqual(ev('fireGun(px, py, 0.17, 0, 0)'), null, 'not while you\'re loading it');
  ev('for (let t = 0; t < 2; t += 0.05) { T += 0.05; stepGun(0.05); }');
  assert.deepStrictEqual(j(ev, 'inv'), [{ id: 'revolver', uses: 6 }, { id: 'ammo', uses: 18 }]);
  let shots = 0;
  for (let k = 0; k < 10; k++) { if (ev('(() => { const s = fireGun(px, py, 0.17, 0, 0.3); return !!s && !s.empty; })()')) shots++; ev('T += 0.4; stepGun(0.4)'); }
  assert.strictEqual(shots, 6);
  ev('inv[1].uses = 4; reloadGun(); for (let t = 0; t < 2; t += 0.05) { T += 0.05; stepGun(0.05); }');
  assert.deepStrictEqual(j(ev, 'inv'), [{ id: 'revolver', uses: 4 }], 'the last four, and the empty box binned');
  assert.strictEqual(ev("heldItem().id"), 'revolver', 'still in your hand');
});

test('where a shot goes: the first thing in its way, a wall, the road, a car, somebody', () => {
  const { ev } = loadCity();
  armed(ev);
  const shot = slope => ev(`traceShot(px, py, 0.17, Math.cos(a), Math.sin(a), ${slope}).what`);
  assert.strictEqual(shot(0), 'person');
  assert.ok(Math.abs(ev("traceShot(px, py, 0.17, Math.cos(a), Math.sin(a), 0).d") - 0.6) < 0.05);
  assert.strictEqual(shot(0.5), 'air', 'over their head');
  assert.strictEqual(shot(-0.6), 'ground', 'into the sidewalk at their feet');
  assert.strictEqual(ev("traceShot(px, py, 0.17, door.nx * 10, door.ny * 10, 0).what"), 'wall', 'the shop beside you');
  ev("var car = cars.find(c => !c.patrol && !c.ev); Object.assign(car, at(-0.3), { hx: -Math.sin(a), hy: Math.cos(a) })");
  assert.strictEqual(shot(-0.2), 'car', 'a car in between');
});

test('a killing: down for good where they stood, a pool spreading, everyone near running; 4 stars if a cop saw, and the papers', () => {
  const { ev } = loadCity();
  armed(ev);
  ev("for (let k = 1; k <= 6; k++) Object.assign(people[k], at(1 + k * 0.3), { hidden: false, path: [], talk: 0, wait: 0 }); Object.assign(footCops[0], at(3))");
  assert.strictEqual(fire(ev), 'person');
  assert.deepStrictEqual(j(ev, '[who.dead, who.down.dur === Infinity, bodies.length, pools.length]'), [true, true, 1, 1]);
  assert.deepStrictEqual(j(ev, '[wanted.stars, wanted.crime, wanted.killed, wanted.fired]'), [4, 'murder', true, true]);
  assert.strictEqual(ev('people.slice(1, 7).filter(p => p.flee).length'), 6, 'everybody runs');
  ev('var before = people.slice(1, 7).map(p => Math.hypot(rel(p.x - who.x), rel(p.y - who.y))); for (let k = 0; k < 40; k++) { T += 0.05; stepPeople(0.05, tod); }');
  assert.ok(ev('people.slice(1, 7).every((p, k) => Math.hypot(rel(p.x - who.x), rel(p.y - who.y)) > before[k])'), 'away from it');
  assert.ok(ev('who.down && who.dead'), 'and they stay down');
  assert.match(ev("newsLines(true).join(' ')"), /shot dead/);
  assert.ok(ev('noto.level') >= 25, 'a killing is remembered');
  // another: one more star; a shot that misses doesn't make it any less of a murder
  ev("Object.assign(people[8], at(-1), { hidden: false, path: [], talk: 0 }); T += 1; stepGun(1)");
  assert.strictEqual(fire(ev), 'person');
  assert.strictEqual(ev('wanted.stars'), 5);
  ev('T += 1; stepGun(1)'); fire(ev, 0.6);
  assert.strictEqual(ev('wanted.crime'), 'murder');
});

test('stars: a shot a cop sees is 2 (and stays 2, shot after shot); a shot nobody sees, nothing; heard, phoned in; an officer, 5', () => {
  const { ev } = loadCity();
  armed(ev);
  ev("who.hidden = true; Object.assign(footCops[0], at(3))");
  for (let k = 0; k < 3; k++) { fire(ev, 0.6); ev('T += 0.5; stepGun(0.5)'); }
  assert.deepStrictEqual(j(ev, '[wanted.stars, wanted.crime]'), [2, 'firing a gun in the street']);
  armed(ev); ev('who.hidden = true');
  fire(ev, 0.6);
  assert.deepStrictEqual(j(ev, '[wanted.stars, reports.length]'), [0, 0], 'nobody about');
  armed(ev); ev("Object.assign(who, at(5))"); // (behind you, in earshot)
  fire(ev, 0.6);
  assert.deepStrictEqual(j(ev, 'reports.map(r => r.kind)'), ['gunfire']);
  armed(ev); ev("who.hidden = true; Object.assign(footCops[0], at(-0.6)); delete footCops[0].down; Object.assign(footCops[1], at(2))");
  assert.strictEqual(fire(ev), 'cop');
  assert.deepStrictEqual(j(ev, '[wanted.stars, wanted.crime, footCops[0].dead]'), [5, 'killing a police officer', true]);
});

test('shooting an occupied or parked car gets reported without a pedestrian witness', () => {
  const { ev } = loadCity();
  armed(ev);
  for (const parked of [false, true]) {
    ev(`clearWanted(); reports.length = 0; cars.length = 0; who.hidden = true;
      for (const c of footCops) Object.assign(c, at(120));
      Object.assign(footCops[0], at(20));
      var target = addCar({ ...at(-.6), hx: Math.cos(a), hy: Math.sin(a), parked: ${parked}, body: RED });
      heldGun().uses = 6; gun.cool = 0; gun.reload = 0;`);
    assert.equal(fire(ev, -.12), 'car');
    assert.deepStrictEqual(j(ev, '[wanted.stars, reports.length, reports[0].kind, target.dmg > 0]'), [0, 1, 'gunfire', true]);
    ev('T = reports[0].t + .01; stepCrime(.01)');
    assert.equal(ev('wanted.stars'), 2, 'the call reaches dispatch after the normal delay');
  }
});

test('the police shoot back only once you\'ve fired (at anything): then they hit, and enough of it puts you down', () => {
  const { ev } = loadCity();
  armed(ev);
  ev("who.hidden = true; var cop = footCops[0]; Object.assign(cop, at(4)); addWanted('steal', px, py, true)");
  const run = n => ev(`(() => { for (let k = 0; k < ${n}; k++) { T += 0.05; stepCrime(0.05); wanted.busted = false; Object.assign(cop, at(4)); const r = stepGun(0.05); if (r) return r; } return null; })()`);
  run(100);
  assert.deepStrictEqual(j(ev, '[wanted.stars > 0, gun.copShots.length, needs.health]'), [true, 0, 100], 'wanted, chased, but not shot at');
  fire(ev, 0.6); // into the air
  assert.strictEqual(run(2000), 'down'); // (one officer, a few in every three missing)
  assert.ok(ev('gun.hurtT') > 0);
  assert.strictEqual(ev('needs.health'), 0);
  // and it all calms down: once the heat's off, the next time they're after you they don't shoot unless you do
  ev('clearWanted(); needs.health = 100');
  assert.strictEqual(ev('wanted.fired'), false);
});

test('the body: an ambulance comes for it, they cover it over, and the city has somebody new; caught, they take the gun', () => {
  const { ev } = loadCity();
  armed(ev);
  assert.strictEqual(fire(ev), 'person');
  let sheet = false;
  for (let k = 0; k < 3000 && ev('who.dead'); k++) { ev('T += 0.05; stepTraffic(0.05, T); stepGun(0.05)'); sheet ||= ev('sheeted(who)'); }
  assert.ok(!ev('who.dead'), 'taken away');
  assert.ok(sheet, 'under a sheet first');
  assert.deepStrictEqual(j(ev, '[bodies.length, !!who.down]'), [0, false]);
  assert.strictEqual(ev('pools.length'), 1, 'the blood stays a while');
  // no fine for a killing: jail, and it goes in the evidence bag; a fine for the rest, and they keep the gun
  ev("addWanted('murder', px, py, true)");
  assert.strictEqual(ev('payFine()'), false);
  ev('goToJail()');
  assert.ok(ev("seized.some(it => it.id === 'revolver')"));
  ev("clearInventory(); carryItem({ id: 'revolver', uses: 6 }); carryItem({ id: 'ammo', uses: 24 }); carryItem({ id: 'apple', uses: 3 }); money = 1000; addWanted('gunfire', px, py, true)");
  assert.strictEqual(ev('payFine()'), true);
  assert.deepStrictEqual(j(ev, 'inv.map(it => it.id)'), ['apple']);
});
