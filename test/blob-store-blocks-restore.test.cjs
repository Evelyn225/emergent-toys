'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub } = require('./helpers/load-os.cjs');

// Task 9d made the block layer the primary blob source; Tasks 9e and 9f then
// deleted both mirrors it used to have to defer to (a separate media
// IndexedDB, and a base64-in-localStorage copy). loadBlobsFromBlocks is now
// the entire boot-time blob restore, and the sole thing that fetches saved
// blob bytes back out of blocks and turns them into real object URLs.
//
// A real object-URL/fetch pair, not the bare stubs makeOsContext ships with:
// createObjectURL must return a DIFFERENT url per Blob, and fetch(url) must
// actually resolve to that Blob's bytes, for a test to tell "this restored
// the block bytes" apart from "this restored whatever the stub always
// returns".
function fakeObjectUrls() {
  let n = 0;
  const store = new Map();
  return {
    URL: {
      createObjectURL: blob => { const url = 'blob:' + (n++); store.set(url, blob); return url; },
      revokeObjectURL: url => { store.delete(url); },
    },
    fetch: async url => {
      const blob = store.get(url);
      if (!blob) throw new Error('NetworkError: unknown or revoked object URL: ' + url);
      return { arrayBuffer: () => blob.arrayBuffer() };
    },
  };
}

function makeCtx(overrides) {
  const idbStub = makeIndexedDbStub();
  const { URL, fetch } = fakeObjectUrls();
  const ctx = makeOsContext(Object.assign({
    indexedDB: idbStub,
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
    URL, fetch, Blob,
    // loadBlobsFromBlocks's wallpaper-apply tail calls these (os/settings.js);
    // not under test here, so stubbed to a no-op rather than pulled in.
    getInitialWallpaperPath: () => null,
    applyWallpaper: () => {},
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js', 'os/blob-store.js']);
  return ctx;
}

async function bytesAt(ctx, path) {
  const stat = ctx.vfsStatSync(path, '');
  assert.ok(stat && stat.blob && stat.blob.url, path + ' has no restored url');
  const buf = await ctx.fetch(stat.blob.url).then(r => r.arrayBuffer());
  return [...new Uint8Array(buf)];
}

test('loadBlobsFromBlocks restores a blob persisted in blocks', async () => {
  const ctx = makeCtx();
  const writer = ctx.createIdbBackend();
  await writer.load();
  const bytes = new Uint8Array([10, 20, 30]);
  await writer.commit({
    ops: [{ op: 'writeBlob', dirName: '', name: 'pic.png' }],
    readEntry: () => ({ kind: 'blob', blob: { kind: 'image', mime: 'image/png' }, bytes, dirName: '', name: 'pic.png' }),
  });

  // A fresh backend instance for the mount - simulating the next boot, the
  // same pattern test/storage-idb.test.cjs's "survives a reload" test uses.
  // Reusing `writer` here would prove nothing: its own load() only returns
  // non-null once per instance lifetime (os/storage-idb.js's freshlyCreated
  // latches), regardless of any commit made through it afterward.
  await ctx.vfsMount(ctx.createIdbBackend(), {});
  await ctx.loadBlobsFromBlocks();

  assert.deepStrictEqual(await bytesAt(ctx, 'pic.png'), [10, 20, 30]);
});

// Task 9f folded the wallpaper-apply tail (which used to run from
// loadBlobsFromIndexedDb, deleted in 9e) into loadBlobsFromBlocks itself.
// That tail must run unconditionally - not skipped by an early return for a
// non-IndexedDB backend, or one with no block-backed blobs at all - or a
// saved wallpaper would silently stop applying on exactly those boots.
test('the wallpaper-apply tail still runs when there is nothing in blocks to restore', async () => {
  const applied = [];
  const ctx = makeCtx({ applyWallpaper: path => applied.push(path) });
  const backend = ctx.createIdbBackend();
  await backend.load(); // never committed anything - blocks are empty
  await ctx.vfsMount(backend, {});

  ctx.getInitialWallpaperPath = () => 'DOCS\\wall.png';
  await ctx.loadBlobsFromBlocks();

  assert.deepStrictEqual(applied, ['DOCS\\wall.png']);
});

test('the wallpaper-apply tail still runs on a backend with no _readBlobBytes at all', async () => {
  const applied = [];
  const ctx = loadOsSources(makeOsContext({
    getInitialWallpaperPath: () => 'DOCS\\wall.png',
    applyWallpaper: path => applied.push(path),
  }), ['os/vfs.js', 'os/storage-mem.js', 'os/blob-store.js']);
  await ctx.vfsMount(ctx.createMemStorage({}), {});

  await ctx.loadBlobsFromBlocks();

  assert.deepStrictEqual(applied, ['DOCS\\wall.png']);
});

// The carry-forward the 9c review flagged: on a readFailed rewrite, blocks
// keep the OLD bytes (os/storage-idb.js skips the write) while the live tree
// shows the NEW record from the moment vfsWriteBlob ran, well before the
// commit that discovers the fetch failure. This proves what a reload
// actually shows once blocks are the read source: the OLD, persisted
// content - not whatever the live session showed in the meantime - because
// loadBlobsFromBlocks treats blocks as authoritative.
test('after a readFailed rewrite, a reload restores the OLD bytes blocks actually persisted, not the newer unsaved ones', async () => {
  let fetchShouldFail = false;
  const idbStub = makeIndexedDbStub();
  const { URL, fetch: realFetch } = fakeObjectUrls();
  const ctx = makeOsContext({
    indexedDB: idbStub,
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
    URL,
    fetch: async url => { if (fetchShouldFail) throw new Error('NetworkError'); return realFetch(url); },
    Blob,
    getInitialWallpaperPath: () => null,
    applyWallpaper: () => {},
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js', 'os/blob-store.js']);

  const backend = ctx.createIdbBackend();
  await backend.load();
  const errors = [];
  await ctx.vfsMount(backend, { onError: e => errors.push(e) });

  // Original upload: bytes reach blocks.
  await ctx.vfsWriteBlob('pic.png', { url: ctx.URL.createObjectURL(new ctx.Blob([new Uint8Array([1, 1, 1])], { type: 'image/png' })), kind: 'image', size: 3, mime: 'image/png' }, '');
  await ctx.vfsFlush();
  assert.strictEqual(errors.length, 0, 'setup: the first write must land cleanly');

  // Rewrite: the live tree gets a new record immediately, but the fetch
  // behind the commit fails, so blocks keep the old bytes.
  fetchShouldFail = true;
  await ctx.vfsWriteBlob('pic.png', { url: 'blob:doomed-rewrite', kind: 'image', size: 3, mime: 'image/png' }, '');
  await ctx.vfsFlush();
  assert.strictEqual(errors.length, 1, 'setup: the rewrite must be reported as a failed save');

  // "Reload": a fresh backend instance over the same underlying database,
  // fetch working again.
  fetchShouldFail = false;
  const reloadedBackend = ctx.createIdbBackend();
  const reloadErrors = [];
  await ctx.vfsMount(reloadedBackend, { onError: e => reloadErrors.push(e) });
  await ctx.loadBlobsFromBlocks();

  assert.deepStrictEqual(await bytesAt(ctx, 'pic.png'), [1, 1, 1],
    'the reload must show the OLD, actually-persisted bytes - not the newer, never-actually-saved ones');
});
