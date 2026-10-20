'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

test('yo-yo spring motion agrees at low, high and uneven frame rates', () => {
  const { ev } = loadCity();
  const runs = ev(`(() => {
    const schedules = [20, 30, 60, 144].map(hz => Array.from({length: hz / 2}, () => 1 / hz));
    schedules.push([.05, .01, .04, .025, .025, .05, .02, .03, .05, .05, .05, .05, .05]);
    return schedules.map(frames => {
      Object.assign(yoyo, {out:true, len:0, lenV:0, ang:0, angV:0, spin:0, aimX:.7, aimY:.3});
      for (const dt of frames) stepYoyo(dt);
      return [yoyo.len, yoyo.lenV, yoyo.ang, yoyo.angV];
    });
  })()`);
  for (const run of runs) for (let k = 0; k < 4; k++) assert.ok(Math.abs(run[k] - runs[0][k]) < 1e-10, JSON.stringify(runs));
  assert.ok(runs[0][0] > .7 && runs[0][2] > 1, 'still responds promptly to the target');
});

test('tiny cursor movements at the hand do not whip the yo-yo around; existing momentum coasts smoothly', () => {
  const { ev } = loadCity();
  ev('Object.assign(yoyo, {out:true, len:0, lenV:0, ang:1.2, angV:0, aimX:0, aimY:0})');
  ev('for (let n = 0; n < 120; n++) { yoyo.aimX = Math.sin(n) * .01; yoyo.aimY = Math.cos(n) * .01; stepYoyo(1/60); }');
  assert.ok(Math.abs(ev('yoyo.ang') - 1.2) < 1e-10);
  assert.ok(Math.abs(ev('yoyo.angV')) < 1e-10);
  const results = ev(`[20, 60, 144].map(hz => {
    Object.assign(yoyo, {out:true, len:0, lenV:0, ang:0, angV:3, aimX:0, aimY:0});
    for (let n = 0; n < hz / 2; n++) stepYoyo(1/hz);
    return [yoyo.ang, yoyo.angV];
  })`);
  for (const [angle, speed] of results) {
    assert.ok(angle > .4 && angle < .5 && speed > 0 && speed < .2);
    assert.ok(Math.abs(angle - results[0][0]) < 1e-10 && Math.abs(speed - results[0][1]) < 1e-10);
  }
});

test('reeling in settles both the string and angle without resetting the visible spin phase', () => {
  const { ev } = loadCity();
  ev('Object.assign(yoyo, {out:false, len:.8, lenV:1, ang:3, angV:5, spin:40, aimX:.8, aimY:0})');
  ev('for(let n=0;n<600;n++) stepYoyo(1/60)');
  assert.equal(ev('yoyo.len'), 0);
  assert.equal(ev('yoyo.ang'), 0);
  assert.equal(ev('yoyo.angV'), 0);
  assert.equal(ev('fx.yoyo'), 0);
  const spin = ev('yoyo.spin');
  assert.ok(spin > 40);
  ev('stepYoyo(.05)');
  assert.equal(ev('yoyo.spin'), spin, 'the face stays at its settled orientation');
});
