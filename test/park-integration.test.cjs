'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

// interp.js needs a print sink and a script fs; neither matters here.
function interp() {
  const ctx = makeOsContext();
  return loadOsSources(ctx, ['os/park.js', 'os/script/interp.js']);
}

// THE regression test for this phase's worst trap. WAIT is NOT a syscall - it
// is a setTimeout inside the interpreter. A syscall-only park model would
// report a script running `WAIT 30` as 100% CPU for thirty seconds, which is
// exactly the class of fabricated number this phase exists to delete.
test('a WAIT is parked, not busy', async () => {
  const ctx = interp();
  ctx.parkReset();
  await ctx.scriptSleep(60, null);
  const parked = ctx.parkTotalMs();
  assert.ok(parked >= 40, 'WAIT was not counted as parked: got ' + parked + 'ms');
  assert.ok(parked < 400, 'WAIT parked implausibly long: ' + parked + 'ms');
});

test('an aborted WAIT still closes its park', async () => {
  const ctx = interp();
  ctx.parkReset();
  const listeners = [];
  const signal = {
    aborted: false,
    reason: null,
    addEventListener(type, fn) { if (type === 'abort') listeners.push(fn); },
    removeEventListener(type, fn) {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  const p = ctx.scriptSleep(5000, signal);
  setTimeout(() => { signal.aborted = true; listeners.slice().forEach(fn => fn()); }, 40);
  await assert.rejects(p);
  // The park must be closed, not left open forever. An open park makes every
  // later measurement report the process as permanently idle.
  const afterAbort = ctx.parkTotalMs();
  assert.ok(afterAbort > 0, 'aborted WAIT recorded no parked time');
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(ctx.parkTotalMs(), afterAbort, 'park stayed open after abort');
});

test('scriptSleep that is never entered parks nothing', async () => {
  const ctx = interp();
  ctx.parkReset();
  const signal = { aborted: true, reason: null, addEventListener() {}, removeEventListener() {} };
  await assert.rejects(ctx.scriptSleep(1000, signal));
  assert.strictEqual(ctx.parkTotalMs(), 0, 'a pre-aborted sleep should not park');
});
