'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub } = require('./helpers/load-os.cjs');

// Task 9e deleted the media-IndexedDB mirror (openMediaDb, storeBlobEntryInDb
// and friends): blocks are the durable store now, reached upstream of
// saveBlobEntry via vfsWriteBlob, and Task 9d already made blocks readable
// again on boot. saveBlobEntry's only remaining job is the localStorage
// base64 mirror, so this file - which used to prove the >3MB media-DB write
// mattered - now only proves the localStorage half's own honesty: it must
// report whether ITS write actually landed, not silently claim success.
// (This file itself is retired in Task 9f, once saveBlobEntry has nothing
// left to do at all.)
function blobStore(overrides) {
  const ctx = makeOsContext(Object.assign({
    btoa: str => Buffer.from(str, 'binary').toString('base64'),
    Blob, // still needed pre-Task-9e: storeBlobEntryInDb wraps bytes in a real Blob
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/blob-store.js']);
  return ctx;
}

test('saveBlobEntry resolves false for a file over the size limit - no store can hold it any more', async () => {
  // Task 9e removed the only thing that used to cover this case (the media
  // DB); the localStorage mirror was never able to (BLOB_SIZE_LIMIT skips it
  // outright above 3 MB). A large upload landing only in blocks is expected
  // and covered elsewhere (Task 9d's block-restore tests) - this file is
  // only about what saveBlobEntry itself can honestly report.
  const ctx = blobStore();
  const big = new Uint8Array(4 * 1024 * 1024).buffer; // over the 3 MB cap
  const result = await ctx.saveBlobEntry('', 'movie.mp4', 'video', big.byteLength, 'video/mp4', big);
  assert.strictEqual(result, false);
});

test('saveBlobEntry resolves true for a small file that fits the localStorage mirror', async () => {
  const ctx = blobStore();
  const small = new Uint8Array(10).buffer;
  const result = await ctx.saveBlobEntry('', 'note.png', 'image', 10, 'image/png', small);
  assert.strictEqual(result, true);
});

test('saveBlobEntry resolves false for a small file when the localStorage write itself fails', async () => {
  const ctx = blobStore({ quotaBytes: 0 }); // makes every localStorage.setItem throw
  const small = new Uint8Array(10).buffer;
  const result = await ctx.saveBlobEntry('', 'note.png', 'image', 10, 'image/png', small);
  assert.strictEqual(result, false);
});

test('saveBlobEntry no longer consults IndexedDB at all, even a working one', async () => {
  // The actual regression guard for Task 9e's deletion: before it,
  // saveBlobEntry would have tried the media DB FIRST and returned true for
  // this large file the instant that write landed, indexedDB not being read
  // at all otherwise. This proves that path is gone, not merely untested -
  // a real, working IndexedDB is provided and a large upload must still
  // report false.
  const stub = makeIndexedDbStub();
  const ctx = blobStore({ indexedDB: stub });
  const big = new Uint8Array(4 * 1024 * 1024).buffer;
  const result = await ctx.saveBlobEntry('', 'movie.mp4', 'video', big.byteLength, 'video/mp4', big);
  assert.strictEqual(result, false,
    'a working IndexedDB must not rescue this any more - the media-DB code path is retired');
});
