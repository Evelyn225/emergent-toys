'use strict';
// Phase 6 turns the eight system .exe rows from authored metadata into real
// seeded files. Since phase 4 DIR has rendered measured sizes off the
// superblock for everything else, so eight hardcoded sizes sitting next to
// them is the same defect phase 5b deleted from the process table.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function fsCtx() {
  const ctx = makeOsContext({
    localStorage: undefined,
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
  });
  return loadOsSources(ctx, ['os/vfs.js', 'os/fs-core.js']);
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
