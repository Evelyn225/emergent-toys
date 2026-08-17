'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

// os/vfs.js is loaded for VfsError, which fs-format throws on ENOSPC. It has
// no top-level side effects beyond variable declarations, so loading it here
// costs nothing - test/vfs-path.test.cjs loads it the same way.
function fmt() {
  return loadOsSources(makeOsContext(), ['os/vfs.js', 'os/fs-format.js']);
}

test('a fresh superblock has every block free and a 4096 byte block size', () => {
  const ctx = fmt();
  const sb = ctx.fsMakeSuperblock(64);
  assert.strictEqual(sb.blockSize, 4096);
  assert.strictEqual(sb.totalBlocks, 64);
  assert.strictEqual(sb.migrated, false);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 64);
  // 64 blocks needs 8 bytes of bitmap, and every bit starts clear.
  assert.strictEqual(sb.freeBitmap.length, 8);
});

test('bits round-trip independently of their neighbours', () => {
  const ctx = fmt();
  const sb = ctx.fsMakeSuperblock(64);
  ctx.fsBitSet(sb.freeBitmap, 9, 1);
  assert.strictEqual(ctx.fsBitGet(sb.freeBitmap, 9), 1);
  assert.strictEqual(ctx.fsBitGet(sb.freeBitmap, 8), 0);
  assert.strictEqual(ctx.fsBitGet(sb.freeBitmap, 10), 0);
  ctx.fsBitSet(sb.freeBitmap, 9, 0);
  assert.strictEqual(ctx.fsBitGet(sb.freeBitmap, 9), 0);
});

test('allocation prefers a contiguous run', () => {
  const ctx = fmt();
  const sb = ctx.fsMakeSuperblock(64);
  const blocks = ctx.fsAllocBlocks(sb, 4);
  assert.deepStrictEqual(plain(blocks), [0, 1, 2, 3]);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 60);
});

test('a freed run is reused', () => {
  const ctx = fmt();
  const sb = ctx.fsMakeSuperblock(64);
  const first = ctx.fsAllocBlocks(sb, 4);
  ctx.fsFreeBlocks(sb, first);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 64);
  assert.deepStrictEqual(plain(ctx.fsAllocBlocks(sb, 2)), [0, 1]);
});

test('allocation falls back to scattered blocks when no run is large enough', () => {
  const ctx = fmt();
  const sb = ctx.fsMakeSuperblock(8);
  // Occupy 1, 3, 5 so the largest free run is a single block.
  ctx.fsBitSet(sb.freeBitmap, 1, 1);
  ctx.fsBitSet(sb.freeBitmap, 3, 1);
  ctx.fsBitSet(sb.freeBitmap, 5, 1);
  const blocks = ctx.fsAllocBlocks(sb, 4);
  assert.deepStrictEqual(plain(blocks), [0, 2, 4, 6]);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 1);
});

test('an allocation that cannot be satisfied throws ENOSPC and frees nothing', () => {
  const ctx = fmt();
  const sb = ctx.fsMakeSuperblock(4);
  let err = null;
  try { ctx.fsAllocBlocks(sb, 5); } catch (e) { err = e; }
  assert.ok(err, 'expected a throw');
  assert.strictEqual(err.code, 'ENOSPC');
  // The partial allocation must be rolled back, or a failed write would
  // permanently leak blocks and shrink the disk on every attempt.
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 4);
});

test('allocating zero blocks is legal and touches nothing', () => {
  const ctx = fmt();
  const sb = ctx.fsMakeSuperblock(8);
  assert.deepStrictEqual(plain(ctx.fsAllocBlocks(sb, 0)), []);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 8);
});

test('fragmentation is zero when every file is contiguous', () => {
  const ctx = fmt();
  // Three files, each in one run. A tidy disk scores 0 even with many files,
  // which is the whole point: multiple files are not fragmentation.
  const inodes = [{ blocks: [0, 1, 2] }, { blocks: [3, 4] }, { blocks: [5] }];
  assert.strictEqual(ctx.fsComputeFragmentation(inodes), 0);
});

test('fragmentation is one when every block of every file is isolated', () => {
  const ctx = fmt();
  const inodes = [{ blocks: [0, 2, 4] }, { blocks: [6, 8] }];
  assert.strictEqual(ctx.fsComputeFragmentation(inodes), 1);
});

test('fragmentation sits between the extremes for a partly split file', () => {
  const ctx = fmt();
  // One file, 4 blocks, in 2 runs: 1 extra run out of 3 possible.
  const frag = ctx.fsComputeFragmentation([{ blocks: [0, 1, 5, 6] }]);
  assert.ok(frag > 0 && frag < 1, 'expected a value strictly between 0 and 1, got ' + frag);
  assert.strictEqual(Number(frag.toFixed(4)), Number((1 / 3).toFixed(4)));
});

test('fragmentation of an empty disk is zero rather than NaN', () => {
  const ctx = fmt();
  assert.strictEqual(ctx.fsComputeFragmentation([]), 0);
  assert.strictEqual(ctx.fsComputeFragmentation([{ blocks: [] }]), 0);
});

// ── Task 2: records and tree reconstruction ──────────────────────

async function seeded() {
  const ctx = fmt();
  const store = ctx.fsMakeStore();
  const sb = ctx.fsMakeSuperblock(256);
  await store.put('superblock', 'sb', sb);
  return { ctx, store, sb };
}

test('a text entry round-trips through blocks as UTF-8', async () => {
  const { ctx, store, sb } = await seeded();
  const text = 'hello éè world';
  const ino = await ctx.fsWriteEntry(store, sb, 0, 'NOTES.txt', {
    type: 'file', bytes: ctx.fsEncodeText(text),
  });
  assert.ok(ino > 0, 'inode numbers start at 1 so 0 can mean none');
  const back = ctx.fsDecodeText(await ctx.fsReadEntryBytes(store, sb, ino));
  assert.strictEqual(back, text);
});

test('a file larger than one block spans several and still round-trips', async () => {
  const { ctx, store, sb } = await seeded();
  // 3 blocks and a bit, so the tail block is deliberately partial.
  const text = 'x'.repeat(4096 * 3 + 17);
  const ino = await ctx.fsWriteEntry(store, sb, 0, 'BIG.txt', {
    type: 'file', bytes: ctx.fsEncodeText(text),
  });
  const inode = await store.get('inodes', ino);
  assert.strictEqual(inode.blocks.length, 4);
  assert.strictEqual(inode.size, text.length);
  const back = ctx.fsDecodeText(await ctx.fsReadEntryBytes(store, sb, ino));
  assert.strictEqual(back.length, text.length);
  assert.strictEqual(back, text);
});

test('binary bytes round-trip exactly, with no base64 in the middle', async () => {
  const { ctx, store, sb } = await seeded();
  const bytes = new Uint8Array([0, 255, 13, 10, 128, 1, 0, 7]);
  const ino = await ctx.fsWriteEntry(store, sb, 0, 'IMG.png', { type: 'blob', bytes });
  const back = await ctx.fsReadEntryBytes(store, sb, ino);
  assert.deepStrictEqual(Array.from(back), Array.from(bytes));
});

test('rewriting an entry frees its old blocks rather than leaking them', async () => {
  const { ctx, store, sb } = await seeded();
  const big = ctx.fsEncodeText('y'.repeat(4096 * 4));
  await ctx.fsWriteEntry(store, sb, 0, 'A.txt', { type: 'file', bytes: big });
  const afterBig = ctx.fsCountFreeBlocks(sb);
  await ctx.fsWriteEntry(store, sb, 0, 'A.txt', { type: 'file', bytes: ctx.fsEncodeText('tiny') });
  assert.ok(ctx.fsCountFreeBlocks(sb) > afterBig,
    'shrinking a file must return blocks to the pool');
});

test('deleting an entry frees its blocks and removes both records', async () => {
  const { ctx, store, sb } = await seeded();
  const before = ctx.fsCountFreeBlocks(sb);
  const ino = await ctx.fsWriteEntry(store, sb, 0, 'GONE.txt', {
    type: 'file', bytes: ctx.fsEncodeText('bye'),
  });
  assert.strictEqual(await ctx.fsDeleteEntry(store, sb, 0, 'GONE.txt'), true);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), before);
  assert.strictEqual(await store.get('inodes', ino), undefined);
  assert.strictEqual(await store.get('dirents', '0/GONE.txt'), undefined);
});

test('deleting something that is not there reports false rather than throwing', async () => {
  const { ctx, store, sb } = await seeded();
  assert.strictEqual(await ctx.fsDeleteEntry(store, sb, 0, 'NOPE.txt'), false);
});

test('rename rewrites one dirent and does not touch a single block', async () => {
  const { ctx, store, sb } = await seeded();
  const ino = await ctx.fsWriteEntry(store, sb, 0, 'OLD.txt', {
    type: 'file', bytes: ctx.fsEncodeText('same bytes'),
  });
  const freeBefore = ctx.fsCountFreeBlocks(sb);
  const inodeBefore = plain(await store.get('inodes', ino));

  assert.strictEqual(await ctx.fsRenameEntry(store, 0, 'OLD.txt', 0, 'NEW.txt'), true);

  assert.strictEqual(await store.get('dirents', '0/OLD.txt'), undefined);
  assert.strictEqual(await store.get('dirents', '0/NEW.txt'), ino);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), freeBefore, 'rename must not reallocate');
  assert.deepStrictEqual(plain(await store.get('inodes', ino)), inodeBefore,
    'rename must not rewrite the inode');
  assert.strictEqual(ctx.fsDecodeText(await ctx.fsReadEntryBytes(store, sb, ino)), 'same bytes');
});

test('the tree rebuilds from a full dirent scan, nested and typed', async () => {
  const { ctx, store, sb } = await seeded();
  const docsIno = await ctx.fsWriteEntry(store, sb, 0, 'DOCS', { type: 'dir' });
  await ctx.fsWriteEntry(store, sb, 0, 'ROOT.txt', {
    type: 'file', bytes: ctx.fsEncodeText('at the root'),
  });
  await ctx.fsWriteEntry(store, sb, docsIno, 'INNER.txt', {
    type: 'file', bytes: ctx.fsEncodeText('nested'),
  });
  await ctx.fsWriteEntry(store, sb, 0, 'PIC.png', {
    type: 'blob', bytes: new Uint8Array([1, 2, 3]), meta: { kind: 'image', size: 3 },
  });

  const tree = await ctx.fsReadTree(store);
  assert.deepStrictEqual(plain(tree.dirs).sort(), ['DOCS']);
  assert.strictEqual(tree.files['ROOT.txt'], 'at the root');
  assert.strictEqual(tree.subdirs.DOCS.files['INNER.txt'], 'nested');
  assert.strictEqual(tree.blobs['PIC.png'].kind, 'image');
});

test('an empty store rebuilds as an empty tree rather than throwing', async () => {
  const { ctx, store } = await seeded();
  const tree = await ctx.fsReadTree(store);
  assert.deepStrictEqual(plain(tree.dirs), []);
  assert.deepStrictEqual(plain(tree.files), {});
});
