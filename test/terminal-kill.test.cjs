'use strict';
// `ps` lists the daemon story's fictional processes (soul_svc.exe, pid 512,
// the 500+i*13 series - os/daemon.js's getBuiltInProcesses) alongside the
// kernel's real table (apps/terminal.js's buildPsRows). Before this fix,
// CMDS.kill only ever looked in the kernel table, so a pid `ps` had just
// printed came back "No such process" from KILL while TASKKILL ran a real
// story beat on the same pid - the table contradicting the command right
// next to it. buildKillDenialMessage (apps/terminal.js) is the fix: it uses
// the same findBuiltInProcess lookup taskkill already uses, so `ps` and
// `kill` cannot disagree about what counts as a story process.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function terminalCtx(overrides) {
  const ctx = makeOsContext(Object.assign({
    wins: {},
    kernelListProcesses: () => [],
    getBuiltInProcesses: () => [],
    findBuiltInProcess: () => null,
  }, overrides));
  return loadOsSources(ctx, ['os/process-view.js', 'apps/terminal.js']);
}

test('a pid ps lists from the daemon story is denied with the TASKKILL message, not "No such process"', () => {
  const storyProc = { pid: 512, name: 'soul_svc.exe', cpu: 7.4, mem: 31.2, protected: true };
  const ctx = terminalCtx({
    getBuiltInProcesses: () => [storyProc],
    findBuiltInProcess: (pid) => (pid === 512 ? storyProc : null),
  });
  // buildPsRows really does list 512 - the regression this guards against.
  const rows = ctx.buildPsRows();
  assert.ok(rows.some(r => r.pid === 512), 'sanity: ps should list the story pid');

  assert.strictEqual(ctx.buildKillDenialMessage(512), '512 is a system process. Use TASKKILL.');
});

test('a pid that is neither a story process nor in the kernel table gets no denial message', () => {
  const ctx = terminalCtx();
  assert.strictEqual(ctx.buildKillDenialMessage(99999), null);
});

test('a real kernel pid is never mistaken for a story process', () => {
  const ctx = terminalCtx({
    kernelListProcesses: () => [{ pid: 2000, kind: 'user', state: 'running', name: 'job.script' }],
    findBuiltInProcess: () => null,
  });
  assert.strictEqual(ctx.buildKillDenialMessage(2000), null);
});
