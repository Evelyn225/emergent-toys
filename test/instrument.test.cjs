'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function inst() {
  return loadOsSources(makeOsContext(), ['os/instrument.js']);
}

test('a pid with no recorded work does not appear in the sample', () => {
  const ctx = inst();
  ctx.instWindowOpen(1000);
  const s = ctx.instWindowSample(2000);
  assert.strictEqual(s.size, 0);
});

test('busy time becomes a percentage of the window', () => {
  const ctx = inst();
  ctx.instWindowOpen(1000);
  ctx.instBusyAdd(2000, 250);
  const s = ctx.instWindowSample(2000);
  assert.strictEqual(Math.round(s.get(2000)), 25);
});

test('repeated adds for one pid accumulate within a window', () => {
  const ctx = inst();
  ctx.instWindowOpen(0);
  ctx.instBusyAdd(7, 100);
  ctx.instBusyAdd(7, 200);
  assert.strictEqual(ctx.instBusyMsFor(7), 300);
});

test('two pids are accounted separately', () => {
  const ctx = inst();
  ctx.instWindowOpen(0);
  ctx.instBusyAdd(1, 100);
  ctx.instBusyAdd(2, 400);
  const s = ctx.instWindowSample(1000);
  assert.strictEqual(Math.round(s.get(1)), 10);
  assert.strictEqual(Math.round(s.get(2)), 40);
});

// Sampling must reset. Without this the second window reports the first
// window's work again and a process that has gone idle keeps showing busy.
test('sampling clears the totals so the next window starts empty', () => {
  const ctx = inst();
  ctx.instWindowOpen(0);
  ctx.instBusyAdd(5, 500);
  ctx.instWindowSample(1000);
  assert.strictEqual(ctx.instBusyMsFor(5), 0);
  assert.strictEqual(ctx.instWindowSample(2000).size, 0);
});

test('a percentage is capped at 100 rather than exceeding a core', () => {
  const ctx = inst();
  ctx.instWindowOpen(0);
  ctx.instBusyAdd(9, 5000);
  assert.strictEqual(ctx.instWindowSample(1000).get(9), 100);
});

test('a zero-length window yields no percentages rather than dividing by zero', () => {
  const ctx = inst();
  ctx.instWindowOpen(1000);
  ctx.instBusyAdd(3, 50);
  const s = ctx.instWindowSample(1000);
  assert.strictEqual(s.size, 0);
});

test('a falsy pid or a non-positive duration is ignored', () => {
  const ctx = inst();
  ctx.instWindowOpen(0);
  ctx.instBusyAdd(null, 100);
  ctx.instBusyAdd(0, 100);
  ctx.instBusyAdd(4, 0);
  ctx.instBusyAdd(4, -20);
  assert.strictEqual(ctx.instWindowSample(1000).size, 0);
});
