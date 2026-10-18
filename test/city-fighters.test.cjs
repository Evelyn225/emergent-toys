'use strict';
// ASCII City: the interceptors that come after a stolen aircraft (city/fighters.js), run headless in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

// you, in the stolen Comet, up at height z; fly it along for secs (straight, or banked over and turning), the
// fighters after you
function sky(z = 6) {
  const { ev } = loadCity();
  ev(`var c = aircraft.find(a => a.type === 'jet'); Object.assign(c, { stolen: true, ground: false, z: ${z}, v: 7, yaw: 0, roll: 0, pitch: 0, x: 100, y: 120, dmg: 0, state: 'flown' });
      var seen = []; var fly = (secs, bank = 0, dt = 0.05) => { for (let t = 0; t < secs; t += dt) { T += dt;
        if (!c.ground) { c.roll = bank; c.yaw += bank * 0.9 * dt; c.x = mod(c.x + Math.cos(c.yaw) * c.v * dt, N); c.y = mod(c.y + Math.sin(c.yaw) * c.v * dt, N); }
        for (const e of stepFighters(c, dt)) seen.push(e); } };`);
  return { ev };
}
const closest = "Math.min(...fighters.map(f => Math.hypot(rel(f.x - c.x), rel(f.y - c.y))))";

test('steal one and get it up: twenty seconds later two fighters are scrambled, in from far off', () => {
  const { ev } = sky();
  ev('fly(15)');
  assert.strictEqual(ev('fighters.length'), 0, 'not yet');
  ev('fly(6)');
  assert.strictEqual(ev('fighters.length'), 2, 'a pair of them');
  assert.ok(ev("seen.includes('scramble')"));
  assert.ok(ev(closest) > 20, 'from well off');
  ev('fly(25)');
  assert.ok(ev(closest) < 12, `on you inside half a minute (${ev(closest).toFixed(1)})`);
  assert.ok(ev("seen.includes('six')"), 'and they let you know when one is on your tail');
});

test('your own plane, or one on the ground: nobody comes', () => {
  const { ev } = sky();
  ev('c.stolen = false; c.owned = true; fly(60)');
  assert.strictEqual(ev('fighters.length'), 0);
  const s = sky();
  s.ev('c.ground = true; c.z = 0; c.v = 0; fly(60)');
  assert.strictEqual(s.ev('fighters.length'), 0);
});

test('flying straight and level they shoot you to pieces; banked hard over and turning they mostly miss', () => {
  const runs = [0, 0.75].map(bank => { const { ev } = sky(); ev(`fly(21); fly(60, ${bank})`); return ev('c.dmg'); });
  assert.ok(runs[0] >= 100, `straight: on fire (${runs[0]})`);
  assert.ok(runs[1] < runs[0] * 0.5, `turning hard: far less (${runs[1]} against ${runs[0]})`);
});

test('down low over the rooftops they will not fire; they stay above their floor and clear of the buildings', () => {
  const { ev } = sky(0.9);
  ev("fly(21); c.z = 0.9; fly(40)");
  assert.ok(ev('fighters.length') === 2 && ev("seen.includes('toolow')"), 'they get there, and hold their fire');
  assert.strictEqual(ev('c.dmg'), 0, 'not a scratch');
  assert.ok(ev('fighters.every(f => f.z >= fighterFloor(f.x, f.y) - 1e-6)'), 'never below the floor');
});

test('land and stop, and they break off and go home; or they run out of fuel', () => {
  const { ev } = sky();
  ev('fly(30); c.ground = true; c.z = 0; c.v = 0; fly(8)');
  assert.ok(ev("seen.includes('breakoff')"), 'they break off');
  ev('fly(40)');
  assert.strictEqual(ev('fighters.length'), 0, 'and they are gone');
  assert.ok(ev("seen.includes('gone')"));
  const s = sky(0.9); // (low, so they can't finish you first)
  s.ev('fly(21); c.z = 0.9; fly(FIGHTER_FUEL + 2)');
  assert.ok(s.ev("seen.includes('bingo')"), 'bingo fuel');
});
