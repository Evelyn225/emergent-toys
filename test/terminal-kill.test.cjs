'use strict';
// `ps` lists the system's built-in processes (System, csrss.exe, svchost.exe
// and the rest - os/fs-ops.js's getBuiltInProcesses) alongside the kernel's
// real table (apps/terminal.js's buildPsRows). Before this fix, CMDS.kill
// only ever looked in the kernel table, so a pid `ps` had just printed came
// back "No such process" from KILL while TASKKILL answered Access Denied for
// the same pid - the table contradicting the command right next to it.
// buildKillDenialMessage (apps/terminal.js) is the fix: it uses the same
// findBuiltInProcess lookup taskkill already uses, so `ps` and `kill` cannot
// disagree about what counts as a built-in process.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function terminalCtx(overrides) {
  const ctx = makeOsContext(Object.assign({
    wins: {},
    kernelListProcesses: () => [],
    getBuiltInProcesses: () => [],
    findBuiltInProcess: () => null,
    kernelMetricsFor: () => ({ cpu: null, mem: null, memUnit: null }),
  }, overrides));
  return loadOsSources(ctx, ['os/process-view.js', 'apps/terminal.js']);
}

test('a built-in pid ps lists is denied with the TASKKILL message, not "No such process"', () => {
  const builtIn = { pid: 116, name: 'services.exe', protected: true };
  const ctx = terminalCtx({
    getBuiltInProcesses: () => [builtIn],
    findBuiltInProcess: (pid) => (pid === 116 ? builtIn : null),
  });
  // buildPsRows really does list 116 - the regression this guards against.
  const rows = ctx.buildPsRows();
  assert.ok(rows.some(r => r.pid === 116), 'sanity: ps should list the built-in pid');

  assert.strictEqual(ctx.buildKillDenialMessage(116), '116 is a system process. Use TASKKILL.');
});

test('a pid that is neither a built-in nor in the kernel table gets no denial message', () => {
  const ctx = terminalCtx();
  assert.strictEqual(ctx.buildKillDenialMessage(99999), null);
});

test('a real kernel pid is never mistaken for a built-in process', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [{ pid: 2000, kind: 'user', state: 'running', name: 'job.script' }],
    findBuiltInProcess: () => null,
  });
  assert.strictEqual(ctx.buildKillDenialMessage(2000), null);
});
