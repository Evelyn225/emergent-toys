'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, extractFunctionSource } = require('./helpers/load-os.cjs');

const FS_PERSIST_SRC = fs.readFileSync(path.join(__dirname, '..', 'os', 'fs-persist.js'), 'utf8');

// os/fs-persist.js runs loadFS() at parse time and drags in the whole desktop,
// so it cannot be loaded in this harness. The pieces these tests need are read
// out of the real source and evaluated in the context instead - the same trick
// test/fs-boot-backend.test.cjs uses for fsChooseBackend. None of these three
// functions contains a brace inside a string, comment, or regex literal, which
// is extractFunctionSource's standing precondition.
const SLICED = ['fsGetActiveBackendKind', 'fsFlushOnHidden', 'fsSnapshotOnUnload'];

// The addEventListener calls live at top level, outside any function, so
// extractFunctionSource cannot reach them. Matching them as source text and
// evaluating them is what lets these tests dispatch REAL events through the
// REAL wiring: calling the handlers directly would pass just as happily with
// both of them registered to nothing at all.
const WIRING_RE =
  /^(?:document|window)\.addEventListener\('(?:visibilitychange|beforeunload)', fs[A-Za-z]+\);[ \t]*\r?$/gm;

async function boot(backendKind) {
  const ctx = loadOsSources(makeOsContext(), [
    // storage-local.js is here only for LOCAL_FS_KEY, which fsSnapshotOnUnload
    // reads. It is a `const`, so it never becomes a context property, but a
    // later script run in the same context still resolves the identifier.
    'os/vfs.js', 'os/storage-mem.js', 'os/storage-local.js',
  ]);
  SLICED.forEach(name => {
    ctx.__evalSource(extractFunctionSource(FS_PERSIST_SRC, name), 'fs-persist:' + name);
  });
  const wiring = FS_PERSIST_SRC.match(WIRING_RE) || [];
  assert.strictEqual(wiring.length, 2,
    'os/fs-persist.js should register both a visibilitychange and a beforeunload handler, ' +
    'each as a named top-level function; found: ' + JSON.stringify(wiring));
  ctx.__evalSource(wiring.join('\n'), 'fs-persist:wiring');

  // The `var` declaration this getter reads lives outside the slice, so set
  // the global directly. fsChooseBackend assigns it the same way at boot.
  ctx.fsActiveBackendKind = backendKind;
  ctx.document.visibilityState = 'visible';

  const backend = ctx.createMemStorage();
  await ctx.vfsMount(backend, {});
  return { ctx, backend };
}

// One setImmediate drains the entire microtask queue, however many awaits the
// commit chain nests - the same reasoning makeIndexedDbStub's maybeSettle uses.
// vfsFlush is fire-and-forget from the handler, so there is no promise to hold.
function settled() {
  return new Promise(resolve => setImmediate(resolve));
}

test('going hidden commits writes still sitting behind the debounce', async () => {
  const { ctx, backend } = await boot('idb');
  await ctx.vfsWriteFile('NOTES.txt', 'unsaved', '');
  assert.strictEqual(ctx.vfsHasPendingWrites(), true);
  assert.strictEqual(backend._snapshot, null, 'the 400ms debounce should not have fired yet');

  ctx.document.visibilityState = 'hidden';
  ctx.document.dispatchEvent({ type: 'visibilitychange' });
  await settled();

  // Assert against the backend, not vfsHasPendingWrites(): the queue is
  // drained the moment vfsFlush starts, long before anything is durable.
  assert.strictEqual(backend._snapshot.files['NOTES.txt'], 'unsaved');
});

test('becoming visible again does not commit', async () => {
  const { ctx, backend } = await boot('idb');
  await ctx.vfsWriteFile('NOTES.txt', 'unsaved', '');

  ctx.document.dispatchEvent({ type: 'visibilitychange' });
  await settled();

  assert.strictEqual(backend._snapshot, null,
    'a tab regaining focus is not a reason to commit early');
});

test('the unload snapshot leaves the pre-migration recovery key alone under IndexedDB', async () => {
  const { ctx } = await boot('idb');
  // What os/fs-migrate.js deliberately leaves behind for one release: the
  // phase-2 filesystem, frozen, as the path back if the database is ever lost.
  // FS_MIGRATE_SOURCE_KEY and LOCAL_FS_KEY are the same string, so an ungated
  // unload write lands right on top of it - and vfsSerializeTree is text-only,
  // so what it lands with has every blob stripped out.
  const frozen = JSON.stringify({
    dirs: ['DOCS'],
    files: { 'OLD.txt': 'pre-migration' },
    subdirs: {},
  });
  ctx.localStorage.setItem('sleepOS-fs', frozen);

  await ctx.vfsWriteFile('NEW.txt', 'post-migration', '');
  assert.strictEqual(ctx.vfsHasPendingWrites(), true);
  ctx.dispatchEvent({ type: 'beforeunload' });

  assert.strictEqual(ctx.localStorage.getItem('sleepOS-fs'), frozen,
    'the recovery snapshot must survive a tab close byte-for-byte');
});

test('the unload snapshot still writes under the localStorage backend', async () => {
  const { ctx } = await boot('local');
  await ctx.vfsWriteFile('NEW.txt', 'unsaved', '');

  ctx.dispatchEvent({ type: 'beforeunload' });

  // localStorage is a live fallback - private browsing, disabled storage, a
  // database that refuses to open - and a synchronous setItem on unload is the
  // best save that path has. Gating the handler must not take it away.
  const saved = JSON.parse(ctx.localStorage.getItem('sleepOS-fs'));
  assert.strictEqual(saved.files['NEW.txt'], 'unsaved');
});
