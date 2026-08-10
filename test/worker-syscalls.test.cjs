'use strict';
// Adapter drift between the main-thread filesystem shim (makeVfsScriptFs) and
// the worker-side one (makeSyscallScriptFs) is the defect class that keeps
// biting this project: the interpreter must not be able to tell the two
// apart, but nothing short of a real comparison of both objects catches a
// dropped argument or a renamed method. These tests do that comparison.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function loadAdapters() {
  const ctx = loadOsSources(makeOsContext(), ['os/script/interp.js', 'os/worker/syscalls.js']);
  return { mainFs: ctx.makeVfsScriptFs(), workerFs: ctx.makeSyscallScriptFs() };
}

test('makeSyscallScriptFs has exactly the same key set as makeVfsScriptFs', () => {
  const { mainFs, workerFs } = loadAdapters();
  assert.deepStrictEqual(Object.keys(workerFs).sort(), Object.keys(mainFs).sort());
});

test('every shared method has matching arity between the two adapters', () => {
  const { mainFs, workerFs } = loadAdapters();
  for (const key of Object.keys(mainFs)) {
    assert.strictEqual(workerFs[key].length, mainFs[key].length,
      'arity mismatch for ' + key + ': main=' + mainFs[key].length + ' worker=' + workerFs[key].length);
  }
});

function loadAdapterWithSelf() {
  const posted = [];
  const self = { postMessage(m) { posted.push(m); } };
  const ctx = loadOsSources(makeOsContext({ self }), ['os/worker/syscalls.js']);
  return { ctx, posted };
}

test('a syscall resolves its promise on the matching reply', async () => {
  const { ctx, posted } = loadAdapterWithSelf();
  const p = ctx.sysCall('stat', ['a.txt']);
  assert.strictEqual(posted.length, 1);
  assert.strictEqual(posted[0].type, 'syscall');
  assert.strictEqual(posted[0].name, 'stat');
  assert.deepStrictEqual(posted[0].args, ['a.txt']);
  const seq = posted[0].seq;
  ctx.sysHandleReply({ seq, ok: true, value: 'result' });
  assert.strictEqual(await p, 'result');
});

test('a syscall rejects with .code intact on an error reply', async () => {
  const { ctx, posted } = loadAdapterWithSelf();
  const p = ctx.sysCall('readFile', ['missing.txt']);
  const seq = posted[0].seq;
  ctx.sysHandleReply({ seq, ok: false, error: { code: 'ENOENT', message: 'no such file' } });
  await assert.rejects(p, err => {
    assert.strictEqual(err.code, 'ENOENT');
    assert.ok(String(err.message).includes('no such file'));
    return true;
  });
});

test('a reply with an unknown seq is ignored rather than throwing', () => {
  const { ctx } = loadAdapterWithSelf();
  assert.doesNotThrow(() => ctx.sysHandleReply({ seq: 999999, ok: true, value: 'z' }));
});
