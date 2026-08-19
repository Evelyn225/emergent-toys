'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub } = require('./helpers/load-os.cjs');

// Prerequisite hardening for Task 9 (blocks become the primary blob store).
// os/vfs.js's _vfsReadEntryForCommit fetches a blob's object URL to get its
// bytes for the commit. If that fetch throws (a revoked or dead URL), the old
// code fell back to `bytes = new Uint8Array(0)` and persisted that as if it
// were the file's real content - indistinguishable from a genuinely empty
// blob, and capable of overwriting an existing entry's real blocks with
// nothing. That was tolerable while the block layer was a secondary copy;
// once it is the primary (and, for large files, ALREADY the only durable
// copy - see test/blob-store-persist.test.cjs), silently writing zero bytes
// over real content destroys it.
function mountedIdb(overrides) {
  const stub = makeIndexedDbStub();
  const ctx = makeOsContext(Object.assign({
    indexedDB: stub,
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  return { ctx, stub };
}

test('a blob whose object URL cannot be fetched is not persisted as a zero-byte file, and reaches onError', async () => {
  const { ctx } = mountedIdb({
    fetch: async () => { throw new Error('NetworkError: revoked object URL'); },
  });
  const backend = ctx.createIdbBackend();
  const errors = [];
  await ctx.vfsMount(backend, { onError: e => errors.push(e) });

  await ctx.vfsWriteBlob('pic.png', { url: 'blob:dead', kind: 'image', size: 4, mime: 'image/png' }, '');
  await ctx.vfsFlush();

  assert.strictEqual(errors.length, 1, 'a failed blob byte read is a real save failure and must reach onError');
  const bytes = await backend._readBlobBytes('', 'pic.png');
  assert.strictEqual(bytes, null,
    'a failed read must not create a phantom zero-byte blob entry in the block layer');
});

test('a rewrite whose bytes cannot be fetched leaves the previously-persisted blob intact', async () => {
  let shouldFail = false;
  const { ctx } = mountedIdb({
    fetch: async () => {
      if (shouldFail) throw new Error('NetworkError: revoked object URL');
      return { arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer };
    },
  });
  const backend = ctx.createIdbBackend();
  const errors = [];
  await ctx.vfsMount(backend, { onError: e => errors.push(e) });

  await ctx.vfsWriteBlob('pic.png', { url: 'blob:live', kind: 'image', size: 4, mime: 'image/png' }, '');
  await ctx.vfsFlush();
  assert.strictEqual(errors.length, 0, 'setup: the first write must succeed cleanly');
  const original = await backend._readBlobBytes('', 'pic.png');
  assert.deepStrictEqual([...original], [1, 2, 3, 4]);

  // Overwrite the same path; this time the new bytes cannot be fetched.
  shouldFail = true;
  await ctx.vfsWriteBlob('pic.png', { url: 'blob:dead-replacement', kind: 'image', size: 9, mime: 'image/png' }, '');
  await ctx.vfsFlush();
  assert.strictEqual(errors.length, 1, 'the failed rewrite must be reported');

  const stillThere = await backend._readBlobBytes('', 'pic.png');
  assert.deepStrictEqual([...stillThere], [1, 2, 3, 4],
    "a failed re-read must not overwrite the existing entry's blocks with nothing");
});

test('one unreadable blob does not drop the rest of the batch', async () => {
  const { ctx } = mountedIdb({
    fetch: async (url) => {
      if (url === 'blob:dead') throw new Error('NetworkError: revoked object URL');
      return { arrayBuffer: async () => new Uint8Array([9]).buffer };
    },
  });
  const backend = ctx.createIdbBackend();
  const errors = [];
  await ctx.vfsMount(backend, { onError: e => errors.push(e) });

  await ctx.vfsWriteFile('a.txt', 'hello', '');
  await ctx.vfsWriteBlob('dead.png', { url: 'blob:dead', kind: 'image', size: 1, mime: 'image/png' }, '');
  await ctx.vfsWriteBlob('ok.png', { url: 'blob:ok', kind: 'image', size: 1, mime: 'image/png' }, '');
  await ctx.vfsFlush();

  assert.strictEqual(errors.length, 1, 'exactly the one failed blob must be reported, not the whole batch');
  assert.strictEqual(await ctx.vfsReadFile('a.txt', ''), 'hello',
    'a sibling text write in the same commit must still land');
  const okBytes = await backend._readBlobBytes('', 'ok.png');
  assert.deepStrictEqual([...okBytes], [9], 'a sibling blob write in the same commit must still land');
  const deadBytes = await backend._readBlobBytes('', 'dead.png');
  assert.strictEqual(deadBytes, null, 'the unreadable blob must not land as a zero-byte entry');
});

// Task 9c review, MINOR-1: the failedBlobs -> onError loop wasn't gated by
// `_vfsBackend === backend`, unlike the quota refresh and onCommit dispatch
// immediately below it in vfsFlush. A remount racing an in-flight commit
// could surface a stale-backend toast through the NEW backend's onError
// handler - a one-line inconsistency with the adjacent, already-guarded code.
test('a failed-blob report from a stale, no-longer-mounted commit does not reach any onError handler', async () => {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  const backendA = ctx.createMemStorage();
  const errorsA = [];
  await ctx.vfsMount(backendA, { onError: e => errorsA.push(e) });

  let release;
  const gate = new Promise(r => { release = r; });
  backendA.commit = async () => { await gate; return { failedBlobs: [{ dirName: '', name: 'stale.png' }] }; };

  await ctx.vfsWriteFile('a.txt', 'x', ''); // gives vfsFlush something to commit
  const flushPromise = ctx.vfsFlush(); // in flight against backendA, gated

  // A remount lands while backendA's commit is still pending.
  const backendB = ctx.createMemStorage();
  const errorsB = [];
  await ctx.vfsMount(backendB, { onError: e => errorsB.push(e) });

  release();
  await flushPromise;

  assert.strictEqual(errorsA.length, 0, 'backend A is no longer mounted; its own stale handler must not fire either');
  assert.strictEqual(errorsB.length, 0,
    "a stale commit's failedBlobs must not report through the NEW backend's onError channel");
});
