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
  // refreshSeededSystemBinaries now falls back to reportVfsError (also
  // os/fs-persist.js) when a heal write fails, but this slice does not load
  // the rest of fs-persist.js, so that name would otherwise be unresolved.
  // A recording stub here is the test's own setup, not a change to what
  // production code calls - it lets the ENOSPC test below observe the
  // report without dragging in the whole file (see the comment above this
  // function for why that drags in the whole desktop).
  ctx.__vfsReportedErrors = [];
  ctx.reportVfsError = err => { ctx.__vfsReportedErrors.push(err); };
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

test('a returning user (seed guard skipped) still gets all eight after the refresh runs', async () => {
  const ctx = fsCtxWithRefresh();
  makeReturningUserRoot(ctx);
  SYSTEM_BINARIES.forEach(name => assert.strictEqual(ctx.vfsStatSync(name, ''), null, name + ' should be absent before the refresh'));
  await ctx.refreshSeededSystemBinaries();
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
test('a binary whose content was corrupted is healed by the refresh, byte-equal to the seed', async () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  const original = tree.files.get('TERMINAL.exe');
  const beforeLen = original.length;
  tree.files.set('TERMINAL.exe', 'junk');
  assert.strictEqual(tree.files.get('TERMINAL.exe').length, 4, 'fixture is invalid: corruption did not take');
  await ctx.refreshSeededSystemBinaries();
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
test('a player script living in DOCS is untouched by the system-binary healing', async () => {
  const ctx = fsCtxWithRefresh();
  const docs = ctx.vfsGetTree().subdirs.get('DOCS');
  docs.files.set('HELLO.exe', 'print hello');
  docs.files.set('HELLO.exe', 'print hello, edited by the player');
  await ctx.refreshSeededSystemBinaries();
  assert.strictEqual(docs.files.get('HELLO.exe'), 'print hello, edited by the player',
    'refreshSeededSystemBinaries touched a file outside SYSTEM_BINARY_SOURCES - the DOCS/system-binary policies leaked into each other');
});

test('a deleted binary is restored by the refresh', async () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  const original = tree.files.get('SYSMON.exe');
  tree.files.delete('SYSMON.exe');
  assert.strictEqual(ctx.vfsStatSync('SYSMON.exe', ''), null);
  await ctx.refreshSeededSystemBinaries();
  assert.strictEqual(tree.files.get('SYSMON.exe'), original);
});

test('running the refresh twice does not duplicate or corrupt anything', async () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  await ctx.refreshSeededSystemBinaries();
  const after1 = SYSTEM_BINARIES.map(n => tree.files.get(n));
  await ctx.refreshSeededSystemBinaries();
  const after2 = SYSTEM_BINARIES.map(n => tree.files.get(n));
  assert.deepStrictEqual(after2, after1, 'a second run must be a no-op on already-present binaries');
  assert.strictEqual(tree.files.size, new Set(tree.files.keys()).size, 'file names must stay unique - a Map cannot literally duplicate a key, but this guards the invariant explicitly');
});

// The heal now goes through vfsWriteFile (os/vfs.js) instead of poking
// tree.files directly, so it queues a real 'write' op and the content ends
// up occupying actual disk blocks instead of only living in the in-memory
// tree - see the comment above refreshSeededSystemBinaries for why that
// matters to SYSMON's disk meter and DEFRAG's map. _vfsPendingOps is the
// same queue vfsFlush drains into a commit; asserting on it (rather than
// just on the tree) is what actually proves a commit was queued.
test('a fresh seed (all eight missing) queues a write op for every binary', async () => {
  const ctx = fsCtxWithRefresh();
  makeReturningUserRoot(ctx);
  assert.strictEqual(ctx._vfsPendingOps.length, 0, 'fixture is invalid: something was already queued');
  await ctx.refreshSeededSystemBinaries();
  // Array.from rebuilds the list with the host realm's Array prototype -
  // .filter/.map/.sort on a vm-context array otherwise return vm-context
  // arrays, and deepStrictEqual treats those as unequal to a host array of
  // the same values (see load-os.cjs's `plain` helper for the same gotcha).
  const writeNames = Array.from(ctx._vfsPendingOps)
    .filter(op => op.op === 'write').map(op => op.name).sort();
  assert.deepStrictEqual(writeNames, [...SYSTEM_BINARIES].sort(),
    'expected one queued write per binary, got: ' + JSON.stringify(writeNames));
});

test('a boot where all eight already match the seed queues nothing', async () => {
  const ctx = fsCtxWithRefresh();
  assert.strictEqual(ctx._vfsPendingOps.length, 0, 'fixture is invalid: something was already queued');
  await ctx.refreshSeededSystemBinaries();
  assert.strictEqual(ctx._vfsPendingOps.length, 0,
    'a boot with no corruption must not write or queue anything - comparing before writing is what keeps this cheap');
});

test('corrupting one binary queues exactly one write, not eight', async () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  tree.files.set('CALC.exe', 'junk');
  await ctx.refreshSeededSystemBinaries();
  const writes = ctx._vfsPendingOps.filter(op => op.op === 'write');
  assert.strictEqual(writes.length, 1, 'queued writes: ' + JSON.stringify(writes));
  assert.strictEqual(writes[0].name, 'CALC.exe');
});

// _vfsAssertRoom (os/vfs.js) throws ENOSPC synchronously, before vfsWriteFile
// queues anything or mutates the tree, whenever a finite quota is already
// exceeded - the same guard a genuinely full disk would hit. The catch in
// refreshSeededSystemBinaries must still leave the binary healed for this
// session and must report the failure rather than swallow it.
test('an ENOSPC on the write still leaves the in-memory content correct, and reports the failure', async () => {
  const ctx = fsCtxWithRefresh();
  const tree = ctx.vfsGetTree();
  const original = tree.files.get('TERMINAL.exe');
  tree.files.set('TERMINAL.exe', 'junk');
  ctx._vfsQuotaBytes = 1;
  ctx._vfsUsageBytes = 0;
  await ctx.refreshSeededSystemBinaries();
  assert.strictEqual(tree.files.get('TERMINAL.exe'), original,
    'a failed persist must still leave the binary healed in memory for this session');
  assert.strictEqual(ctx._vfsPendingOps.length, 0, 'a write that threw before queuing must not have queued anything');
  assert.strictEqual(ctx.__vfsReportedErrors.length, 1, 'the ENOSPC failure must be reported, not swallowed');
  assert.strictEqual(ctx.__vfsReportedErrors[0].code, 'ENOSPC');
});
