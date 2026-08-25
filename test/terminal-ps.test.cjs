'use strict';
// Task 3 replaced `ps` so it lists only the kernel's real process table,
// which meant the daemon story's fictional processes (soul_svc.exe, pid 512,
// the generated 500+i*13 series - os/daemon.js's getBuiltInProcesses) stopped
// showing up anywhere `ps` reaches, even though `taskkill 512` still refers
// to one of them and SYSMON's process tab still merges both lists. This
// tests buildPsRows (apps/terminal.js), the top-level helper `ps` now calls,
// against stubbed kernelListProcesses/getBuiltInProcesses so it runs without
// a DOM.
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

test('buildPsRows merges the real process table with the daemon story\'s fictional processes', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [{ pid: 2000, kind: 'system', state: 'running', name: 'TERMINAL' }],
    getBuiltInProcesses: () => [{ pid: 512, name: 'soul_svc.exe', protected: true }],
  });
  const rows = plain(ctx.buildPsRows());
  assert.deepStrictEqual(rows.map(r => r.pid), [512, 2000]);
});

test('a story pid reads as an ordinary row - same shape, kind system, state running - not visibly second-class', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [{ pid: 2000, kind: 'user', state: 'running', name: 'job.script' }],
    getBuiltInProcesses: () => [{ pid: 512, name: 'soul_svc.exe', protected: true }],
  });
  const rows = plain(ctx.buildPsRows());
  const story = rows.find(r => r.pid === 512);
  const real = rows.find(r => r.pid === 2000);
  // buildProcessRows (os/process-view.js) gives every row the same shape now,
  // so a story row's keys equal a real row's keys - not just a hand-picked subset.
  assert.deepStrictEqual(Object.keys(story).sort(), Object.keys(real).sort());
  assert.strictEqual(story.kind, 'system');
  assert.strictEqual(story.state, 'running');
  assert.strictEqual(story.name, 'soul_svc.exe');
});

test('rows stay sorted by pid across both sources, and real pids never collide with story pids', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [
      { pid: 2001, kind: 'user', state: 'running', name: 'b.script' },
      { pid: 2000, kind: 'system', state: 'running', name: 'TERMINAL' },
    ],
    getBuiltInProcesses: () => [
      { pid: 1333, name: 'signal_window.exe' },
      { pid: 512, name: 'soul_svc.exe' },
    ],
  });
  const rows = plain(ctx.buildPsRows());
  assert.deepStrictEqual(rows.map(r => r.pid), [512, 1333, 2000, 2001]);
});
