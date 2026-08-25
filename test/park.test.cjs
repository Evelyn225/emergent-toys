'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function park() {
  return loadOsSources(makeOsContext(), ['os/park.js']);
}

function busyFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* occupy the thread */ }
}

test('a fresh accumulator has parked for zero', () => {
  const ctx = park();
  assert.strictEqual(ctx.parkTotalMs(), 0);
});

test('one park interval accumulates roughly its real duration', () => {
  const ctx = park();
  ctx.parkBegin();
  busyFor(20);
  ctx.parkEnd();
  const total = ctx.parkTotalMs();
  assert.ok(total >= 15, 'expected at least 15ms parked, got ' + total);
  assert.ok(total < 200, 'expected well under 200ms parked, got ' + total);
});

test('two sequential parks add together', () => {
  const ctx = park();
  ctx.parkBegin(); busyFor(15); ctx.parkEnd();
  const afterFirst = ctx.parkTotalMs();
  ctx.parkBegin(); busyFor(15); ctx.parkEnd();
  assert.ok(ctx.parkTotalMs() > afterFirst, 'second park did not add');
});

// This is the invariant that stops concurrent syscalls double-subtracting.
// Two syscalls in flight means the worker is parked ONCE over the union of
// their intervals, not twice over their sum.
test('nested parks count the union once, not the sum twice', () => {
  const ctx = park();
  ctx.parkBegin();
  busyFor(40);
  ctx.parkBegin();   // inner park opens after the work, closes immediately
  ctx.parkEnd();
  ctx.parkEnd();
  const total = ctx.parkTotalMs();
  // Correct (depth-counted): the outer interval is measured once, ~40ms.
  // Broken (no depth): the inner parkBegin resets the start, so BOTH ends
  // measure from that reset point and the total collapses to ~0.
  // The two outcomes differ by the whole interval, so this bound is robust
  // to a noisy clock in a way that an upper bound on double-counting is not.
  assert.ok(total >= 30, 'nested parks lost the outer interval: got ' + total);
  assert.ok(total < 400, 'implausible total: ' + total);
});

test('an unmatched parkEnd is ignored rather than corrupting the total', () => {
  const ctx = park();
  ctx.parkEnd();
  assert.strictEqual(ctx.parkTotalMs(), 0);
  ctx.parkBegin(); busyFor(10); ctx.parkEnd();
  const good = ctx.parkTotalMs();
  ctx.parkEnd();
  assert.strictEqual(ctx.parkTotalMs(), good, 'stray parkEnd changed the total');
});

test('parkReset clears the total and any open depth', () => {
  const ctx = park();
  ctx.parkBegin();
  busyFor(10);
  ctx.parkReset();
  assert.strictEqual(ctx.parkTotalMs(), 0);
  ctx.parkEnd();
  assert.strictEqual(ctx.parkTotalMs(), 0, 'reset left an open park that later closed');
});
