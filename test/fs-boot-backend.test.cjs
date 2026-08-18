'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, makeLocalStorageStub, makeIndexedDbStub, extractFunctionSource } = require('./helpers/load-os.cjs');

// fsChooseBackend lives in os/fs-persist.js, which runs loadFS() at parse
// time and drags in the whole desktop. Declaring the same function here
// would test a copy. Instead the real one is read out of the source and
// evaluated in this context - the same trick test/load-os-harness.test.cjs
// uses to reach into a module without booting it. extractFunctionSource
// (test/helpers/load-os.cjs) does the actual slicing; see it for why a
// brace-depth scan is used instead of a textual guess.
function boot(overrides) {
  const ctx = makeOsContext(Object.assign({
    localStorage: makeLocalStorageStub(),
    indexedDB: makeIndexedDbStub(),
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  }, overrides || {}));
  loadOsSources(ctx, [
    'os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js', 'os/fs-migrate.js', 'os/storage-local.js',
  ]);
  const src = fs.readFileSync(path.join(__dirname, '..', 'os', 'fs-persist.js'), 'utf8');
  ctx.__evalSource(extractFunctionSource(src, 'fsChooseBackend'), 'fs-persist-slice');
  return ctx;
}

test('IndexedDB is chosen when it is available', async () => {
  const ctx = boot();
  const chosen = await ctx.fsChooseBackend();
  assert.strictEqual(chosen.kind, 'idb');
  assert.strictEqual(chosen.backend.needsSnapshot, false);
});

test('a missing IndexedDB falls back to localStorage rather than failing to boot', async () => {
  const ctx = boot({ indexedDB: undefined });
  const chosen = await ctx.fsChooseBackend();
  assert.strictEqual(chosen.kind, 'local');
  // The localStorage backend has always wanted a snapshot, and must keep
  // getting one or every write it makes would be empty.
  assert.notStrictEqual(chosen.backend.needsSnapshot, false);
});

test('a database that refuses to open falls back rather than throwing', async () => {
  const angry = { open() { const r = { onerror: null, onsuccess: null }; Promise.resolve().then(() => r.onerror && r.onerror({ target: r })); return r; },
                  deleteDatabase() { const r = { onerror: null, onsuccess: null }; Promise.resolve().then(() => r.onsuccess && r.onsuccess({ target: r })); return r; } };
  const ctx = boot({ indexedDB: angry });
  const chosen = await ctx.fsChooseBackend();
  assert.strictEqual(chosen.kind, 'local');
});

test('a migration that fails mid-import falls back to localStorage rather than surfacing the failure', async () => {
  // Give localStorage a real legacy tree to import - with nothing to
  // migrate, fsMigrateFromLocalStorage takes the "nothing-to-migrate" exit
  // and never touches the import transaction this test needs to fail.
  const localStorage = makeLocalStorageStub();
  localStorage.setItem('sleepOS-fs', JSON.stringify({
    dirs: [], files: { 'hello.txt': 'hi' }, subdirs: {},
  }));
  const indexedDB = makeIndexedDbStub();
  const ctx = boot({ localStorage, indexedDB });
  // Write #1 is the superblock ensure() creates on the fresh database, made
  // by fsChooseBackend's own backend._store() call before migration ever
  // runs. Write #2 is therefore the first write inside the import's single
  // transaction - failing it fails the whole atomic import.
  indexedDB._failNthWriteFromNow(2);
  const chosen = await ctx.fsChooseBackend();
  assert.strictEqual(chosen.kind, 'local');
  assert.notStrictEqual(chosen.backend.needsSnapshot, false);
});
