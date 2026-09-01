'use strict';
// os/kernel.js's _kernelUiOpen/_kernelUiOpenSystem delegate to
// scriptOpenUiTarget/scriptOpenSystemProgram (os/script/interp.js), the same
// functions makeVfsScriptFs's openUi/openSystem call on the main thread. This
// file loads both sources together and exercises the syscalls end to end -
// through kernelHandleSyscall - to prove the worker path reaches the real,
// shared program map (Task 1's 19-key `start` map) rather than a narrower
// kernel-only copy, and that the per-call directory argument the dispatch
// switch forwards (Task 5) is actually used.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function fakeWorker() {
  const posted = [];
  return { posted, terminate() {}, postMessage(m) { posted.push(m); } };
}

function kernelWithPrograms(overrides) {
  overrides = overrides || {};
  const calls = [];
  const ctx = makeOsContext(Object.assign({
    openNotepad: (arg, cwd) => calls.push(['notepad', arg, cwd]),
    openTerminal: (cwd) => calls.push(['terminal', cwd]),
    openSysmon: () => calls.push(['sysmon']),
    openBrowser: () => calls.push(['browser']),
    openDefrag: () => calls.push(['defrag']),
    openExplorer: (p) => calls.push(['explorer', p]),
    openWelcome: () => calls.push(['welcome']),
    openFiles: () => calls.push(['files']),
    openCalculator: () => calls.push(['calc']),
    openMinesweeper: () => calls.push(['minesweeper']),
    openRegedit: () => calls.push(['regedit']),
    openSystemFile: (name) => { calls.push(['fallback', name]); return true; },
    openMediaFile: (name, dir) => calls.push(['media', name, dir]),
    vfsStatSync: (path, cwd) => (overrides.stat ? overrides.stat(path, cwd) : null),
    isVisibleSystemPath: (path, opts) => { calls.push(['isSystemPath', path, opts]); return !!overrides.isSystemPath; },
  }, overrides.ctx || {}));
  loadOsSources(ctx, ['os/script/interp.js', 'os/kernel.js']);
  ctx.kernelInit();
  return { ctx, calls };
}

test('ui.openSystem reaches the shared program map for a mapped name and resolves the supplied directory', async () => {
  const { ctx, calls } = kernelWithPrograms();
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  ctx.kernelGetProcess(pid).cwd = 'ROOT';
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.openSystem', args: ['sysmon', 'DOCS'] });
  assert.deepStrictEqual(plain(calls), [['sysmon']]);
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, true);
  assert.strictEqual(reply.value, true);
});

test('ui.openSystem falls back to openSystemFile for a name the map does not recognize', async () => {
  const { ctx, calls } = kernelWithPrograms();
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.openSystem', args: ['void.tmp'] });
  assert.deepStrictEqual(plain(calls), [['fallback', 'void.tmp']]);
});

test('ui.openSystem falls back to proc.cwd when no directory argument is supplied', async () => {
  const { ctx, calls } = kernelWithPrograms();
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  ctx.kernelGetProcess(pid).cwd = 'ROOT';
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.openSystem', args: ['notepad', undefined, 'a.txt'] });
  assert.deepStrictEqual(plain(calls), [['notepad', 'a.txt', 'ROOT']]);
});

test('ui.open stats the target through the supplied directory and opens media or Notepad', async () => {
  const { ctx, calls } = kernelWithPrograms({
    stat: (path, cwd) => (path === 'CAT.PNG' && cwd === 'PICTURES' ? { name: 'CAT.PNG', dirName: 'PICTURES', kind: 'blob' } : null),
  });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.open', args: ['CAT.PNG', 'PICTURES'] });
  assert.deepStrictEqual(plain(calls), [['media', 'CAT.PNG', 'PICTURES']]);
  // Matches the main-thread adapter's openUi, which never returns a value.
  assert.strictEqual(plain(w.posted)[0].value, undefined);
});

test('ui.open reports nothing found without throwing when the target does not exist', async () => {
  const { ctx, calls } = kernelWithPrograms({ stat: () => null });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.open', args: ['nope.txt'] });
  assert.deepStrictEqual(plain(calls), []);
  const reply = plain(w.posted)[0];
  assert.strictEqual(reply.ok, true);
  assert.strictEqual(reply.value, undefined);
});

test('ui.isSystemPath forwards to the real isVisibleSystemPath with includeExplorer:true', async () => {
  const { ctx, calls } = kernelWithPrograms({ isSystemPath: true });
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  await ctx.kernelHandleSyscall(pid, { type: 'syscall', seq: 1, name: 'ui.isSystemPath', args: ['void.tmp'] });
  assert.deepStrictEqual(plain(calls), [['isSystemPath', 'void.tmp', { includeExplorer: true }]]);
  assert.strictEqual(plain(w.posted)[0].value, true);
});
