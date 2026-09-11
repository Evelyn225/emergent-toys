'use strict';
// Task 3 replaced `ps` so it lists only the kernel's real process table,
// which meant the system's built-in processes (os/fs-ops.js's
// getBuiltInProcesses) stopped showing up anywhere `ps` reaches, even though
// `taskkill 116` still refers to one of them and SYSMON's process tab still
// merges both lists. This tests buildPsRows (apps/terminal.js), the top-level
// helper `ps` now calls, against stubbed kernelListProcesses/
// getBuiltInProcesses so it runs without a DOM.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function terminalCtx(overrides) {
  const ctx = makeOsContext(Object.assign({
    wins: {},
    kernelListProcesses: () => [],
    getBuiltInProcesses: () => [],
    kernelMetricsFor: () => ({ cpu: null, mem: null, memUnit: null }),
  }, overrides));
  return loadOsSources(ctx, ['os/process-view.js', 'apps/terminal.js']);
}

test('buildPsRows merges the real process table with the built-in processes', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [{ pid: 2000, kind: 'system', state: 'running', name: 'TERMINAL' }],
    getBuiltInProcesses: () => [{ pid: 116, name: 'services.exe', protected: true }],
  });
  const rows = plain(ctx.buildPsRows());
  assert.deepStrictEqual(rows.map(r => r.pid), [116, 2000]);
});

test('a built-in pid reads as an ordinary row - same shape, kind system, state running - not visibly second-class', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [{ pid: 2000, kind: 'user', state: 'running', name: 'job.script' }],
    getBuiltInProcesses: () => [{ pid: 116, name: 'services.exe', protected: true }],
  });
  const rows = plain(ctx.buildPsRows());
  const builtIn = rows.find(r => r.pid === 116);
  const real = rows.find(r => r.pid === 2000);
  // buildProcessRows (os/process-view.js) gives every row the same shape now,
  // so a built-in row's keys equal a real row's keys - not just a hand-picked
  // subset.
  assert.deepStrictEqual(Object.keys(builtIn).sort(), Object.keys(real).sort());
  assert.strictEqual(builtIn.kind, 'system');
  assert.strictEqual(builtIn.state, 'running');
  assert.strictEqual(builtIn.name, 'services.exe');
});

test('rows stay sorted by pid across both sources, and real pids never collide with built-in pids', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [
      { pid: 2001, kind: 'user', state: 'running', name: 'b.script' },
      { pid: 2000, kind: 'system', state: 'running', name: 'TERMINAL' },
    ],
    getBuiltInProcesses: () => [
      { pid: 312, name: 'svchost.exe' },
      { pid: 4, name: 'System' },
    ],
  });
  const rows = plain(ctx.buildPsRows());
  assert.deepStrictEqual(rows.map(r => r.pid), [4, 312, 2000, 2001]);
});
