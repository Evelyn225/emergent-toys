'use strict';
// A .exe is a script, so NOTEPAD highlights it as one - the system binaries
// included, since each is a two-line launcher script (os/fs-core.js).
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

// NOTEPAD used to open a system binary in a read-only "Decompiler View" of
// invented disassembly. That view is gone: a system binary launches its
// program when double-clicked, and its file is a two-line launcher script
// that NOTEPAD shows like any other text. Guarded at the source level because
// the failure mode - the view quietly coming back through a menu item - is
// exactly the kind of thing no behavioural test here would reach.
test('no source defines or opens a decompiler view', () => {
  const fs = require('fs');
  const path = require('path');
  const { ROOT } = require('./helpers/load-os.cjs');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'split-manifest.json'), 'utf8'));
  const offenders = [];
  for (const rel of manifest) {
    fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/openDecompilerView|getExeDecompilerContent|notepadRouteFor|Decompiler View/.test(line)) {
        offenders.push(rel + ':' + (i + 1) + ': ' + line.trim());
      }
    });
  }
  assert.deepStrictEqual(offenders, [], 'the decompiler is back:\n  ' + offenders.join('\n  '));
});
