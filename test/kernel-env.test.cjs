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
  const posted = [];
  return { posted, terminated: false, postMessage(m) { posted.push(m); }, terminate() { this.terminated = true; } };
}

test('pid 1 is seeded with the default environment', () => {
  const ctx = kernel();
  const env = ctx.kernelGetProcess(1).env;
  assert.strictEqual(env.COMPUTERNAME, 'SOMA-686');
  assert.strictEqual(env.USERNAME, 'VISITOR');
  assert.strictEqual(env.PATH, 'C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]');
});

test('kernelDefaultEnv hands out a copy, not the shared table', () => {
  const ctx = kernel();
  const first = ctx.kernelDefaultEnv();
  first.USERNAME = 'TAMPERED';
  assert.strictEqual(ctx.kernelDefaultEnv().USERNAME, 'VISITOR');
});

test('a registered window inherits the environment', () => {
  const ctx = kernel();
  const pid = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  assert.strictEqual(ctx.kernelGetProcess(pid).env.PATH, ctx.kernelGetProcess(1).env.PATH);
});

test('a spawned process inherits from its parent, not from pid 1', () => {
  const ctx = kernel();
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  ctx.kernelGetProcess(parent).env.PATH = 'C:\\sleepOS\\DOCS';
  ctx.kernelGetProcess(parent).env.MARKER = 'set-by-terminal';
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  assert.strictEqual(ctx.kernelGetProcess(child).env.PATH, 'C:\\sleepOS\\DOCS');
  assert.strictEqual(ctx.kernelGetProcess(child).env.MARKER, 'set-by-terminal');
});

test('a child mutating its environment does not reach the parent', () => {
  const ctx = kernel();
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  ctx.kernelGetProcess(child).env.PATH = 'C:\\nowhere';
  ctx.kernelGetProcess(child).env.NEWVAR = 'child-only';
  assert.strictEqual(ctx.kernelGetProcess(parent).env.PATH, 'C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]');
  assert.strictEqual(ctx.kernelGetProcess(parent).env.NEWVAR, undefined);
});

test('a spawn with an unknown parent falls back to the kernel environment', () => {
  const ctx = kernel();
  const child = ctx.__spawnForTest(fakeWorker(), 'orphan.script', 99999);
  assert.strictEqual(ctx.kernelGetProcess(child).env.USERNAME, 'VISITOR');
});

test('getenv reads the process environment it is now backed by', async () => {
  const ctx = kernel();
  const worker = fakeWorker();
  const pid = ctx.__spawnForTest(worker, 'job.script', 1);
  await ctx.kernelHandleSyscall(pid, { seq: 7, name: 'getenv', args: ['USERNAME'] });
  // posted[0] was built inside the vm by the kernel's postMessage call, so it
  // carries that realm's Object.prototype - plain() before comparing.
  assert.deepStrictEqual(plain(worker.posted[0]), { type: 'syscall-reply', seq: 7, ok: true, value: 'VISITOR' });
});
