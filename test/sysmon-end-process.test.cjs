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

// The kernel itself (pid 1) is a system-kind process with no winId.
// os/kernel.js's kernelSignal refuses to touch it and returns false rather
// than pretend a close succeeded. Before this fix that false return was
// discarded here, so selecting the kernel row in SYSMON and pressing End
// Task cleared the selection and re-rendered with no feedback - a silently
// dead button reachable only since this phase put pid 1 in the process list.
test('kernelSignal refusing (the kernel process) is reported as refused, not silently dropped', () => {
  const calls = [];
  const ctx = router(calls);
  ctx.kernelSignal = (pid, sig) => { calls.push(['kernelSignal', pid, sig]); return false; };
  assert.strictEqual(ctx.endProcessAction({ pid: 1, winId: null, isStory: false }), 'refused');
  assert.deepStrictEqual(calls, [['kernelSignal', 1, 'SIGTERM']]);
});

// The same false-return path also covers a process that exited between
// SYSMON rendering the row and the click landing - kernelSignal returns
// false for any non-running process, not only pid 1. That must not read as
// a success either.
test('a process signalled after it already exited is reported as refused, same as a kernel refusal', () => {
  const calls = [];
  const ctx = router(calls);
  ctx.kernelSignal = (pid, sig) => { calls.push(['kernelSignal', pid, sig]); return false; };
  assert.strictEqual(ctx.endProcessAction({ pid: 4321, winId: null, isStory: false }), 'refused');
  assert.deepStrictEqual(calls, [['kernelSignal', 4321, 'SIGTERM']]);
});
