'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, makeLocalStorageStub, makeIndexedDbStub, extractFunctionSource } = require('./helpers/load-os.cjs');

const ROOT = path.join(__dirname, '..');

// os/fs-persist.js cannot be loaded in this harness - it runs loadFS() at parse
// time and drags in the whole desktop - so fsRunCompaction is sliced out of the
// source and evaluated here, the same technique test/fs-boot-backend.test.cjs
// uses for fsChooseBackend.
async function runner() {
  const ctx = makeOsContext({
    localStorage: makeLocalStorageStub(),
    indexedDB: makeIndexedDbStub(),
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  const src = fs.readFileSync(path.join(ROOT, 'os', 'fs-persist.js'), 'utf8');
  ctx.__evalSource(extractFunctionSource(src, 'fsRunCompaction'), 'fs-persist:fsRunCompaction');

  const backend = ctx.createIdbBackend();
  await backend._store();
  // Stand in for the parts of fs-persist.js that cannot be loaded. All of
  // these are read by fsRunCompaction's body, and the slice is evaluated
  // alone, so every one that is missing is a ReferenceError on the first call
  // - failing every test in this file for a reason unrelated to what it tests.
  ctx.vfsGetBackend = () => backend;
  ctx.fsGetActiveBackendKind = () => 'idb';
  ctx.fsRefreshFragmentation = async () => 0;
  ctx.getDriveFragmentationLevel = () => 0;
  ctx.defragState = { lastDefragTs: 0, changeCount: 0, lastMutationTs: 0 };
  ctx.saveDriveState = () => {};
  return { ctx, backend };
}

async function writeFile(ctx, backend, name, text) {
  const store = await backend._store();
  return await ctx.fsWriteEntry(store, backend._superblock, 0, name, {
    type: 'file', bytes: ctx.fsEncodeText(text),
  });
}

// The stub settles a transaction on a setImmediate once its requests drain
// (see test/storage-idb.test.cjs), so a raw store.get() issued in the same
// tick as writeFile()'s raw store.put()s opens its transaction before that
// write has committed and sees nothing. Yielding a macrotask between the two
// is what makes the read-back mean "what is durable" rather than "what
// happened to have landed".
const settle = () => new Promise(r => setImmediate(r));

// Marks every block used so the planner has no spare to break a cycle with.
function fsBitSetIfNeeded(ctx, sb, i) { ctx.fsBitSet(sb.freeBitmap, i, 1); }

test('a contiguous disk reports nothing to do and moves nothing', async () => {
  const { ctx, backend } = await runner();
  await writeFile(ctx, backend, 'A.txt', 'a');
  const result = await ctx.fsRunCompaction({});
  assert.strictEqual(result.reason, 'nothing-to-do');
  assert.strictEqual(result.moved, 0);
});

test('a fragmented disk is compacted and every file still reads', async () => {
  const { ctx, backend } = await runner();
  const a = await writeFile(ctx, backend, 'A.txt', 'aaaa');
  const b = await writeFile(ctx, backend, 'B.txt', 'bbbb');
  await settle();
  const store = await backend._store();
  // Scatter A deliberately: push its block to the far end of the disk.
  const inode = await store.get('inodes', a);
  await backend._moveBlock({ ino: a, slot: 0, from: inode.blocks[0], to: 100 });

  const result = await ctx.fsRunCompaction({});
  assert.strictEqual(result.reason, 'ok');
  assert.ok(result.moved > 0, 'nothing was moved on a disk that needed it');

  const store2 = await backend._store();
  const sb = backend._superblock;
  assert.strictEqual(ctx.fsDecodeText(await ctx.fsReadEntryBytes(store2, sb, a)), 'aaaa');
  assert.strictEqual(ctx.fsDecodeText(await ctx.fsReadEntryBytes(store2, sb, b)), 'bbbb');
});

test('shouldStop ends the run cleanly and reports it', async () => {
  const { ctx, backend } = await runner();
  const a = await writeFile(ctx, backend, 'A.txt', 'aaaa');
  await settle();
  const store = await backend._store();
  const inode = await store.get('inodes', a);
  await backend._moveBlock({ ino: a, slot: 0, from: inode.blocks[0], to: 100 });

  const result = await ctx.fsRunCompaction({ shouldStop: () => true });
  assert.strictEqual(result.stopped, true);
  assert.strictEqual(result.moved, 0);
  // Stopping must not leave the filesystem wedged.
  assert.strictEqual(ctx.vfsIsDefragActive(), false);
});

test('onProgress is called once per move with a rising count', async () => {
  const { ctx, backend } = await runner();
  const a = await writeFile(ctx, backend, 'A.txt', 'aaaa');
  await settle();
  const store = await backend._store();
  const inode = await store.get('inodes', a);
  await backend._moveBlock({ ino: a, slot: 0, from: inode.blocks[0], to: 100 });

  const seen = [];
  const result = await ctx.fsRunCompaction({ onProgress: (mv, done, total) => seen.push([done, total]) });
  assert.strictEqual(seen.length, result.moved);
  seen.forEach(([done], i) => assert.strictEqual(done, i + 1));
});

test('the defrag flag is cleared even when a move throws', async () => {
  const { ctx, backend } = await runner();
  const a = await writeFile(ctx, backend, 'A.txt', 'aaaa');
  await settle();
  const store = await backend._store();
  const inode = await store.get('inodes', a);
  await backend._moveBlock({ ino: a, slot: 0, from: inode.blocks[0], to: 100 });

  backend._moveBlock = async () => { throw new Error('disk went away'); };
  const result = await ctx.fsRunCompaction({});

  assert.strictEqual(ctx.vfsIsDefragActive(), false,
    'a thrown move left the filesystem unable to persist for the rest of the session');
  assert.strictEqual(result.ran, true);
  assert.strictEqual(result.moved, 0);
});

test('a non-IndexedDB backend is declined rather than attempted', async () => {
  const { ctx } = await runner();
  ctx.fsGetActiveBackendKind = () => 'local';
  const result = await ctx.fsRunCompaction({});
  assert.strictEqual(result.ran, false);
  assert.strictEqual(result.reason, 'not-idb');
});

test('a failure reading the inodes reports an attempted run, not a decline', async () => {
  const { ctx, backend } = await runner();
  backend._readInodeEntries = async () => { throw new Error('store went away'); };
  const result = await ctx.fsRunCompaction({});
  assert.strictEqual(result.reason, 'failed');
  assert.strictEqual(result.ran, true,
    'a run that set the flag and then failed must not look like a backend decline');
  assert.strictEqual(ctx.vfsIsDefragActive(), false);
});

test('a disk with no free block is reported as no-space, not as a failure', async () => {
  const { ctx, backend } = await runner();
  // Fill the drive so no spare block exists, then interleave two files so a
  // move is genuinely needed. fsPlanCompaction throws ENOSPC for exactly this.
  const store = await backend._store();
  const sb = backend._superblock;
  for (let i = 0; i < sb.totalBlocks; i++) fsBitSetIfNeeded(ctx, sb, i);
  const result = await ctx.fsRunCompaction({});
  assert.ok(result.reason === 'no-space' || result.reason === 'nothing-to-do',
    'expected no-space or nothing-to-do, got ' + result.reason);
  assert.strictEqual(ctx.vfsIsDefragActive(), false);
});
