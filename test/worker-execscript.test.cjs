'use strict';
// End-to-end regression test for the worker bundle. Loads the real worker
// manifest (readWorkerManifest(), so this cannot drift from
// tools/worker-manifest.json) into one vm context with a fake `self`, and
// drives execScript exactly the way os/worker/host.js does - printFn posts a
// `write` syscall, replies are answered through sysHandleReply.
//
// This is the test that would have caught "fsNormalizeDir is not defined":
// execScript calls it unconditionally while building its initial state,
// before running a single instruction, so every spawned script died
// immediately. No prior Node test ran execScript against nothing but the
// worker's own sources - test/worker-build.test.cjs only checks that the
// files parse, not that running them together works - so this only ever
// surfaced in a real browser (see Task 6's browser checklist).
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');
const { readWorkerManifest } = require('../tools/verify-split.cjs');

function loadWorker() {
  const posted = [];
  let ctx;
  const self = {
    postMessage(m) {
      posted.push(m);
      if (m.type === 'syscall' && m.name !== 'exit') {
        ctx.sysHandleReply({ seq: m.seq, ok: true, value: m.name === 'write' ? true : null });
      }
    },
  };
  ctx = loadOsSources(makeOsContext({ self }), readWorkerManifest());
  return { ctx, posted };
}

test('execScript runs PRINT against nothing but the worker manifest\'s own sources', async () => {
  const { ctx, posted } = loadWorker();
  const code = await ctx.execScript('PRINT hello from a worker', line => ctx.sysCall('write', ['stdout', String(line)]), {
    fs: ctx.makeSyscallScriptFs(),
    dirName: '',
    sourceName: 'job.script',
  });
  assert.strictEqual(code, 0);
  const writes = posted.filter(m => m.type === 'syscall' && m.name === 'write');
  assert.deepStrictEqual(writes.map(m => m.args), [['stdout', 'hello from a worker']]);
});

// TOUCH exercises the fs adapter's writeFile, which crosses the syscall
// boundary the fake `self` answers generically - proving path resolution and
// the syscall round trip both work together, not just PRINT's printFn-only path.
test('execScript runs a filesystem-touching command against the worker manifest', async () => {
  const { ctx } = loadWorker();
  const code = await ctx.execScript('TOUCH out.txt', () => {}, {
    fs: ctx.makeSyscallScriptFs(),
    dirName: '',
    sourceName: 'job.script',
  });
  assert.strictEqual(code, 0);
});
