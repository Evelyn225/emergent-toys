'use strict';
// Phase 6 turns the eight system .exe rows from authored metadata into real
// seeded files. Since phase 4 DIR has rendered measured sizes off the
// superblock for everything else, so eight hardcoded sizes sitting next to
// them is the same defect phase 5b deleted from the process table.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, extractFunctionSource } = require('./helpers/load-os.cjs');

function fsCtx() {
  const ctx = makeOsContext({
    localStorage: undefined,
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
  });
  return loadOsSources(ctx, ['os/vfs.js', 'os/fs-core.js']);
}

// os/fs-persist.js runs loadDriveState() and ensureFsDir() at parse time and
// drags in the whole desktop (see test/fs-boot-backend.test.cjs's boot()),
// so refreshSeededSystemBinaries is read out of the source and evaluated
// directly, the same trick that test uses for fsChooseBackend.
function fsCtxWithRefresh() {
  const ctx = fsCtx();
  const src = fs.readFileSync(path.join(__dirname, '..', 'os', 'fs-persist.js'), 'utf8');
  ctx.__evalSource(extractFunctionSource(src, 'refreshSeededSystemBinaries'), 'fs-persist-slice');
  return ctx;
}

const SYSTEM_BINARIES = [
  'TERMINAL.exe', 'SYSMON.exe', 'NOTEPAD.exe', 'BROWSER.exe',
  'DEFRAG.exe', 'CALC.exe', 'REGEDIT.exe', 'EXPLORER.exe',
];

test('every system binary is seeded as a real root text file', () => {
  const ctx = fsCtx();
  SYSTEM_BINARIES.forEach(name => {
    const st = ctx.vfsStatSync(name, '');
    assert.ok(st, name + ' is not a file');
    assert.strictEqual(st.kind, 'text', name + ' must be a text file, not a blob');
  });
});

test('a system binary has a measured non-zero size', () => {
  const ctx = fsCtx();
  SYSTEM_BINARIES.forEach(name => {
    const st = ctx.vfsStatSync(name, '');
    assert.ok(st.size > 0, name + ' has size ' + st.size);
  });
});

test('sizes are measured, not the old authored constants', () => {
  const ctx = fsCtx();
  // The old table gave every binary exactly 4096 or 8192. Real content will
  // not land on those by accident, and if it ever did the number would still
  // be measured rather than asserted, so this checks the shape that matters:
  // the sizes are not all drawn from that two-value set.
  const sizes = SYSTEM_BINARIES.map(n => ctx.vfsStatSync(n, '').size);
  assert.ok(sizes.some(s => s !== 4096 && s !== 8192), 'sizes look authored: ' + JSON.stringify(sizes));
});

test('story pseudo-files are NOT seeded - their existence is conditional', () => {
  const ctx = fsCtx();
  ['void.tmp', 'daemon.core', '?????.exe'].forEach(name => {
    assert.strictEqual(ctx.vfsStatSync(name, ''), null, name + ' must stay registry-only');
  });
});

test('a system binary reads back the content it was seeded with', () => {
  const ctx = fsCtx();
  const tree = ctx.vfsGetTree();
  const text = tree.files.get('TERMINAL.exe');
  assert.ok(/section \.text/.test(text), 'expected a disassembly listing, got: ' + String(text).slice(0, 80));
});

// vfsBootMount's seed callback only fires `if (!root.dirs.size &&
// !root.files.size)` - a completely empty root. Anyone who has booted
// sleepOS before has a persisted root with content, so that guard is always
// skipped for them and the eight binaries never get seeded by vfsSeedTree.
// refreshSeededSystemBinaries (os/fs-persist.js) is what restores them on
// every boot regardless of that guard.
function makeReturningUserRoot(ctx) {
  const tree = ctx.vfsGetTree();
  // Simulate a root persisted before phase 6: the eight binaries were never
  // written, but the root plainly has content (DOCS, DESKTOP), so the seed
  // guard would have been skipped for this user.
  SYSTEM_BINARIES.forEach(name => tree.files.delete(name));
  assert.ok(tree.dirs.size > 0 || tree.files.size > 0,
    'fixture is invalid: an empty root would hit the seed guard instead of the returning-user path this test targets');
  return tree;
}

test('a returning user (seed guard skipped) still gets all eight after the refresh runs', () => {
  const ctx = fsCtxWithRefresh();
  makeReturningUserRoot(ctx);
  SYSTEM_BINARIES.forEach(name => assert.strictEqual(ctx.vfsStatSync(name, ''), null, name + ' should be absent before the refresh'));
  ctx.refreshSeededSystemBinaries();
  SYSTEM_BINARIES.forEach(name => assert.ok(ctx.vfsStatSync(name, ''), name + ' was not restored by the refresh'));
});

// FIX ROUND 1 (task-9-report.md): a system binary corrupted by a write that
// got past notepadGuardProtectedSave/terminalProtectedWriteError (or reached
// the tree some other way) used to stay corrupted forever - fill-if-absent
// only refills an ABSENT file, and nothing else in the OS can repair one that
// exists with the wrong content. This flips the policy to heal, the same way
// refreshSeededDocs already treats README.txt: on the next boot, a binary's
// content is restored to SYSTEM_BINARY_SOURCES whenever it does not match,
// corrupted or merely missing.
test('a binary whose content was corrupted is healed by the refresh, byte-equal to the seed', () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  const original = tree.files.get('TERMINAL.exe');
  const beforeLen = original.length;
  tree.files.set('TERMINAL.exe', 'junk');
  assert.strictEqual(tree.files.get('TERMINAL.exe').length, 4, 'fixture is invalid: corruption did not take');
  ctx.refreshSeededSystemBinaries();
  const healed = tree.files.get('TERMINAL.exe');
  assert.strictEqual(healed, original, 'refreshSeededSystemBinaries must heal a corrupted binary back to its seeded content');
  assert.strictEqual(healed.length, beforeLen, 'healed length: ' + healed.length + ', seeded length: ' + beforeLen);
});

// The healing above must stay scoped to exactly the eight SYSTEM_BINARY_SOURCES
// keys. A player-authored script sitting in DOCS - the .exe/.script files
// phase 6 lets a player write and re-edit, per test/programs-resolve.test.cjs's
// "the demo scripts live in DOCS" - is not one of those keys, so this proves
// the two policies (system binaries heal, everything else does not) stayed
// separate rather than the healing sweep leaking onto player content.
test('a player script living in DOCS is untouched by the system-binary healing', () => {
  const ctx = fsCtxWithRefresh();
  const docs = ctx.vfsGetTree().subdirs.get('DOCS');
  docs.files.set('HELLO.exe', 'print hello');
  docs.files.set('HELLO.exe', 'print hello, edited by the player');
  ctx.refreshSeededSystemBinaries();
  assert.strictEqual(docs.files.get('HELLO.exe'), 'print hello, edited by the player',
    'refreshSeededSystemBinaries touched a file outside SYSTEM_BINARY_SOURCES - the DOCS/system-binary policies leaked into each other');
});

test('a deleted binary is restored by the refresh', () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  const original = tree.files.get('SYSMON.exe');
  tree.files.delete('SYSMON.exe');
  assert.strictEqual(ctx.vfsStatSync('SYSMON.exe', ''), null);
  ctx.refreshSeededSystemBinaries();
  assert.strictEqual(tree.files.get('SYSMON.exe'), original);
});

test('running the refresh twice does not duplicate or corrupt anything', () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  ctx.refreshSeededSystemBinaries();
  const after1 = SYSTEM_BINARIES.map(n => tree.files.get(n));
  ctx.refreshSeededSystemBinaries();
  const after2 = SYSTEM_BINARIES.map(n => tree.files.get(n));
  assert.deepStrictEqual(after2, after1, 'a second run must be a no-op on already-present binaries');
  assert.strictEqual(tree.files.size, new Set(tree.files.keys()).size, 'file names must stay unique - a Map cannot literally duplicate a key, but this guards the invariant explicitly');
});
