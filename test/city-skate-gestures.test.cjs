'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { skateSim } = require('./helpers/skate-sim.cjs');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../city/skate-gestures.js'), 'utf8'), ctx);
const make = vm.runInContext('createSkateGesture', ctx), stick = vm.runInContext('skateStick', ctx);
const paths = {
  '': [[0, 1], [0, .4], [0, -.4], [0, -1]],
  A: [[0, 1], [-.2, .4], [-.4, -.4], [-.7, -.8]],
  D: [[0, 1], [.2, .4], [.4, -.4], [.7, -.8]]
};
for (const [key, turn] of [['S', Math.PI], ['AS', Math.PI * 1.5], ['360S', -Math.PI * 1.5]])
  paths[key] = Array.from({ length: 15 }, (_, i) => [Math.cos(Math.PI / 2 + turn * i / 14), Math.sin(Math.PI / 2 + turn * i / 14)]).concat([[0, 0]]);
let seed = 1;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

for (const [key, path] of Object.entries(paths)) test(`gesture ${key || 'ollie'}: at least 95/100 noisy paths recognised`, () => {
  let correct = 0;
  for (let run = 0; run < 100; run++) {
    const g = make(), events = []; let t = 0;
    const interval = .008 + random() * .002;
    for (const [x, y] of path) {
      const event = g.sample(x + (random() - .5) * .08, y + (random() - .5) * .08, t += interval);
      if (event) events.push(event);
    }
    if (events.length === 1 && events[0].key === key) correct++;
  }
  assert.ok(correct >= 95, `${correct}/100`);
});

test('radial dead zone preserves direction and scales smoothly', () => {
  assert.deepEqual(Array.from(stick(.1, .1)), [0, 0]);
  const [x, y] = stick(.3, .4);
  assert.ok(Math.abs(y / x - 4 / 3) < 1e-12);
  assert.ok(Math.abs(Math.hypot(x, y) - (.5 - .15) / .85) < 1e-12);
  assert.equal(Math.hypot(...stick(2, 0)), 1);
});

test('nollies, weak pops, timeout, re-arm, and bounded history', () => {
  const g = make(); g.sample(0, -1, 0);
  assert.equal(g.sample(0, 1, .1).nollie, true);
  assert.equal(g.sample(0, -1, .11), null, 'one pop until centred again');
  g.sample(0, 0, .12); g.sample(0, 1, .2);
  assert.equal(g.sample(0, -1, .5), null, '180 ms deadline');
  g.reset(); g.sample(0, .65, 0); const weak = g.sample(0, -.65, .17);
  assert.ok(weak.strength >= .7 && weak.strength < 1.15);
  for (let i = 0; i < 1000; i++) g.sample(.1, 0, 1 + i / 1000);
  assert.ok(g.samples.length <= 128);
  assert.ok(g.samples.at(-1).t - g.samples[0].t <= .4);
});

test('scripted gamepad input drives the production adapter; steering never pops', () => {
  const t = skateSim([
    { frames: 42, buttons: { push: true }, sticks: { left: [-.5, 0] } },
    { sticks: { right: [0, 1] } },
    { sticks: { right: [0, .3] } },
    { sticks: { right: [-.7, -.8] } }
  ]);
  assert.ok(t[42].speed > 0 && t[42].yaw < 0);
  assert.ok(t.slice(0, 43).every(p => p.z === 0 && p.trick === null));
  assert.equal(t.at(-1).trick, 'kickflip');
  assert.ok(t.at(-1).vz > 0);
});
