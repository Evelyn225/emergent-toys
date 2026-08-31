'use strict';
// refreshSeededDocs ran docs.files.set(name, value) unconditionally on every
// boot - it overwrote, it did not fill in. That is deliberate for reference
// text (a mangled README self-heals) and fatal for the demo executables,
// which exist to be edited: every edit would have died at the next reload
// with no message.
//
// Docs heal, programs do not.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, makeLocalStorageStub, extractFunctionSource, ROOT } = require('./helpers/load-os.cjs');

// os/fs-persist.js cannot be loaded whole in this harness - it runs
// ensureFsDir(RECYCLE_STORAGE_DIR) at parse time, which drags in os/daemon.js
// and the rest of the desktop (see test/fs-run-compaction.test.cjs and
// test/fs-unload-flush.test.cjs, which hit the same wall). refreshSeededDocs
// only needs _serDir, _desDir and the SEEDED_DOCS_DATA snapshot they build,
// so those are sliced out of the real source instead of stubbed.
const FS_PERSIST_SRC = fs.readFileSync(path.join(ROOT, 'os', 'fs-persist.js'), 'utf8');

function persistCtx() {
  const ctx = makeOsContext({
    localStorage: makeLocalStorageStub(),
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/fs-core.js']);
  ctx.__evalSource([
    extractFunctionSource(FS_PERSIST_SRC, '_serDir'),
    extractFunctionSource(FS_PERSIST_SRC, '_desDir'),
    'const SEEDED_DOCS_DATA = _serDir(vfsGetTree().subdirs.get("DOCS"));',
    extractFunctionSource(FS_PERSIST_SRC, 'refreshSeededDocs'),
  ].join('\n'), 'fs-persist:refreshSeededDocs');
  return ctx;
}

function docsNode(ctx) {
  return ctx.vfsGetTree().subdirs.get('DOCS');
}

test('an edited reference doc is restored on reseed', () => {
  const ctx = persistCtx();
  docsNode(ctx).files.set('README.txt', 'wrecked');
  ctx.refreshSeededDocs();
  assert.notStrictEqual(docsNode(ctx).files.get('README.txt'), 'wrecked',
    'reference text must self-heal');
});

test('an edited demo executable survives a reseed', () => {
  const ctx = persistCtx();
  docsNode(ctx).files.set('HELLO.exe', 'PRINT my own version');
  ctx.refreshSeededDocs();
  assert.strictEqual(docsNode(ctx).files.get('HELLO.exe'), 'PRINT my own version',
    'an edited program must not be silently reverted');
});

test('a deleted demo executable comes back fresh', () => {
  const ctx = persistCtx();
  docsNode(ctx).files.delete('HELLO.exe');
  ctx.refreshSeededDocs();
  assert.ok(docsNode(ctx).files.get('HELLO.exe'), 'a deleted program is restored');
});

// "Docs heal, programs do not" is the rule this file's header states, and
// REACTOR.script is a program: DOCS/README.txt tells the player to
// "RUN DOCS\REACTOR.script to play a terminal game". It is authored in the
// same script language as HELLO.exe and RUNAWAY.exe and is exactly the kind
// of thing a player opens and tinkers with. The predicate keyed the rule off
// `.exe` alone, so this one seeded program healed like reference text and a
// player's edits died at the next reload with no message - the precise
// outcome the header calls fatal.
test('an edited demo .script survives a reseed, like the demo .exe files', () => {
  const ctx = persistCtx();
  docsNode(ctx).files.set('REACTOR.script', '# my own version');
  ctx.refreshSeededDocs();
  assert.strictEqual(docsNode(ctx).files.get('REACTOR.script'), '# my own version',
    'an edited program must not be silently reverted, whatever extension it carries');
});

test('a deleted demo .script comes back fresh', () => {
  const ctx = persistCtx();
  docsNode(ctx).files.delete('REACTOR.script');
  ctx.refreshSeededDocs();
  assert.ok(docsNode(ctx).files.get('REACTOR.script'), 'a deleted program is restored');
});

test('both demo scripts are seeded', () => {
  const ctx = persistCtx();
  assert.ok(docsNode(ctx).files.get('HELLO.exe'), 'HELLO.exe missing');
  assert.ok(docsNode(ctx).files.get('RUNAWAY.exe'), 'RUNAWAY.exe missing');
});

test('RUNAWAY.exe actually loops rather than merely being named that', () => {
  const ctx = persistCtx();
  const src = docsNode(ctx).files.get('RUNAWAY.exe');
  assert.ok(/^\s*:\w+/m.test(src), 'no label to jump back to: ' + src);
  assert.ok(/\bGOTO\b/i.test(src), 'no GOTO: ' + src);
});

test('HELLO.exe reads, transforms and writes, so the master spec pipeline works', () => {
  const ctx = persistCtx();
  const src = docsNode(ctx).files.get('HELLO.exe');
  assert.ok(/\bPRINT\b/i.test(src), 'produces no stdout to pipe: ' + src);
  assert.ok(/#/.test(src), 'the discoverability example must be commented: ' + src);
});
