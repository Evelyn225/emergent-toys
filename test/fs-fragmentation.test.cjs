'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub } = require('./helpers/load-os.cjs');

function frag() {
  const ctx = makeOsContext({
    indexedDB: makeIndexedDbStub(),
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  return ctx;
}

// Every write below runs through backend._runInWriteTransaction rather than
// calling fsWriteEntry/fsDeleteEntry directly against the one-off store
// backend._store() returns. That one-off store (os/storage-idb.js's
// _fsIdbStore) opens a BRAND NEW mini-transaction per get/put/del call, and
// the stub deliberately does not apply a transaction's writes to its backing
// store until that transaction settles on its own macrotask tick
// (test/helpers/load-os.cjs's maybeSettle/setImmediate) - modelling real
// IndexedDB's "durable only once the transaction completes" rule, per this
// codebase's own Task 4.5 hardening. Chaining bare awaits across several such
// mini-transactions races that settle: confirmed by hand that calling
// fsWriteEntry directly three times and then fsDeleteEntry for one of them
// makes fsDeleteEntry's own dirent lookup return undefined - B's write had
// not yet landed - silently turning the delete into a no-op, and the whole
// scenario into a no-op that happens to make the first test below pass for
// the wrong reason (an empty read is still "fragmentation 0"). Routing every
// step through _runInWriteTransaction is what commit() itself does in
// production, and its returned promise only resolves once the write is
// actually durable - the same guarantee the two tests below depend on to
// mean what they say.
async function step(backend, fn) {
  await backend._runInWriteTransaction(fn);
}

test('a disk of contiguous files reports no fragmentation', async () => {
  const ctx = frag();
  const backend = ctx.createIdbBackend();
  await step(backend, (store, sb) => ctx.fsWriteEntry(store, sb, 0, 'A.txt', { type: 'file', bytes: ctx.fsEncodeText('a'.repeat(9000)) }));
  await step(backend, (store, sb) => ctx.fsWriteEntry(store, sb, 0, 'B.txt', { type: 'file', bytes: ctx.fsEncodeText('b'.repeat(9000)) }));
  assert.strictEqual(ctx.fsComputeFragmentation(await backend._readInodes()), 0);
});

test('interleaved create and delete produces measurable fragmentation', async () => {
  const ctx = frag();
  // A default-sized backend (8192 blocks) never exercises this: with that
  // much free space past the third file, fsAllocBlocks' contiguous-first scan
  // (os/fs-format.js:71) always finds a fresh run beyond a one-block hole
  // rather than ever falling back to the scattered path that actually
  // produces fragmentation - confirmed by hand: with the default backend this
  // test's assertion fails because the disk it wrote is not fragmented at
  // all. A 4-block disk leaves no such escape: after B is freed, the only
  // free blocks are the hole at index 1 and the untouched tail at index 3,
  // with C sitting between them, so no contiguous run of 2 exists anywhere
  // and fsAllocBlocks must use both non-adjacent blocks it fell back to.
  const backend = ctx.createIdbBackend({ totalBlocks: 4 });
  await step(backend, (store, sb) => ctx.fsWriteEntry(store, sb, 0, 'A.txt', { type: 'file', bytes: ctx.fsEncodeText('a'.repeat(4096)) }));
  await step(backend, (store, sb) => ctx.fsWriteEntry(store, sb, 0, 'B.txt', { type: 'file', bytes: ctx.fsEncodeText('b'.repeat(4096)) }));
  await step(backend, (store, sb) => ctx.fsWriteEntry(store, sb, 0, 'C.txt', { type: 'file', bytes: ctx.fsEncodeText('c'.repeat(4096)) }));
  await step(backend, (store, sb) => ctx.fsDeleteEntry(store, sb, 0, 'B.txt'));
  await step(backend, (store, sb) => ctx.fsWriteEntry(store, sb, 0, 'D.txt', { type: 'file', bytes: ctx.fsEncodeText('d'.repeat(4096 * 2)) }));
  assert.ok(ctx.fsComputeFragmentation(await backend._readInodes()) > 0,
    'a file split across the hole and the tail is fragmented');
});
