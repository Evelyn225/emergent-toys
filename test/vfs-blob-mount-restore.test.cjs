'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub, plain } = require('./helpers/load-os.cjs');

// Task 9d: make the block layer the primary blob source. Step 1 of that is a
// real gap in os/vfs.js: os/fs-format.js's fsReadTree DOES return a blob
// dirent's metadata (size/kind/mime) as part of the tree backend.load()
// hands back, but _vfsDesNode - the function that turns that into the live
// tree - only ever read `obj.dirs`, `obj.files` and `obj.subdirs`. `obj.blobs`
// was silently dropped, so a blob persisted in blocks was completely absent
// from the live tree immediately after mount - not listed, not stat-able,
// nothing - until os/blob-store.js's localStorage/media-DB restore separately
// reintroduced it moments later. This is the mount-time half of the fix;
// test/blob-store-blocks-restore.test.cjs covers the boot-restore half that
// consumes it.
//
// Every test mounts a BRAND NEW backend instance for the "reload" step,
// never the instance a commit was made through - mirroring
// test/storage-idb.test.cjs's "a committed write survives a reload" pattern.
// A single instance's own `load()` is only ever null on the very first call
// (freshlyCreated latches for that instance's whole lifetime, by design - see
// os/storage-idb.js's load()), so reusing it after a commit would prove
// nothing about what actually persisted.
function idb(overrides) {
  const stub = makeIndexedDbStub();
  const ctx = makeOsContext(Object.assign({
    indexedDB: stub,
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  return { ctx, stub };
}

test('mounting an IndexedDB-backed tree restores blob metadata into the live tree', async () => {
  const { ctx } = idb();
  const writer = ctx.createIdbBackend();
  await writer.load();
  await writer.commit({
    ops: [{ op: 'writeBlob', dirName: '', name: 'pic.png' }],
    readEntry: () => ({
      kind: 'blob', blob: { kind: 'image', mime: 'image/png' },
      bytes: new Uint8Array([1, 2, 3]), dirName: '', name: 'pic.png',
    }),
  });

  const errors = [];
  await ctx.vfsMount(ctx.createIdbBackend(), { onError: e => errors.push(e) });
  assert.strictEqual(errors.length, 0);

  const stat = ctx.vfsStatSync('pic.png', '');
  assert.ok(stat, 'the blob dirent must be visible in the tree immediately after mount');
  assert.strictEqual(stat.kind, 'blob');
  assert.strictEqual(stat.size, 3);
  assert.strictEqual(stat.blob.mime, 'image/png');
  assert.strictEqual(stat.blob.kind, 'image');
  // Bytes/URL are NOT part of this fix - fetching them is loadBlobsFromBlocks's
  // job (os/blob-store.js). This only proves the metadata itself survives.
  assert.strictEqual(stat.blob.url, undefined);
});

test('vfsBlockBlobEntries lists every blob path the mounted backend persisted', async () => {
  const { ctx } = idb();
  const writer = ctx.createIdbBackend();
  await writer.load();
  await writer.commit({
    ops: [
      { op: 'mkdir', dirName: '', name: 'DOCS' },
      { op: 'writeBlob', dirName: '', name: 'a.png' },
      { op: 'writeBlob', dirName: 'DOCS', name: 'b.png' },
    ],
    readEntry: (dirName, name) => ({
      kind: 'blob', blob: { kind: 'image', mime: 'image/png' },
      bytes: new Uint8Array([name.length]), dirName, name,
    }),
  });

  await ctx.vfsMount(ctx.createIdbBackend(), {});
  const entries = plain(ctx.vfsBlockBlobEntries()).sort((a, b) => a.name < b.name ? -1 : 1);
  assert.deepStrictEqual(entries, [
    { dirName: '', name: 'a.png', size: 1, kind: 'image', mime: 'image/png' },
    { dirName: 'DOCS', name: 'b.png', size: 1, kind: 'image', mime: 'image/png' },
  ]);
});

test('vfsBlockBlobEntries is empty for a backend with no blobs, and is reset on remount', async () => {
  const { ctx } = idb();
  const writer = ctx.createIdbBackend();
  await writer.load();
  await writer.commit({
    ops: [{ op: 'writeBlob', dirName: '', name: 'a.png' }],
    readEntry: () => ({ kind: 'blob', blob: {}, bytes: new Uint8Array([1]), dirName: '', name: 'a.png' }),
  });
  await ctx.vfsMount(ctx.createIdbBackend(), {});
  assert.strictEqual(ctx.vfsBlockBlobEntries().length, 1);

  const empty = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  await empty.vfsMount(empty.createMemStorage(), {});
  assert.deepStrictEqual(plain(empty.vfsBlockBlobEntries()), [],
    'a backend that never populates obj.blobs (storage-mem) must report no block-backed blobs');
});

test('a seeded placeholder written by the mount seed callback does not erase the block-blob snapshot', async () => {
  // Mirrors os/fs-persist.js's shape: refreshSeededWallpaperLibrary /
  // refreshSeededHomeMedia run AFTER vfsMount resolves and write straight
  // into dir.blobs, unconditionally. If a real block-backed blob happens to
  // share that exact path, the seed's write must not make it disappear from
  // vfsBlockBlobEntries() - that snapshot has to be taken before any
  // post-mount mutator can run.
  const { ctx } = idb();
  const writer = ctx.createIdbBackend();
  await writer.load();
  await writer.commit({
    ops: [{ op: 'writeBlob', dirName: '', name: 'wall.png' }],
    readEntry: () => ({
      kind: 'blob', blob: { kind: 'image', mime: 'image/png' },
      bytes: new Uint8Array([9, 9]), dirName: '', name: 'wall.png',
    }),
  });

  await ctx.vfsMount(ctx.createIdbBackend(), {
    seed: root => {
      root.blobs.set('wall.png', { url: 'https://seed.example/wall.png', kind: 'image', size: 0, mime: 'image/png', seeded: true });
    },
  });

  assert.deepStrictEqual(plain(ctx.vfsBlockBlobEntries()), [
    { dirName: '', name: 'wall.png', size: 2, kind: 'image', mime: 'image/png' },
  ], 'the block-backed entry must still be recorded even though the seed overwrote the live tree node afterward');
});
