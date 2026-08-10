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
  return { posted, terminate() {}, postMessage(m) { posted.push(m); } };
}

test('a syscall replies with ok and the value, keyed on seq', async () => {
  const ctx = kernel();
  ctx.kernelSetFs({ async readFile() { return 'contents'; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 7, name: 'readFile', args: ['a.txt'] });
  assert.deepStrictEqual(plain(w.posted), [{ type: 'syscall-reply', seq: 7, ok: true, value: 'contents' }]);
});

test('a thrown VfsError crosses the boundary with its code intact', async () => {
  const ctx = kernel();
  ctx.kernelSetFs({ async writeFile() { const e = new Error('not enough space'); e.name = 'VfsError'; e.code = 'ENOSPC'; throw e; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'writeFile', args: ['a.txt', 'x'] });
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, false);
  assert.strictEqual(reply.error.code, 'ENOSPC');
  assert.ok(reply.error.message.includes('space'));
});

test('an unknown syscall is refused, not ignored', async () => {
  const ctx = kernel();
  ctx.kernelSetFs({});
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 2, name: 'launchMissiles', args: [] });
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, false);
  assert.strictEqual(reply.error.code, 'ENOSYS');
});

test('exit ends the process and does not reply', async () => {
  const ctx = kernel();
  ctx.kernelSetFs({});
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  const waited = ctx.kernelWait(pid);
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 3, name: 'exit', args: [2] });
  assert.strictEqual(await waited, 2);
  assert.strictEqual(ctx.kernelGetProcess(pid), null);
  assert.deepStrictEqual(plain(w.posted), [], 'a process that has exited cannot receive a reply');
});

test('a syscall from a dead pid is dropped', async () => {
  const ctx = kernel();
  ctx.kernelSetFs({ async readFile() { return 'x'; } });
  await ctx.kernelHandleSyscall(4242, { type: 'syscall', seq: 1, name: 'readFile', args: ['a'] });
  // No throw is the assertion.
});

test('cwd and getenv are answered from the process entry', async () => {
  const ctx = kernel();
  ctx.kernelSetFs({});
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  ctx.kernelGetProcess(pid).cwd = 'DOCS';
  ctx.kernelGetProcess(pid).env = { USER: 'VISITOR' };
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'cwd', args: [] });
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 2, name: 'getenv', args: ['USER'] });
  assert.deepStrictEqual(plain(w.posted).map(m => m.value), ['DOCS', 'VISITOR']);
});
