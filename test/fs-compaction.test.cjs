'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

// os/vfs.js is loaded for VfsError, the same reason test/fs-format.test.cjs
// loads it.
function fmt() {
  return loadOsSources(makeOsContext(), ['os/vfs.js', 'os/fs-format.js']);
}

// Builds a superblock whose bitmap matches the given inode entries, so the
// fixtures cannot drift from the allocation they claim to describe.
function diskOf(ctx, totalBlocks, entries) {
  const sb = ctx.fsMakeSuperblock(totalBlocks);
  entries.forEach(([, inode]) => (inode.blocks || []).forEach(b => ctx.fsBitSet(sb.freeBitmap, b, 1)));
  return sb;
}

// Applies a plan to a plain model of the disk: blockIdx -> 'ino:slot'.
// Returns the model so a test can assert every file still reads correctly.
function applyPlan(entries, plan, upTo) {
  const at = new Map();
  entries.forEach(([ino, inode]) => (inode.blocks || []).forEach((b, slot) => at.set(b, ino + ':' + slot)));
  const blocks = new Map(entries.map(([ino, inode]) => [ino, (inode.blocks || []).slice()]));
  plan.slice(0, upTo === undefined ? plan.length : upTo).forEach(mv => {
    const tag = at.get(mv.from);
    assert.strictEqual(tag, mv.ino + ':' + mv.slot,
      'move ' + JSON.stringify(mv) + ' read block ' + mv.from + ' which held ' + tag);
    assert.ok(!at.has(mv.to), 'move ' + JSON.stringify(mv) + ' overwrote live block ' + mv.to);
    at.delete(mv.from);
    at.set(mv.to, tag);
    blocks.get(mv.ino)[mv.slot] = mv.to;
  });
  return { at, blocks };
}

test('an already contiguous disk plans no moves at all', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'file', blocks: [0, 1] }], [2, { type: 'file', blocks: [2, 3] }]];
  const sb = diskOf(ctx, 16, entries);
  assert.deepStrictEqual(ctx.fsPlanCompaction(entries, sb).length, 0);
});

test('a scattered file is planned into one contiguous run', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'file', blocks: [0, 5, 9] }]];
  const sb = diskOf(ctx, 16, entries);
  const plan = ctx.fsPlanCompaction(entries, sb);
  const { blocks } = applyPlan(entries, plan);
  assert.deepStrictEqual(blocks.get(1), [0, 1, 2]);
});

test('files are packed in ascending ino order with no gap between them', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'file', blocks: [7] }], [2, { type: 'file', blocks: [3, 11] }]];
  const sb = diskOf(ctx, 16, entries);
  const { blocks } = applyPlan(entries, ctx.fsPlanCompaction(entries, sb));
  assert.deepStrictEqual(blocks.get(1), [0]);
  assert.deepStrictEqual(blocks.get(2), [1, 2]);
});

test('blob inodes are compacted exactly like file inodes', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'blob', blocks: [4, 9] }], [2, { type: 'file', blocks: [1] }]];
  const sb = diskOf(ctx, 16, entries);
  const { blocks } = applyPlan(entries, ctx.fsPlanCompaction(entries, sb));
  assert.deepStrictEqual(blocks.get(1), [0, 1]);
  assert.deepStrictEqual(blocks.get(2), [2]);
});

test('directory inodes hold no blocks and are skipped', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'dir', blocks: [] }], [2, { type: 'file', blocks: [5] }]];
  const sb = diskOf(ctx, 16, entries);
  const { blocks } = applyPlan(entries, ctx.fsPlanCompaction(entries, sb));
  assert.deepStrictEqual(blocks.get(2), [0]);
});

test('a full disk that is already contiguous is not an error', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'file', blocks: [0, 1, 2, 3] }]];
  const sb = diskOf(ctx, 4, entries);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 0);
  assert.deepStrictEqual(ctx.fsPlanCompaction(entries, sb).length, 0);
});

test('a full disk needing moves is refused with ENOSPC, not silently mangled', () => {
  const ctx = fmt();
  // Two files interleaved with no free block anywhere to break the cycle.
  const entries = [[1, { type: 'file', blocks: [0, 2] }], [2, { type: 'file', blocks: [1, 3] }]];
  const sb = diskOf(ctx, 4, entries);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 0);
  assert.throws(() => ctx.fsPlanCompaction(entries, sb), err => err.code === 'ENOSPC');
});

test('exactly one free block is enough to compact a fully interleaved disk', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'file', blocks: [0, 2, 4] }], [2, { type: 'file', blocks: [1, 3] }]];
  const sb = diskOf(ctx, 6, entries);
  assert.strictEqual(ctx.fsCountFreeBlocks(sb), 1);
  const { blocks } = applyPlan(entries, ctx.fsPlanCompaction(entries, sb));
  assert.deepStrictEqual(blocks.get(1), [0, 1, 2]);
  assert.deepStrictEqual(blocks.get(2), [3, 4]);
});

test('the completed plan leaves fragmentation at zero', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'file', blocks: [0, 6, 9] }], [2, { type: 'file', blocks: [2, 7] }]];
  const sb = diskOf(ctx, 12, entries);
  const { blocks } = applyPlan(entries, ctx.fsPlanCompaction(entries, sb));
  const after = [...blocks.entries()].map(([, b]) => ({ blocks: b }));
  assert.strictEqual(ctx.fsComputeFragmentation(after), 0);
});

// This is the test that matters most. Crash safety means every move is
// individually durable, so the disk can be left at ANY prefix of the plan.
// Checking a few hand-picked cut points would miss exactly the ordering bug
// this is meant to catch, so it checks every prefix.
test('every prefix of the plan leaves every block readable and owned once', () => {
  const ctx = fmt();
  const entries = [
    [1, { type: 'file', blocks: [1, 5, 8] }],
    [2, { type: 'blob', blocks: [0, 3] }],
    [3, { type: 'file', blocks: [7] }],
  ];
  const sb = diskOf(ctx, 10, entries);
  const plan = ctx.fsPlanCompaction(entries, sb);
  assert.ok(plan.length > 0, 'fixture must actually need moving');
  for (let cut = 0; cut <= plan.length; cut++) {
    // applyPlan asserts internally that no move reads a block it does not own
    // and no move overwrites a live block.
    const { at, blocks } = applyPlan(entries, plan, cut);
    const tags = [...at.values()];
    assert.strictEqual(new Set(tags).size, tags.length, 'prefix ' + cut + ' duplicated a block');
    assert.strictEqual(tags.length, 6, 'prefix ' + cut + ' lost or gained a block');
    blocks.forEach((b, ino) => b.forEach((idx, slot) => {
      assert.strictEqual(at.get(idx), ino + ':' + slot,
        'prefix ' + cut + ': inode ' + ino + ' slot ' + slot + ' points at the wrong block');
    }));
  }
});

test('the planner does not mutate the superblock or the inodes it was given', () => {
  const ctx = fmt();
  const entries = [[1, { type: 'file', blocks: [0, 5] }]];
  const sb = diskOf(ctx, 8, entries);
  const bitmapBefore = [...sb.freeBitmap];
  ctx.fsPlanCompaction(entries, sb);
  assert.deepStrictEqual([...sb.freeBitmap], bitmapBefore);
  assert.deepStrictEqual(entries[0][1].blocks, [0, 5]);
});
