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

// os/daemon.js hardcodes a fictional process list (BUILTIN_PROCESS_SEED and the
// generated 500 + i*13 series) that never exceeds pid 1333, including pid 512,
// which is scripted dialogue and cannot move. Real allocation must stay clear of
// that whole range - see the KERNEL_FIRST_USER_PID comment in os/kernel.js.
// kernel.js is loaded in isolation here (no os/daemon.js), so the ceiling is
// asserted as the constant the story actually uses rather than loaded live.
const DAEMON_STORY_PID_CEILING = 1333;

test('pid 1 is reserved for the kernel and real allocation starts at 2000, clear of the daemon story', () => {
  const ctx = kernel();
  assert.strictEqual(ctx.kernelGetProcess(1).name, 'kernel');
  const first = ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  assert.ok(first >= 2000, `first real pid ${first} must be >= 2000`);
});

test('no allocated pid ever lands in the daemon story range', () => {
  const ctx = kernel();
  const allocated = [
    ctx.kernelRegisterSystem('win-a', 'NOTEPAD'),
    ctx.kernelRegisterSystem('win-b', 'EXPLORER'),
    ctx.__spawnForTest(fakeWorker(), 'job.script'),
  ];
  ctx.kernelDeregisterSystem('win-a');
  allocated.push(ctx.kernelRegisterSystem('win-c', 'CALC'));
  allocated.forEach(pid => {
    assert.ok(pid > DAEMON_STORY_PID_CEILING, `pid ${pid} collides with the daemon story range (<= ${DAEMON_STORY_PID_CEILING})`);
  });
});
