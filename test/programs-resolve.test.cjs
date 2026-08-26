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
    // `emoji` is carried by the real PROJECTS entries but is never read by
    // os/programs.js, so these are placeholders rather than the real glyphs.
    PROJECTS: [
      { name: 'sand playground', emoji: 'x', file: 'evenet.fun/Sands.html' },
      { name: 'fireworks', emoji: 'x', file: 'fireworks.html' },
    ],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
  }, overrides || {}));
  return loadOsSources(ctx, ['os/vfs.js', 'os/programs.js']);
}

const DEFAULT_PATH = 'C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]';

test('the current directory is searched before PATH', () => {
  const ctx = programs();
  // PATH lists PROJECTS first, but cwd is the root, so the root wins.
  const hit = ctx.programResolve('CALC.exe', '', 'C:\\sleepOS\\PROJECTS;C:\\sleepOS');
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
  assert.strictEqual(ctx.programResolve('NOTEPAD.exe', 'DOCS', 'C:\\sleepOS\\PROJECTS'), null);
});

test('.exe is appended when the literal name does not match, case-insensitively', () => {
  const ctx = programs();
  assert.strictEqual(ctx.programResolve('notepad', '', DEFAULT_PATH).program.name, 'NOTEPAD.exe');
  assert.strictEqual(ctx.programResolve('NoTePaD.ExE', '', DEFAULT_PATH).program.name, 'NOTEPAD.exe');
});

test('PATH order decides which directory wins when cwd holds neither', () => {
  const ctx = programs();
  const hit = ctx.programResolve('fireworks', 'DOCS', DEFAULT_PATH);
  assert.strictEqual(hit.via, 'path');
  assert.strictEqual(hit.dir, 'PROJECTS');
});

test('unreal PATH entries are kept and resolve nothing', () => {
  const ctx = programs();
  assert.deepStrictEqual(plain(ctx.programPathDirs(DEFAULT_PATH)), ['', 'PROJECTS', '[REDACTED]']);
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

test('projects resolve by name, hyphenated name, file, and file minus .html', () => {
  const ctx = programs();
  const forms = ['sand playground', 'sand-playground', 'evenet.fun/Sands.html', 'evenet.fun/Sands'];
  forms.forEach(form => {
    const hit = ctx.programResolve(form, 'PROJECTS', DEFAULT_PATH);
    assert.ok(hit, 'expected ' + form + ' to resolve');
    assert.strictEqual(hit.program.name, 'sand playground');
  });
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
  assert.strictEqual(ctx.programDisplayDir('PROJECTS'), 'C:\\sleepOS\\PROJECTS');
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
// pulls in PROJECTS/RECYCLE_BIN_NAME/localStorage machinery) these tests
// don't want.
function programsWithFiles(files) {
  const ctx = programs();
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
  const names = ctx.programsInDir('').filter(n => n.name.toLowerCase() === 'calc.exe');
  assert.strictEqual(names.length, 1, 'the built-in must win, exactly once');
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
