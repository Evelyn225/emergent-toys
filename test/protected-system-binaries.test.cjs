'use strict';
// FIX ROUND 1 for Task 9 (see task-9-report.md): making the eight system
// binaries real VFS files gave a write two unguarded paths straight into
// them - Notepad's Save/Save As (writeAndSync) and the terminal's `>` / `>>`
// redirect (writePipelineOutput) - with no recovery until the next boot's
// healing (refreshSeededSystemBinaries, see test/system-binaries.test.cjs).
// Both are refused here, before the write happens, using the same
// "protected" wording the DELETE guard (os/daemon.js) already established.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

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
