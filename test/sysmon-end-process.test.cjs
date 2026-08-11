'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function router(calls, wins) {
  const ctx = makeOsContext({
    wins: wins || {},
    closeWin: id => calls.push(['closeWin', id]),
    kernelSignal: (pid, sig) => { calls.push(['kernelSignal', pid, sig]); return true; },
  });
  return loadOsSources(ctx, ['os/process-view.js']);
}

test('a window-backed row is closed through the window manager', () => {
  const calls = [];
  const ctx = router(calls, { terminal: { title: 'TERMINAL.exe' } });
  assert.strictEqual(ctx.endProcessAction({ pid: 2000, winId: 'terminal', isStory: false }), 'closed');
  assert.deepStrictEqual(calls, [['closeWin', 'terminal']]);
});

test('a spawned process is signalled, not closed', () => {
  const calls = [];
  const ctx = router(calls);
  assert.strictEqual(ctx.endProcessAction({ pid: 2001, winId: null, isStory: false }), 'signalled');
  assert.deepStrictEqual(calls, [['kernelSignal', 2001, 'SIGTERM']]);
});

test('a story process is routed back to SYSMON - neither closeWin nor kernelSignal runs', () => {
  const calls = [];
  const ctx = router(calls);
  assert.strictEqual(ctx.endProcessAction({ pid: 512, winId: null, isStory: true }), 'story');
  assert.deepStrictEqual(calls, [], 'SYSMON owns what happens next for a story row, including the pid-512 branch and the Access Denied dialog');
});
