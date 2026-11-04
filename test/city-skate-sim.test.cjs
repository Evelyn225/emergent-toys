'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { skateSim } = require('./helpers/skate-sim.cjs');

const run = [
  { frames: 42, keys: { KeyW: 1 } }, { frames: 12 },
  { frames: 42, keys: { KeyW: 1 } }, { frames: 12 },
  { frames: 42, keys: { KeyW: 1 } },
  { frames: 20, keys: { KeyA: 1 } },
  { frames: 20, keys: { Space: 1 } }, { frames: 60 }
];
const near = (got, want) => assert.ok(Math.abs(got - want) < 1e-8, `${got} != ${want}`);

test('three pushes, carve left, ollie: recorded legacy speed and position curves', () => {
  const t = skateSim(run);
  // Captured from the pre-overhaul code at 60 Hz. Changes to these numbers need
  // an explanation of the intended physics change, rather than regeneration.
  const golden = [
    [42, .481308951672, .223134449097, 0, 0],
    [54, .466563567242, .317796381274, 0, 0],
    [96, .871700980575, .841224882892, 0, 0],
    [150, .871700980575, 1.632821441374, 0, 0],
    [170, .840751694337, 1.907663180015, -.066139617211, 0],
    [190, .810314166296, 2.154627888824, -.186903457666, 0],
    [210, .810314166296, 2.397275845341, -.305556439499, .742222222222],
    [230, .810314166296, 2.639923801858, -.424209421332, .395555555556],
    [250, .792293767317, 2.880815314634, -.542003515704, 0]
  ];
  for (const [i, speed, x, y, z] of golden) {
    for (const [key, want] of Object.entries({ speed, x, y, z })) near(t[i][key], want);
  }
  assert.equal(t[210].trick, 'ollie');
  assert.equal(t.at(-1).bail, 0);
  assert.equal(t.at(-1).combo, 98);
  assert.deepEqual(t, skateSim(run), 'fresh simulation state on every run');
});

test('flat coasting only loses speed; foot braking stops sooner', () => {
  const coast = skateSim([{ frames: 120 }], { speed: .8 });
  const brake = skateSim([{ frames: 120, keys: { KeyS: 1 } }], { speed: .8 });
  for (let i = 1; i < coast.length; i++) assert.ok(coast[i].speed <= coast[i - 1].speed);
  assert.equal(brake.at(-1).speed, 0);
  assert.ok(brake.at(-1).x < coast.at(-1).x / 2);
});

test('Space release pops once, arrow mode kickflips, and landing banks when stopped', () => {
  const t = skateSim([
    { frames: 20, keys: { Space: 1 } },
    { keys: { ArrowLeft: 1 } }, { frames: 100, keys: { KeyS: 1 } }
  ], { speed: .7 });
  assert.equal(t[20].z, 0);
  assert.equal(t[21].trick, 'kickflip');
  assert.ok(t[21].vz > 0);
  assert.equal(t.at(-1).z, 0);
  assert.equal(t.at(-1).bail, 0);
  assert.ok(t.at(-1).score >= 100);
});

test('invalid timestep, frame counts and unsupported analog input fail explicitly', () => {
  for (const dt of [0, -1, NaN, Infinity, .1]) assert.throws(() => skateSim([], { dt }), /dt/);
  assert.throws(() => skateSim([{ frames: 1.5 }]), /frames/);
  assert.throws(() => skateSim([{ sticks: { right: [0, 1] } }]), /Phase 2/);
});
