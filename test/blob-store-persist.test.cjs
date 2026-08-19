'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub } = require('./helpers/load-os.cjs');

// Prerequisite hardening for Task 9 (blocks become the primary blob store):
// os/blob-store.js's saveBlobEntry fired storeBlobEntryInDb() with `void`,
// discarding the one signal that the write failed - storeBlobEntryInDb and
// openMediaDb never reject, every failure path resolves false/null, so
// nothing else could ever catch this. Above BLOB_SIZE_LIMIT (3MB) there is
// no localStorage fallback at all, so today - before any block-layer read
// path is wired in - a failed media-DB write for a large file is invisible,
// unconditional data loss: nothing else durable and boot-recoverable exists
// for that file.
function blobStore(overrides) {
  const ctx = makeOsContext(Object.assign({
    btoa: str => Buffer.from(str, 'binary').toString('base64'),
    Blob, // storeBlobEntryInDb wraps the arrayBuffer in a real Blob before put()
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/blob-store.js']);
  return ctx;
}

test('saveBlobEntry resolves false when nothing durable landed for a file over the size limit', async () => {
  const ctx = blobStore({ indexedDB: undefined }); // openMediaDb() -> null -> storeBlobEntryInDb() -> false
  const big = new Uint8Array(4 * 1024 * 1024).buffer; // over the 3 MB localStorage cap
  const result = await ctx.saveBlobEntry('', 'movie.mp4', 'video', big.byteLength, 'video/mp4', big);
  assert.strictEqual(result, false,
    'with no IndexedDB and a file above the localStorage size cap, no store actually got the ' +
    'bytes - that must be reported, not silently discarded');
});

test('saveBlobEntry resolves true once the media DB write actually lands', async () => {
  const stub = makeIndexedDbStub();
  const ctx = blobStore({ indexedDB: stub });
  const big = new Uint8Array(4 * 1024 * 1024).buffer;
  const result = await ctx.saveBlobEntry('', 'movie.mp4', 'video', big.byteLength, 'video/mp4', big);
  assert.strictEqual(result, true);
});

test('saveBlobEntry resolves true for a small file even with no media DB, because localStorage covers it', async () => {
  const ctx = blobStore({ indexedDB: undefined });
  const small = new Uint8Array(10).buffer;
  const result = await ctx.saveBlobEntry('', 'note.png', 'image', 10, 'image/png', small);
  assert.strictEqual(result, true);
});

test('saveBlobEntry resolves false for a small file when both stores fail', async () => {
  // A quota of 0 makes every localStorage.setItem throw, and no indexedDB
  // means the media DB never lands either - neither copy exists.
  const ctx = blobStore({ indexedDB: undefined, quotaBytes: 0 });
  const small = new Uint8Array(10).buffer;
  const result = await ctx.saveBlobEntry('', 'note.png', 'image', 10, 'image/png', small);
  assert.strictEqual(result, false);
});
