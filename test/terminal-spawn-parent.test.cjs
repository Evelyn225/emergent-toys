'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function kernel() {
  const ctx = loadOsSources(makeOsContext(), ['os/kernel.js']);
  ctx.kernelInit();
  return ctx;
}
function fakeWorker() {
  return { posted: [], terminated: false, terminate() { this.terminated = true; }, postMessage(m) { this.posted.push(m); } };
}

test('kernelPidForWin maps a window back to its pid, and null when unknown', () => {
  const ctx = kernel();
  const pid = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  assert.strictEqual(ctx.kernelPidForWin('terminal'), pid);
  assert.strictEqual(ctx.kernelPidForWin('nope'), null);
});

test('a child reparents to pid 1 when its parent window exits', () => {
  const ctx = kernel();
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  // __spawnForTest(worker, name, parentPid) already takes the parent as its
  // third argument - use it rather than assigning parentPid afterwards.
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  assert.strictEqual(ctx.kernelGetProcess(child).parentPid, parent);
  ctx.kernelDeregisterSystem('terminal');
  assert.strictEqual(ctx.kernelGetProcess(child).parentPid, 1, 'orphan reparents to the kernel');
  assert.strictEqual(ctx.kernelGetProcess(child).state, 'running', 'the child keeps running');
});

test('an exiting parent clears its children stdio sinks', () => {
  const ctx = kernel();
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  const proc = ctx.kernelGetProcess(child);
  proc.onStdout = () => { throw new Error('this sink belongs to a window that is gone'); };
  proc.onStderr = () => { throw new Error('this sink belongs to a window that is gone'); };
  ctx.kernelDeregisterSystem('terminal');
  assert.strictEqual(ctx.kernelGetProcess(child).onStdout, null);
  assert.strictEqual(ctx.kernelGetProcess(child).onStderr, null);
});

test('output after the parent exits is buffered on the entry, not lost', () => {
  const ctx = kernel();
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  ctx.kernelGetProcess(child).onStdout = () => {};
  ctx.kernelDeregisterSystem('terminal');
  ctx._kernelWrite(ctx.kernelGetProcess(child), 'stdout', 'still running');
  assert.deepStrictEqual(plain(ctx.kernelGetProcess(child).stdout), ['still running']);
});
