'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub } = require('./helpers/load-os.cjs');

// Task 9a: blob bytes go INTO the block layer through commit() but nothing
// could bring them back OUT - fsReadTree returns blob dirents as metadata
// only (os/fs-format.js:336), and fsReadEntryBytes was called from exactly
// one place, for text files. This is the read half: a by-path byte read,
// added on the backend beside _readInodes. The base64 mirror in
// os/blob-store.js is untouched here - Task 9b deletes it once this is wired
// in.
function idb(overrides) {
  const stub = makeIndexedDbStub();
  const ctx = makeOsContext(Object.assign({
    indexedDB: stub,
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  return { ctx, stub };
}

// Every setup write below goes through backend._runInWriteTransaction or
// backend.commit() - both resolve only once the underlying transaction has
// actually completed. The stub (test/helpers/load-os.cjs) buffers a
// transaction's writes and applies them to its backing store only when the
// transaction settles on its own macrotask tick, matching real IndexedDB.
// Chaining bare awaits over the one-off store backend._store() returns
// (os/storage-idb.js's _fsIdbStore, a brand-new mini-transaction per call)
// races that settling and previously turned a delete into a silent no-op
// (Task 7's fs-fragmentation.test.cjs). Not used here at all for exactly
// that reason.
async function step(backend, fn) {
  await backend._runInWriteTransaction(fn);
}

test('a blob written through commit() reads back byte-for-byte, including non-UTF8 bytes', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  // Deliberately includes 0x00, 0x80-0xFF and other bytes that are not valid
  // UTF-8 on their own - a round trip through a string (fsDecodeText/atob)
  // would corrupt these. That is the whole point of this test: the by-path
  // read must stay on Uint8Array the entire way.
  const bytes = new Uint8Array([0, 1, 2, 0x80, 0xff, 0x41, 0x00, 0xfe, 254, 10]);
  await backend.commit({
    ops: [{ op: 'writeBlob', dirName: '', name: 'PIC.png' }],
    readEntry: () => ({ kind: 'blob', blob: { kind: 'image', mime: 'image/png' }, bytes, dirName: '', name: 'PIC.png' }),
  });
  const back = await backend._readBlobBytes('', 'PIC.png');
  assert.ok(back instanceof Uint8Array, 'must return a Uint8Array, not a string');
  assert.deepStrictEqual([...back], [...bytes]);
});

test('a blob in a nested directory resolves correctly', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  const bytes = new Uint8Array([9, 8, 7, 6, 5]);
  // dirName carries two path components - DOCS and, inside it, SUB - the
  // same shape os/vfs.js's vfsSplitPath produces. Neither directory exists
  // yet; inoForDir creates both lazily, exactly as a real write into a
  // brand-new nested folder would.
  await backend.commit({
    ops: [{ op: 'writeBlob', dirName: 'DOCS\\SUB', name: 'DEEP.png' }],
    readEntry: () => ({ kind: 'blob', blob: { kind: 'image' }, bytes, dirName: 'DOCS\\SUB', name: 'DEEP.png' }),
  });
  const back = await backend._readBlobBytes('DOCS\\SUB', 'DEEP.png');
  assert.deepStrictEqual([...back], [...bytes]);
});

test('a missing directory or a missing name returns null, not a throw', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  assert.strictEqual(await backend._readBlobBytes('GHOST', 'X.png'), null,
    'a directory that was never created must not throw resolving it');
  await backend.commit({
    ops: [{ op: 'writeBlob', dirName: '', name: 'REAL.png' }],
    readEntry: () => ({ kind: 'blob', blob: {}, bytes: new Uint8Array([1]), dirName: '', name: 'REAL.png' }),
  });
  assert.strictEqual(await backend._readBlobBytes('', 'NOPE.png'), null,
    'a name that does not exist in a real directory must not throw');
});

test('a name that exists as a text file, not a blob, does not silently return its bytes', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
    readEntry: () => ({ kind: 'file', text: 'plain text content', dirName: '', name: 'A.txt' }),
  });
  assert.strictEqual(await backend._readBlobBytes('', 'A.txt'), null,
    'this is a blob-bytes read; a same-named text file must not be handed back as if it were blob content');
});

test('reading a blob does not disturb the free-block count', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  const bytes = new Uint8Array(9000).fill(7); // spans multiple 4KB blocks
  await backend.commit({
    ops: [{ op: 'writeBlob', dirName: '', name: 'BIG.png' }],
    readEntry: () => ({ kind: 'blob', blob: {}, bytes, dirName: '', name: 'BIG.png' }),
  });
  const freeBefore = ctx.fsCountFreeBlocks(backend._superblock);
  await backend._readBlobBytes('', 'BIG.png');
  await backend._readBlobBytes('', 'BIG.png');
  const freeAfter = ctx.fsCountFreeBlocks(backend._superblock);
  assert.strictEqual(freeAfter, freeBefore, 'a read must not allocate or free any blocks');
});
