'use strict';
// Opening a .exe showed a fabricated disassembly for every file with that
// extension. Harmless while those binaries had no source; a lie the moment a
// user can author one. The discriminator is PROGRAM_LAUNCHERS membership -
// see os/programs.js's programIsSystemBinary.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function notepadCtx() {
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'TERMINAL.exe' }, { name: 'CALC.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    wins: {},
    mkWin: () => false,
    document: undefined,
  });
  return loadOsSources(ctx, ['os/vfs.js', 'os/programs.js', 'apps/notepad.js']);
}

test('a .exe highlights as the script language', () => {
  const ctx = notepadCtx();
  assert.strictEqual(ctx.detectLang('HELLO.exe'), 'script');
  assert.strictEqual(ctx.detectLang('hello.EXE'), 'script');
});

test('.script still highlights as the script language', () => {
  const ctx = notepadCtx();
  assert.strictEqual(ctx.detectLang('demo.script'), 'script');
});

test('a plain file is unaffected', () => {
  const ctx = notepadCtx();
  assert.strictEqual(ctx.detectLang('notes.txt'), 'txt');
  assert.strictEqual(ctx.detectLang('page.html'), 'html');
});

test('a system binary routes to the decompiler', () => {
  const ctx = notepadCtx();
  assert.strictEqual(ctx.notepadRouteFor('TERMINAL.exe'), 'decompiler');
});

test('a user-authored .exe routes to the editor', () => {
  const ctx = notepadCtx();
  assert.strictEqual(ctx.notepadRouteFor('HELLO.exe'), 'editor');
});

test('routing is case-insensitive on the system side', () => {
  const ctx = notepadCtx();
  assert.strictEqual(ctx.notepadRouteFor('terminal.exe'), 'decompiler');
});

test('a non-exe always routes to the editor', () => {
  const ctx = notepadCtx();
  assert.strictEqual(ctx.notepadRouteFor('notes.txt'), 'editor');
});
