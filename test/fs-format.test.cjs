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
