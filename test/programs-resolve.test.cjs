'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

// Every deepStrictEqual below wraps its vm-side value in plain(). Arrays and
// objects built inside the vm context carry THAT realm's prototypes, and
// deepStrictEqual compares prototypes, so comparing one against a plain host
// literal fails on the prototype before it ever looks at the contents. See the
// note above plain() in test/helpers/load-os.cjs.

// os/vfs.js is loaded for real rather than stubbed: programPathDirs delegates
// to vfsNormalizeDir on purpose, and a stub would let the two readings of a
// path drift, which is the exact bug the delegation exists to prevent.
function programs(overrides) {
  const ctx = makeOsContext(Object.assign({
    ROOT_SYSTEM_FILE_META: [
      { name: 'TERMINAL.exe', size: '4,096', date: '11/13/2024  10:31' },
      { name: 'NOTEPAD.exe', size: '4,096', date: '11/13/2024  10:31' },
      { name: 'CALC.exe', size: '4,096', date: '11/13/2024  10:31' },
    ],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
  }, overrides || {}));
  return loadOsSources(ctx, ['os/vfs.js', 'os/programs.js']);
}

const DEFAULT_PATH = 'C:\\sleepOS;[redacted]';

test('the current directory is searched before PATH', () => {
  const ctx = programs();
  // PATH lists DOCS first, but cwd is the root, so the root wins.
  const hit = ctx.programResolve('CALC.exe', '', 'C:\\sleepOS\\DOCS;C:\\sleepOS');
  assert.strictEqual(hit.via, 'cwd');
  assert.strictEqual(hit.dir, '');
  assert.strictEqual(hit.program.name, 'CALC.exe');
});

test('a root program still resolves from the root with PATH emptied', () => {
  const ctx = programs();
  const hit = ctx.programResolve('?????.exe', '', '');
  assert.ok(hit, 'story programs must stay reachable from their own directory');
  assert.strictEqual(hit.via, 'cwd');
});

test('a root program does not resolve from elsewhere once PATH drops the root', () => {
  const ctx = programs();
  assert.ok(ctx.programResolve('NOTEPAD.exe', 'DOCS', DEFAULT_PATH), 'default PATH lists the root');
  assert.strictEqual(ctx.programResolve('NOTEPAD.exe', 'DOCS', 'C:\\sleepOS\\CACHE'), null);
});

test('.exe is appended when the literal name does not match, case-insensitively', () => {
  const ctx = programs();
  assert.strictEqual(ctx.programResolve('notepad', '', DEFAULT_PATH).program.name, 'NOTEPAD.exe');
  assert.strictEqual(ctx.programResolve('NoTePaD.ExE', '', DEFAULT_PATH).program.name, 'NOTEPAD.exe');
});

test('unreal PATH entries are kept and resolve nothing', () => {
  const ctx = programs();
  assert.deepStrictEqual(plain(ctx.programPathDirs(DEFAULT_PATH)), ['', '[REDACTED]']);
  assert.strictEqual(ctx.programsInDir('[REDACTED]').length, 0);
});

test('an empty PATH segment does not silently splice in the root', () => {
  const ctx = programs();
  // vfsNormalizeDir('') is the root directory, so a trailing semicolon would
  // otherwise leave every root program resolvable from DOCS and make a
  // deliberately narrowed PATH look like it had no effect at all.
  assert.deepStrictEqual(plain(ctx.programPathDirs('C:\\sleepOS\\DOCS;')), ['DOCS']);
  assert.deepStrictEqual(plain(ctx.programPathDirs(';;')), []);
  assert.strictEqual(ctx.programResolve('NOTEPAD.exe', 'DOCS', 'C:\\sleepOS\\DOCS;'), null);
});

test('a duplicated PATH entry is searched once', () => {
  const ctx = programs();
  assert.deepStrictEqual(plain(ctx.programPathDirs('C:\\sleepOS;C:\\sleepOS\\;C:\\sleepOS')), ['']);
});

test('void.tmp leaves the root set once the ending is reached', () => {
  const before = programs();
  assert.ok(before.programResolve('void.tmp', '', DEFAULT_PATH));
  const after = programs({ daemonStory: { endingReached: true, stage: 9 } });
  assert.strictEqual(after.programResolve('void.tmp', '', DEFAULT_PATH), null);
  assert.ok(after.programResolve('daemon.core', '', DEFAULT_PATH), 'daemon.core survives the ending');
});

test('programFindAnywhere ignores PATH so the terminal can explain a miss', () => {
  const ctx = programs();
  const found = ctx.programFindAnywhere('CALC.exe');
  assert.strictEqual(found.dir, '');
  assert.strictEqual(ctx.programDisplayDir(found.dir), 'C:\\sleepOS');
  assert.strictEqual(ctx.programDisplayDir('DOCS'), 'C:\\sleepOS\\DOCS');
  assert.strictEqual(ctx.programFindAnywhere('NOSUCH.exe'), null);
});

test('an unknown directory has no programs', () => {
  const ctx = programs();
  assert.deepStrictEqual(plain(ctx.programsInDir('DOCS')), []);
});

// ── Phase 6: user-authored executables ───────────────────────────
// programsInDir gained a vfsListSync pass so a .exe in the VFS resolves the
// same way a built-in does. The seam comment at os/programs.js:39 predicted
// this: `open` is a closure rather than a name precisely so a spawned .exe
// and a built-in window can share one table.

// The programs() helper above stubs nothing filesystem-side. os/vfs.js
// declares `var _vfsRoot = null` and only os/fs-core.js ever sets it, so a
// context that loads just vfs.js + programs.js (as programs() does) has no
// tree at all - vfsGetTree() returns null. Install one explicitly here
// rather than loading os/fs-core.js, which seeds a whole filesystem (and
// pulls in RECYCLE_BIN_NAME/localStorage machinery) these tests
// don't want.
function programsWithFiles(files, overrides) {
  const ctx = programs(overrides);
  ctx.vfsSetTree({ dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  const tree = ctx.vfsGetTree();
  Object.entries(files).forEach(([dir, entries]) => {
    if (dir === '') {
      Object.entries(entries).forEach(([name, text]) => tree.files.set(name, text));
      return;
    }
    tree.dirs.add(dir);
    const node = { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() };
    Object.entries(entries).forEach(([name, text]) => node.files.set(name, text));
    tree.subdirs.set(dir, node);
  });
  return ctx;
}

test('a .exe text file in the root shows up as a program', () => {
  const ctx = programsWithFiles({ '': { 'HELLO.exe': 'PRINT hi' } });
  const names = ctx.programsInDir('').map(e => e.name);
  assert.ok(names.includes('HELLO.exe'), 'got: ' + JSON.stringify(names));
});

test('a .exe in a subdirectory resolves there - the demo scripts live in DOCS', () => {
  const ctx = programsWithFiles({ DOCS: { 'RUNAWAY.exe': ':l\nGOTO l' } });
  // .map() runs the vm realm's Array.prototype.map, so the result is a
  // vm-realm array - plain() strips that before comparing to a host literal,
  // same as every other deepStrictEqual in this file (see header comment).
  const names = plain(ctx.programsInDir('DOCS').map(e => e.name));
  assert.deepStrictEqual(names, ['RUNAWAY.exe']);
});

test('a non-executable file is not a program', () => {
  const ctx = programsWithFiles({ '': { 'notes.txt': 'hello' } });
  const names = ctx.programsInDir('').map(e => e.name);
  assert.ok(!names.includes('notes.txt'), 'got: ' + JSON.stringify(names));
});

test('a VFS .exe does not duplicate a built-in of the same name', () => {
  const ctx = programsWithFiles({ '': { 'CALC.exe': 'PRINT not the real one' } });
  const survivors = ctx.programsInDir('').filter(n => n.name.toLowerCase() === 'calc.exe');
  assert.strictEqual(survivors.length, 1, 'the built-in must win, exactly once');
  // Both entries share the same name, so checking the name alone would pass
  // even if the VFS fake displaced the built-in. programEntry('CALC.exe', '')
  // returns the built-in with `open: spec.open` - the very PROGRAM_LAUNCHERS
  // function reference - while programVfsEntry builds a fresh closure per
  // call, so reference equality on `open` is what actually tells the built-in
  // apart from the fake.
  const builtIn = ctx.programEntry('CALC.exe', '');
  assert.strictEqual(survivors[0].open, builtIn.open, 'the survivor must be the real built-in, not the VFS fake');
});

test('a VFS .exe found via PATH from a different cwd spawns in its own directory, not the caller\'s', () => {
  // Regression for a bug in the original brief: open() preferred ctx.cwd over
  // stat.dirName, which happened to look correct from the root only because
  // '' is falsy and `||` fell through to stat.dirName by accident. Standing
  // anywhere else (a non-empty cwd) exposed it - kernelSpawn's `cwd` option is
  // the SEARCH directory for a bare filename, so a program resolved via PATH
  // out of DOCS must still spawn with cwd DOCS, not wherever the caller stood.
  const spawnCalls = [];
  const ctx = programsWithFiles({ DOCS: { 'HELLO.exe': 'PRINT hi' } }, {
    kernelSpawn: (name, argv, opts) => { spawnCalls.push({ name, opts }); return Promise.resolve('spawned'); },
    KERNEL_PID: 0,
  });
  const hit = ctx.programResolve('HELLO.exe', 'CACHE', 'C:\\sleepOS\\DOCS');
  assert.strictEqual(hit.via, 'path');
  assert.strictEqual(hit.dir, 'DOCS');
  hit.program.open({ cwd: 'CACHE' });
  assert.strictEqual(spawnCalls.length, 1);
  assert.strictEqual(spawnCalls[0].opts.cwd, 'DOCS', 'must spawn where the file lives, not the caller\'s cwd');
});

test('a spawn rejection surfaces through osAlert, not silently', async () => {
  // Regression for fix-round-2: open()'s .catch used to report only via
  // console.error, which is invisible in this browser toy (no visible
  // console). osAlert is the established convention for this failure class -
  // os/run-dialog.js:62 uses it for "Cannot Find Program" - so a spawn
  // failure (file deleted between listing and launch, worker failed to
  // start, ...) must reach the player the same way.
  const alertCalls = [];
  const ctx = programsWithFiles({ '': { 'HELLO.exe': 'PRINT hi' } }, {
    kernelSpawn: () => Promise.reject(new Error('script not found: HELLO.exe')),
    KERNEL_PID: 0,
    osAlert: (msg, title, icon) => { alertCalls.push({ msg, title, icon }); },
  });
  const hello = ctx.programsInDir('').find(e => e.name === 'HELLO.exe');
  // open() returns kernelSpawn(...).catch(...) directly, so awaiting it waits
  // for the catch handler to actually run - no separate tick-flush needed,
  // and it doubles as proof the rejection is handled rather than escaping
  // as an unhandled rejection (node's test runner would fail the process on
  // that).
  await hello.open();
  assert.strictEqual(alertCalls.length, 1);
  assert.ok(alertCalls[0].msg.includes('HELLO.exe'), 'got: ' + alertCalls[0].msg);
  assert.strictEqual(alertCalls[0].icon, 'icon:error');
});

test('programIsSystemBinary knows the built-ins and nothing else', () => {
  const ctx = programs();
  assert.strictEqual(ctx.programIsSystemBinary('TERMINAL.exe'), true);
  assert.strictEqual(ctx.programIsSystemBinary('terminal.exe'), true);
  assert.strictEqual(ctx.programIsSystemBinary('terminal'), true);
  assert.strictEqual(ctx.programIsSystemBinary('HELLO.exe'), false);
  assert.strictEqual(ctx.programIsSystemBinary(''), false);
  assert.strictEqual(ctx.programIsSystemBinary(null), false);
});

test('every entry programsInDir yields is launchable', () => {
  const ctx = programsWithFiles({ '': { 'HELLO.exe': 'PRINT hi' } });
  ctx.programsInDir('').forEach(entry => {
    assert.strictEqual(typeof entry.open, 'function', entry.name + ' has no open');
  });
});

test('programIsExecutableEntry accepts a program and rejects a bare file entry', () => {
  const ctx = programsWithFiles({ '': { 'HELLO.exe': 'PRINT hi' } });
  const hello = ctx.programsInDir('').find(e => e.name === 'HELLO.exe');
  assert.strictEqual(ctx.programIsExecutableEntry(hello), true);
  assert.strictEqual(ctx.programIsExecutableEntry({ name: 'notes.txt' }), false);
  assert.strictEqual(ctx.programIsExecutableEntry(null), false);
});
