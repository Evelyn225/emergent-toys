'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

test('harness exposes function declarations from a loaded source', () => {
  const ctx = makeOsContext();
  ctx.__evalSource('function addTwo(a, b) { return a + b; }');
  assert.strictEqual(typeof ctx.addTwo, 'function');
  assert.strictEqual(ctx.addTwo(2, 3), 5);
});

test('localStorage stub round-trips and reports quota errors', () => {
  const ctx = makeOsContext({ quotaBytes: 40 });
  ctx.localStorage.setItem('a', 'x');
  assert.strictEqual(ctx.localStorage.getItem('a'), 'x');
  assert.throws(() => ctx.localStorage.setItem('b', 'y'.repeat(200)), /QuotaExceeded/);
});

test('loadOsSources evaluates real sources in order', () => {
  const ctx = makeOsContext();
  // os/startup.js is a small existing source with a single function
  // declaration, so it verifies the loader against a real file without
  // depending on anything phase 2 has not written yet.
  loadOsSources(ctx, ['os/startup.js']);
  assert.strictEqual(typeof ctx.startDesktop, 'function');
});

test('document stub records and dispatches events', () => {
  const ctx = makeOsContext();
  const seen = [];
  ctx.document.addEventListener('fs-changed', e => seen.push(e.type));
  ctx.document.dispatchEvent(new ctx.CustomEvent('fs-changed'));
  assert.deepStrictEqual(seen, ['fs-changed']);
});
