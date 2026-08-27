'use strict';
// Master spec: "running it from the terminal spawns it there with stdout
// bound to the terminal window." Bare-name execution goes through
// programResolve like every other program, so a .exe on PATH works from
// anywhere - the vfsListSync pass in task 6 is what makes that free.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function ctxWith(files, spawnSpy) {
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'CALC.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    KERNEL_PID: 1,
    kernelSpawn: spawnSpy,
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/programs.js']);
  ctx.vfsSetTree({ dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  const tree = ctx.vfsGetTree();
  Object.entries(files).forEach(([name, text]) => tree.files.set(name, text));
  return ctx;
}

test('a bare .exe name resolves to a spawnable program entry', () => {
  const calls = [];
  const ctx = ctxWith({ 'HELLO.exe': 'PRINT hi' }, (path, argv, opts) => {
    calls.push({ path, argv: [...argv], cwd: opts.cwd });
    return Promise.resolve(55);
  });
  const hit = ctx.programResolve('HELLO.exe', '', 'C:\\sleepOS');
  assert.ok(hit, 'HELLO.exe did not resolve');
  hit.program.open({ cwd: '' });
  assert.deepStrictEqual(calls, [{ path: 'HELLO.exe', argv: [], cwd: '' }]);
});

test('the extension is optional, the way it is for built-ins', () => {
  const ctx = ctxWith({ 'HELLO.exe': 'PRINT hi' }, () => Promise.resolve(1));
  const hit = ctx.programResolve('hello', '', 'C:\\sleepOS');
  assert.ok(hit, 'bare HELLO did not resolve to HELLO.exe');
  assert.strictEqual(hit.program.name, 'HELLO.exe');
});

test('a built-in with the same bare name still wins', () => {
  const ctx = ctxWith({ 'CALC.exe': 'PRINT impostor' }, () => Promise.resolve(1));
  const hit = ctx.programResolve('calc', '', 'C:\\sleepOS');
  assert.strictEqual(ctx.programIsSystemBinary(hit.program.name), true);
});

test('a .txt does not resolve as a program', () => {
  const ctx = ctxWith({ 'notes.txt': 'hello' }, () => Promise.resolve(1));
  assert.strictEqual(ctx.programResolve('notes.txt', '', 'C:\\sleepOS'), null);
});
