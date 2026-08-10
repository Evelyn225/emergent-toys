'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function kernel(overrides) {
  const ctx = loadOsSources(makeOsContext(overrides), ['os/kernel.js']);
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

// A bare `exit` with no code the script writer omits the args key entirely,
// not just the value inside it - `{type:'syscall', seq, name:'exit'}`. That
// shape used to reach `args[0]` before the `args || []` fallback further
// down ran for every other syscall, throwing an unhandled TypeError instead
// of the structured reply this boundary exists to guarantee.
test('exit tolerates a message with no args array at all', async () => {
  const ctx = kernel();
  ctx.kernelSetFs({});
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  const waited = ctx.kernelWait(pid);
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 3, name: 'exit' });
  assert.strictEqual(await waited, 0);
  assert.strictEqual(ctx.kernelGetProcess(pid), null);
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

// The interpreter passes the resolved directory of the target as a per-call
// argument (interp.js: openUi/readFile/run/grep all pass a directory that is
// not necessarily the script's own cwd). The kernel must honour that supplied
// directory instead of always falling back to proc.cwd.
test('a supplied directory argument is forwarded to the filesystem, not proc.cwd', async () => {
  const ctx = kernel();
  let seenCwd;
  ctx.kernelSetFs({ async readFile(path, cwd) { seenCwd = cwd; return 'x'; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  ctx.kernelGetProcess(pid).cwd = 'ROOT';
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'readFile', args: ['a.txt', 'DOCS'] });
  assert.strictEqual(seenCwd, 'DOCS');
});

test('writeFile forwards its supplied directory argument (args[2]), not proc.cwd', async () => {
  const ctx = kernel();
  let seenCwd;
  ctx.kernelSetFs({ async writeFile(path, text, cwd) { seenCwd = cwd; return { ok: true }; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  ctx.kernelGetProcess(pid).cwd = 'ROOT';
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'writeFile', args: ['a.txt', 'hi', 'DOCS'] });
  assert.strictEqual(seenCwd, 'DOCS');
});

test('proc.cwd is used when no directory argument is supplied', async () => {
  const ctx = kernel();
  let seenCwd;
  ctx.kernelSetFs({ async readFile(path, cwd) { seenCwd = cwd; return 'x'; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  ctx.kernelGetProcess(pid).cwd = 'ROOT';
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'readFile', args: ['a.txt'] });
  assert.strictEqual(seenCwd, 'ROOT');
});

test('dirExists dispatches to the filesystem rather than falling to ENOSYS', async () => {
  const ctx = kernel();
  let seenPath;
  ctx.kernelSetFs({ async dirExists(path) { seenPath = path; return true; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'dirExists', args: ['DOCS'] });
  assert.strictEqual(seenPath, 'DOCS');
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, true);
  assert.strictEqual(reply.value, true);
});

test('list dispatches to the filesystem and returns its entries', async () => {
  const ctx = kernel();
  let seenPath;
  const entries = [
    { dirName: 'DOCS', name: 'A.TXT', type: 'file', kind: 'text', size: 3 },
    { dirName: 'DOCS', name: 'SUB', type: 'dir', kind: 'dir', size: 0 },
  ];
  ctx.kernelSetFs({ async list(path) { seenPath = path; return entries; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'list', args: ['DOCS'] });
  assert.strictEqual(seenPath, 'DOCS');
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, true);
  assert.deepStrictEqual(reply.value, entries);
});

// A blob list entry's `blob` field crosses the worker boundary via postMessage,
// which uses the structured clone algorithm. Ruling E raised the question of
// whether os/blob-store.js ever puts a live Blob (or another non-cloneable
// value, e.g. a function) in that field. It doesn't: every writer
// (os/blob-store.js, os/fs-persist.js, os/vfs.js, os/media.js) stores a plain
// { url, kind, size, mime, ... } record where `url` is the string
// URL.createObjectURL returns, never the Blob itself. This test pins that
// down structurally, from the kernel's reply, without touching real Blob/DOM
// APIs the test harness doesn't provide.
test('a blob list entry survives structured cloning across the syscall reply', async () => {
  const ctx = kernel();
  const blobEntry = {
    dirName: 'PICTURES', name: 'CAT.PNG', type: 'file', kind: 'blob', size: 42,
    blob: { url: 'blob:fake-object-url', kind: 'image', size: 42, mime: 'image/png' },
  };
  ctx.kernelSetFs({ async list() { return [blobEntry]; } });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'list', args: ['PICTURES'] });
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, true);
  // structuredClone throws synchronously on anything postMessage cannot carry
  // (a live Blob under a bare property, a function, etc.). If this call
  // survives, the reply is safe to post to a real Worker.
  assert.doesNotThrow(() => structuredClone(reply));
  assert.deepStrictEqual(reply.value[0].blob, blobEntry.blob);
});

// _kernelUiIsSystemPath calls isVisibleSystemPath (os/daemon.js), which this
// kernel-only context never loads - so it is stubbed here, the same way the
// interpreter's own tests stub fsNormalizeDir/fsSplitPath. test/kernel-ui-
// syscalls.test.cjs exercises ui.open/ui.openSystem/ui.isSystemPath against
// the real program map and the real isVisibleSystemPath together.
test('ui.isSystemPath is answered rather than refused with ENOSYS', async () => {
  const ctx = kernel({ isVisibleSystemPath: () => false });
  ctx.kernelSetFs({});
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.isSystemPath', args: ['DOCS/a.txt'] });
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, true);
  assert.strictEqual(reply.value, false);
});

test('ui.isSystemPath forwards the path and includeExplorer:true to isVisibleSystemPath', async () => {
  const calls = [];
  const ctx = kernel({ isVisibleSystemPath: (path, opts) => { calls.push([path, opts]); return true; } });
  ctx.kernelSetFs({});
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.isSystemPath', args: ['void.tmp'] });
  assert.deepStrictEqual(plain(calls), [['void.tmp', { includeExplorer: true }]]);
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.value, true);
});
