'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function interp() {
  return loadOsSources(makeOsContext(), ['os/park.js', 'os/script/interp.js']);
}

function stateWith(vars, frames, callStack, source) {
  return {
    vars: Object.assign(Object.create(null), vars || {}),
    frames: frames || [],
    callStack: callStack || [],
    sourceText: source || '',
  };
}

test('an empty state reports a small non-negative size', () => {
  const ctx = interp();
  const bytes = ctx.scriptStateBytes(stateWith());
  assert.ok(bytes >= 0, 'negative byte count: ' + bytes);
});

test('a bigger string in a variable reports more bytes', () => {
  const ctx = interp();
  const small = ctx.scriptStateBytes(stateWith({ A: 'x' }));
  const big = ctx.scriptStateBytes(stateWith({ A: 'x'.repeat(5000) }));
  assert.ok(big > small + 4000, 'allocation did not move the figure: ' + small + ' -> ' + big);
});

test('more variables report more bytes', () => {
  const ctx = interp();
  const one = ctx.scriptStateBytes(stateWith({ A: 'value' }));
  const many = ctx.scriptStateBytes(stateWith({ A: 'value', B: 'value', C: 'value' }));
  assert.ok(many > one, 'extra variables did not count');
});

test('call stack depth counts toward the figure', () => {
  const ctx = interp();
  const shallow = ctx.scriptStateBytes(stateWith({}, [{}], []));
  const deep = ctx.scriptStateBytes(stateWith({}, [{}, {}, {}], [{}, {}]));
  assert.ok(deep > shallow, 'call depth did not count');
});

test('loaded source size counts toward the figure', () => {
  const ctx = interp();
  const bare = ctx.scriptStateBytes(stateWith({}, [], [], ''));
  const loaded = ctx.scriptStateBytes(stateWith({}, [], [], 'PRINT hello\n'.repeat(200)));
  assert.ok(loaded > bare + 2000, 'source size did not count');
});

test('a malformed state reports zero rather than throwing', () => {
  const ctx = interp();
  assert.strictEqual(ctx.scriptStateBytes(null), 0);
  assert.strictEqual(ctx.scriptStateBytes({}), 0);
});

test('no running script means zero live bytes, not a stale reading', () => {
  const ctx = interp();
  assert.strictEqual(ctx.scriptLiveStateBytes(), 0);
});
