'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function kernel() {
  const ctx = loadOsSources(makeOsContext(), ['os/kernel.js']);
  ctx.kernelInit();
  return ctx;
}

// A worker the kernel can drive without a browser.
function fakeWorker() {
  const posted = [];
  return { posted, terminated: false, postMessage(m) { posted.push(m); }, terminate() { this.terminated = true; } };
}

test('pid 1 is the kernel and pids are monotonic', () => {
  const ctx = kernel();
  assert.strictEqual(ctx.kernelGetProcess(1).name, 'kernel');
  const a = ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  const b = ctx.kernelRegisterSystem('win-b', 'EXPLORER');
  assert.ok(b > a, 'pids must increase');
  ctx.kernelDeregisterSystem('win-a');
  const c = ctx.kernelRegisterSystem('win-c', 'CALC');
  assert.ok(c > b, 'a freed pid must never be reused');
});

test('deregistering a system process removes it from the table', () => {
  const ctx = kernel();
  const pid = ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  assert.ok(ctx.kernelGetProcess(pid));
  ctx.kernelDeregisterSystem('win-a');
  assert.strictEqual(ctx.kernelGetProcess(pid), null);
});

test('SIGKILL terminates the worker, SIGTERM only flags it', () => {
  const ctx = kernel();
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  assert.strictEqual(ctx.kernelSignal(pid, 'SIGTERM'), true);
  assert.strictEqual(w.terminated, false, 'SIGTERM must be refusable');
  assert.ok(w.posted.some(m => m.type === 'signal' && m.sig === 'SIGTERM'));
  assert.strictEqual(ctx.kernelSignal(pid, 'SIGKILL'), true);
  assert.strictEqual(w.terminated, true);
});

test('signalling an unknown pid returns false rather than throwing', () => {
  assert.strictEqual(kernel().kernelSignal(9999, 'SIGKILL'), false);
});

test('exit records the code, notifies the waiter, and reaps', async () => {
  const ctx = kernel();
  const pid = ctx.__spawnForTest(fakeWorker(), 'job.script');
  const waited = ctx.kernelWait(pid);
  ctx.kernelExit(pid, 3);
  assert.strictEqual(await waited, 3);
  assert.strictEqual(ctx.kernelGetProcess(pid), null, 'the entry must be reaped');
});

test('orphans reparent to pid 1', () => {
  const ctx = kernel();
  const parent = ctx.__spawnForTest(fakeWorker(), 'parent.script');
  const child = ctx.__spawnForTest(fakeWorker(), 'child.script', parent);
  assert.strictEqual(ctx.kernelGetProcess(child).parentPid, parent);
  ctx.kernelExit(parent, 0);
  assert.strictEqual(ctx.kernelGetProcess(child).parentPid, 1);
});

test('listProcesses is sorted by pid and labels both kinds', () => {
  const ctx = kernel();
  ctx.__spawnForTest(fakeWorker(), 'job.script');
  ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  const list = ctx.kernelListProcesses();
  assert.deepStrictEqual(list.map(p => p.pid), list.map(p => p.pid).slice().sort((x, y) => x - y));
  assert.deepStrictEqual(new Set(list.map(p => p.kind)), new Set(['system', 'user']));
});
