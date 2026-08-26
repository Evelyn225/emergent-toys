'use strict';
// FIX ROUND 1 for Task 9 (see task-9-report.md): making the eight system
// binaries real VFS files gave a write two unguarded paths straight into
// them - Notepad's Save/Save As (writeAndSync) and the terminal's `>` / `>>`
// redirect (writePipelineOutput) - with no recovery until the next boot's
// healing (refreshSeededSystemBinaries, see test/system-binaries.test.cjs).
// Both are refused here, before the write happens, using the same
// "protected" wording the DELETE guard (os/daemon.js) already established.
//
// FIX ROUND 2: round 1's guards checked the RAW target string against
// programIsSystemBinary, a NAME predicate that never splits a path. A
// path-qualified target ("C:\sleepOS\TERMINAL.exe", "\TERMINAL.exe",
// "C:/sleepOS/TERMINAL.exe") sailed past both guards while vfsWriteFile -
// which DOES split, via vfsSplitPath - still resolved it onto the real root
// file, so every guard test below that used only a bare filename passed
// while the real save/redirect path stayed corruptible. Both guards now
// split with vfsSplitPath first (same shape as the pre-existing DELETE
// guard, isVisibleSystemPath in os/daemon.js) and block only when the
// resolved location is root. The path-form cases below, plus the
// writePipelineOutput integration test at the bottom, are what would have
// caught round 1's gap - a guard-function test that only ever sees bare
// filenames cannot.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, extractFunctionSource } = require('./helpers/load-os.cjs');

function notepadCtx(alertCalls) {
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'TERMINAL.exe' }, { name: 'CALC.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    wins: {},
    mkWin: () => false,
    document: undefined,
    osAlert: (msg, title, icon) => { alertCalls.push({ msg, title, icon }); },
  });
  return loadOsSources(ctx, ['os/vfs.js', 'os/programs.js', 'apps/notepad.js']);
}

function terminalCtx() {
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'TERMINAL.exe' }, { name: 'CALC.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
  });
  return loadOsSources(ctx, ['os/vfs.js', 'os/programs.js', 'apps/terminal.js']);
}

// ── Notepad's save path (notepadGuardProtectedSave, writeAndSync's first
//    line) ─────────────────────────────────────────────────────────────

test("Notepad's save guard refuses a system-binary target and alerts the player", () => {
  const alertCalls = [];
  const ctx = notepadCtx(alertCalls);
  const blocked = ctx.notepadGuardProtectedSave('TERMINAL.exe');
  assert.strictEqual(blocked, true);
  assert.strictEqual(alertCalls.length, 1, 'osAlert was not called');
  assert.match(alertCalls[0].msg, /protected/i);
  assert.strictEqual(alertCalls[0].icon, 'icon:error');
});

test("Notepad's save guard is case-insensitive, matching programIsSystemBinary", () => {
  const alertCalls = [];
  const ctx = notepadCtx(alertCalls);
  assert.strictEqual(ctx.notepadGuardProtectedSave('terminal.exe'), true);
});

test("Notepad's save guard lets a player-authored .exe save normally", () => {
  const alertCalls = [];
  const ctx = notepadCtx(alertCalls);
  const blocked = ctx.notepadGuardProtectedSave('HELLO.exe');
  assert.strictEqual(blocked, false);
  assert.strictEqual(alertCalls.length, 0, 'osAlert must not fire for a non-system target');
});

test("Notepad's save guard lets an ordinary file save normally", () => {
  const alertCalls = [];
  const ctx = notepadCtx(alertCalls);
  assert.strictEqual(ctx.notepadGuardProtectedSave('notes.txt'), false);
  assert.strictEqual(alertCalls.length, 0);
});

// FIX ROUND 2: path-qualified forms of the same root target must still be
// caught - these are exactly the inputs round 1's guard let through.
[
  'C:\\sleepOS\\TERMINAL.exe',
  '\\TERMINAL.exe',
  'C:/sleepOS/TERMINAL.exe',
  'c:\\sleepos\\terminal.exe',
].forEach(target => {
  test(`Notepad's save guard blocks the path-qualified target ${JSON.stringify(target)}`, () => {
    const alertCalls = [];
    const ctx = notepadCtx(alertCalls);
    assert.strictEqual(ctx.notepadGuardProtectedSave(target), true);
    assert.strictEqual(alertCalls.length, 1);
  });
});

test("Notepad's save guard does not over-block a same-named file in a subdirectory", () => {
  const alertCalls = [];
  const ctx = notepadCtx(alertCalls);
  // DOCS\TERMINAL.exe is a different, legitimate file - not the protected
  // root binary - and must remain writable.
  assert.strictEqual(ctx.notepadGuardProtectedSave('DOCS\\TERMINAL.exe'), false);
  assert.strictEqual(alertCalls.length, 0);
});

test("Notepad's save guard resolves a bare target against the same fallback dir writeAndSync passes to vfsWriteFile", () => {
  const alertCalls = [];
  const ctx = notepadCtx(alertCalls);
  // writeAndSync calls notepadGuardProtectedSave(fname, dir || currentDir) -
  // a bare "TERMINAL.exe" while the window's current directory is DOCS
  // resolves (via vfsSplitPath, same as the real vfsWriteFile call) to
  // DOCS\TERMINAL.exe, not the protected root binary.
  assert.strictEqual(ctx.notepadGuardProtectedSave('TERMINAL.exe', 'DOCS'), false);
  assert.strictEqual(alertCalls.length, 0);
});

// ── Terminal's `>` / `>>` redirect path (terminalProtectedWriteError,
//    writePipelineOutput's second line) ─────────────────────────────────

test('the terminal redirect guard refuses to overwrite a system binary', () => {
  const ctx = terminalCtx();
  const err = ctx.terminalProtectedWriteError('TERMINAL.exe');
  assert.ok(err instanceof Error, 'expected an Error, got: ' + err);
  assert.match(err.message, /protected/i);
});

test('the terminal redirect guard is case-insensitive, matching programIsSystemBinary', () => {
  const ctx = terminalCtx();
  assert.ok(ctx.terminalProtectedWriteError('terminal.exe') instanceof Error);
});

test('the terminal redirect guard lets a player-authored .exe redirect target through', () => {
  const ctx = terminalCtx();
  assert.strictEqual(ctx.terminalProtectedWriteError('HELLO.exe'), null);
});

test('the terminal redirect guard lets an ordinary redirect target through', () => {
  const ctx = terminalCtx();
  assert.strictEqual(ctx.terminalProtectedWriteError('notes.txt'), null);
});

// FIX ROUND 2: same path-qualified cases as Notepad's guard above - these
// are what round 1's guard test suite never exercised.
[
  'C:\\sleepOS\\TERMINAL.exe',
  '\\TERMINAL.exe',
  'C:/sleepOS/TERMINAL.exe',
  'c:\\sleepos\\terminal.exe',
].forEach(target => {
  test(`the terminal redirect guard blocks the path-qualified target ${JSON.stringify(target)}`, () => {
    const ctx = terminalCtx();
    const err = ctx.terminalProtectedWriteError(target);
    assert.ok(err instanceof Error, 'expected an Error, got: ' + err);
    assert.match(err.message, /protected/i);
  });
});

test('the terminal redirect guard does not over-block a same-named file in a subdirectory', () => {
  const ctx = terminalCtx();
  assert.strictEqual(ctx.terminalProtectedWriteError('DOCS\\TERMINAL.exe'), null);
});

test("the terminal redirect guard resolves a bare target against the same cwd writePipelineOutput passes to vfsWriteFile", () => {
  const ctx = terminalCtx();
  // A bare "TERMINAL.exe" while cwd is DOCS resolves (via vfsSplitPath, same
  // as the real vfsWriteFile call) to DOCS\TERMINAL.exe, not the protected
  // root binary.
  assert.strictEqual(ctx.terminalProtectedWriteError('TERMINAL.exe', 'DOCS'), null);
});

// ── Integration: the REAL write path, not just the guard function ──────
//
// FIX ROUND 2's root cause was every existing test calling the guard
// function directly with a bare filename - the guard did what it claimed
// for the inputs it was given, but those inputs never matched what the real
// UI (Notepad's free-text Save As field, a terminal redirect) actually
// hands it. writePipelineOutput is extracted out of its openTerminal
// closure (the same extractFunctionSource trick test/system-binaries.test.cjs
// uses for refreshSeededSystemBinaries) so this drives the REAL,
// unmodified write function end to end: a path-qualified bypass target goes
// in, and the seeded root file's actual content is asserted unchanged
// afterward - not just "the guard function returned true".
function terminalWriteCtx() {
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'TERMINAL.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    cwd: '',
    // Plain pass-throughs: writePipelineOutput's two nested sibling helpers
    // (unquoteShellValue, resolveShellText) only matter for shell quoting
    // and $variable substitution, neither of which any target below uses -
    // stubbing them keeps this test from also having to load and configure
    // os/script/interp.js for a concern this bug has nothing to do with.
    unquoteShellValue: v => String(v == null ? '' : v).trim(),
    resolveShellText: t => String(t == null ? '' : t),
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/programs.js', 'os/fs-core.js']);
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps', 'terminal.js'), 'utf8');
  ctx.__evalSource(extractFunctionSource(src, 'terminalProtectedWriteError'), 'terminal-slice-guard');
  ctx.__evalSource(extractFunctionSource(src, 'writePipelineOutput'), 'terminal-slice-write');
  return ctx;
}

test('writePipelineOutput refuses a path-qualified bypass and leaves the real binary unchanged', async () => {
  const ctx = terminalWriteCtx();
  const original = ctx.vfsGetTree().files.get('TERMINAL.exe');
  assert.strictEqual(original.length, 309, 'fixture assumption changed - update the expected length');

  for (const target of ['C:\\sleepOS\\TERMINAL.exe', '\\TERMINAL.exe', 'C:/sleepOS/TERMINAL.exe']) {
    await assert.rejects(
      () => ctx.writePipelineOutput(target, ['junk'], false),
      /protected/i,
      target + ' did not throw',
    );
    assert.strictEqual(ctx.vfsGetTree().files.get('TERMINAL.exe'), original,
      target + ' changed the real TERMINAL.exe content');
  }
});

test('writePipelineOutput still writes a same-named file in a subdirectory', async () => {
  const ctx = terminalWriteCtx();
  const rootBefore = ctx.vfsGetTree().files.get('TERMINAL.exe');
  const saved = await ctx.writePipelineOutput('DOCS\\TERMINAL.exe', ['hi'], false);
  assert.strictEqual(saved.dirName, 'DOCS');
  assert.strictEqual(ctx.vfsGetTree().subdirs.get('DOCS').files.get('TERMINAL.exe'), 'hi');
  assert.strictEqual(ctx.vfsGetTree().files.get('TERMINAL.exe'), rootBefore,
    'writing DOCS\\TERMINAL.exe must not touch the root binary');
});
