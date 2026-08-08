'use strict';
const test = require('node:test');
const assert = require('node:assert');
// `plain` gives a vm-produced value host prototypes so deepStrictEqual can
// compare it structurally. See test/vfs-path.test.cjs for the full reason.
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

async function mounted(opts) {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  const backend = ctx.createMemStorage(opts || {});
  const changes = [];
  const errors = [];
  await ctx.vfsMount(backend, {
    onChange: () => changes.push(1),
    onError: err => errors.push(err),
  });
  return { ctx, backend, changes, errors };
}

test('mount on an empty backend produces a usable empty root', async () => {
  const { ctx } = await mounted();
  assert.strictEqual(ctx.vfsIsMounted(), true);
  assert.deepStrictEqual(plain(ctx.vfsListSync('')), []);
});

test('mount hydrates the tree from the backend', async () => {
  const tree = { dirs: ['DOCS'], files: { 'a.txt': 'A' }, subdirs: { DOCS: { dirs: [], files: { 'b.txt': 'B' }, subdirs: {} } } };
  const { ctx } = await mounted({ tree });
  assert.strictEqual(ctx.vfsExistsSync('a.txt', ''), true);
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\b.txt', ''), 'B');
});

test('mount runs the seed callback after hydration', async () => {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  await ctx.vfsMount(ctx.createMemStorage(), {
    seed: root => { root.files.set('SEEDED.txt', 'from seed'); },
  });
  assert.strictEqual(await ctx.vfsReadFile('SEEDED.txt', ''), 'from seed');
});

test('writeFile creates, then reads back, and reports created only once', async () => {
  const { ctx } = await mounted();
  const first = await ctx.vfsWriteFile('a.txt', 'one', '');
  assert.strictEqual(first.created, true);
  assert.strictEqual(await ctx.vfsReadFile('a.txt', ''), 'one');
  const second = await ctx.vfsWriteFile('a.txt', 'two', '');
  assert.strictEqual(second.created, false);
  assert.strictEqual(await ctx.vfsReadFile('a.txt', ''), 'two');
});

test('writing an identical value reports unchanged and queues no op', async () => {
  const { ctx, backend } = await mounted();
  await ctx.vfsWriteFile('a.txt', 'same', '');
  await ctx.vfsFlush();
  const opsAfterFirst = backend._ops.length;
  const again = await ctx.vfsWriteFile('a.txt', 'same', '');
  assert.strictEqual(again.unchanged, true);
  await ctx.vfsFlush();
  assert.strictEqual(backend._ops.length, opsAfterFirst, 'a no-op write must not commit');
});

test('writeFile refuses to shadow a blob of the same name', async () => {
  const { ctx } = await mounted();
  await ctx.vfsWriteBlob('pic.png', { url: 'blob:1', kind: 'image', size: 9, mime: 'image/png' }, '');
  await assert.rejects(
    () => ctx.vfsWriteFile('pic.png', 'text', ''),
    err => err.name === 'VfsError' && err.code === 'EEXIST'
  );
  assert.strictEqual(ctx.vfsStatSync('pic.png', '').kind, 'blob');
});

test('writeFile rejects ENOENT when the parent directory is missing', async () => {
  const { ctx } = await mounted();
  await assert.rejects(
    () => ctx.vfsWriteFile('NOPE\\a.txt', 'x', ''),
    err => err.name === 'VfsError' && err.code === 'ENOENT'
  );
});

test('readFile returns null for a missing file and for a blob', async () => {
  const { ctx } = await mounted();
  assert.strictEqual(await ctx.vfsReadFile('nope.txt', ''), null);
  await ctx.vfsWriteBlob('pic.png', { url: 'blob:1', kind: 'image', size: 9, mime: 'image/png' }, '');
  assert.strictEqual(await ctx.vfsReadFile('pic.png', ''), null);
});

test('mkdir creates nested directories and is idempotent', async () => {
  const { ctx } = await mounted();
  const made = await ctx.vfsMkdir('DOCS', '');
  assert.strictEqual(made.created, true);
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS'), true);
  assert.strictEqual((await ctx.vfsMkdir('DOCS', '')).created, false);
  await ctx.vfsMkdir('SUB', 'DOCS');
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS\\SUB'), true);
});

test('unlink removes files, blobs, and dirs, and returns false for misses', async () => {
  const { ctx } = await mounted();
  await ctx.vfsWriteFile('a.txt', 'x', '');
  await ctx.vfsWriteBlob('p.png', { url: 'blob:1', kind: 'image', size: 1, mime: 'image/png' }, '');
  await ctx.vfsMkdir('D', '');
  assert.strictEqual(await ctx.vfsUnlink('a.txt', ''), true);
  assert.strictEqual(await ctx.vfsUnlink('p.png', ''), true);
  assert.strictEqual(await ctx.vfsUnlink('D', ''), true);
  assert.strictEqual(await ctx.vfsUnlink('a.txt', ''), false);
  assert.deepStrictEqual(plain(ctx.vfsListSync('')), []);
});

test('rename moves a text file without touching its content', async () => {
  const { ctx } = await mounted();
  await ctx.vfsWriteFile('a.txt', 'payload', '');
  assert.strictEqual(await ctx.vfsRename('', 'a.txt', 'b.txt'), true);
  assert.strictEqual(await ctx.vfsReadFile('a.txt', ''), null);
  assert.strictEqual(await ctx.vfsReadFile('b.txt', ''), 'payload');
});

test('rename moves a blob record and a directory subtree', async () => {
  const { ctx } = await mounted();
  await ctx.vfsWriteBlob('p.png', { url: 'blob:1', kind: 'image', size: 4, mime: 'image/png' }, '');
  assert.strictEqual(await ctx.vfsRename('', 'p.png', 'q.png'), true);
  assert.strictEqual(ctx.vfsStatSync('q.png', '').blob.url, 'blob:1');
  await ctx.vfsMkdir('D', '');
  await ctx.vfsWriteFile('D\\inner.txt', 'deep', '');
  assert.strictEqual(await ctx.vfsRename('', 'D', 'E'), true);
  assert.strictEqual(await ctx.vfsReadFile('E\\inner.txt', ''), 'deep');
});

test('rename refuses when the destination name is taken', async () => {
  const { ctx } = await mounted();
  await ctx.vfsWriteFile('a.txt', '1', '');
  await ctx.vfsWriteFile('b.txt', '2', '');
  await assert.rejects(
    () => ctx.vfsRename('', 'a.txt', 'b.txt'),
    err => err.name === 'VfsError' && err.code === 'EEXIST'
  );
});

test('writes are debounced into a single commit', async () => {
  const { ctx, backend } = await mounted();
  await ctx.vfsWriteFile('a.txt', '1', '');
  await ctx.vfsWriteFile('b.txt', '2', '');
  await ctx.vfsWriteFile('c.txt', '3', '');
  assert.strictEqual(backend._snapshot, null, 'nothing should have committed yet');
  await ctx.vfsFlush();
  assert.strictEqual(Object.keys(backend._snapshot.files).length, 3);
});

test('onChange fires once per mutation', async () => {
  const { ctx, changes } = await mounted();
  await ctx.vfsWriteFile('a.txt', '1', '');
  await ctx.vfsMkdir('D', '');
  assert.strictEqual(changes.length, 2);
});

test('writeFile throws ENOSPC up front when the write would exceed quota', async () => {
  const { ctx } = await mounted({ quota: 400 });
  await assert.rejects(
    () => ctx.vfsWriteFile('big.txt', 'x'.repeat(5000), ''),
    err => err.name === 'VfsError' && err.code === 'ENOSPC'
  );
  assert.strictEqual(ctx.vfsExistsSync('big.txt', ''), false, 'a rejected write must not mutate the tree');
});

test('a commit that fails late reaches onError', async () => {
  const { ctx, backend, errors } = await mounted({ quota: 1e9 });
  await ctx.vfsWriteFile('a.txt', 'x', '');
  backend.commit = async () => { throw ctx.VfsError('ENOSPC', 'late failure'); };
  await ctx.vfsFlush();
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].code, 'ENOSPC');
});

test('estimate reports the backend numbers', async () => {
  const { ctx } = await mounted({ quota: 2048 });
  await ctx.vfsWriteFile('a.txt', 'hello', '');
  await ctx.vfsFlush();
  const est = await ctx.vfsEstimate();
  assert.strictEqual(est.quota, 2048);
  assert.ok(est.usage > 0);
});

test('a write landing during an in-flight commit still reaches the backend', async () => {
  // Covers the explicit-flush path only: the mid-commit write is drained by a
  // manual vfsFlush() call below, not by its own debounce timer. See
  // 'a write landing mid-commit is committed by its own debounce timer' for
  // the timer path.
  const { ctx, backend } = await mounted();
  let release;
  const gate = new Promise(r => { release = r; });
  const realCommit = backend.commit.bind(backend);
  let calls = 0;
  backend.commit = async arg => { calls++; await gate; return realCommit(arg); };

  await ctx.vfsWriteFile('a.txt', 'A', '');
  const first = ctx.vfsFlush();
  await ctx.vfsWriteFile('b.txt', 'B', '');   // lands mid-commit
  release();
  await first;
  await ctx.vfsFlush();

  assert.strictEqual(calls, 2, 'the second write needs its own commit');
  assert.deepStrictEqual(Object.keys(backend._snapshot.files).sort(), ['a.txt', 'b.txt']);
});

test('a write landing mid-commit is committed by its own debounce timer', async () => {
  const { ctx, backend } = await mounted();
  let release;
  const gate = new Promise(r => { release = r; });
  const realCommit = backend.commit.bind(backend);
  let calls = 0;
  backend.commit = async arg => { calls++; await gate; return realCommit(arg); };

  await ctx.vfsWriteFile('a.txt', 'A', '');
  const first = ctx.vfsFlush();               // commit 1 goes in flight
  await ctx.vfsWriteFile('b.txt', 'B', '');   // lands mid-commit, arms its own timer
  release();
  await first;

  // Deliberately NO explicit flush. The debounce timer is the only thing that
  // can commit b.txt, and proving it does is what justifies removing the
  // reschedule block rather than trusting the argument for it.
  await new Promise(r => setTimeout(r, 700));

  assert.strictEqual(calls, 2, 'the mid-commit write needs its own commit');
  assert.deepStrictEqual(Object.keys(backend._snapshot.files).sort(), ['a.txt', 'b.txt']);
});

test('flush waits for an in-flight commit instead of returning it', async () => {
  const { ctx, backend } = await mounted();
  let release;
  const gate = new Promise(r => { release = r; });
  const realCommit = backend.commit.bind(backend);
  backend.commit = async arg => { await gate; return realCommit(arg); };
  await ctx.vfsWriteFile('a.txt', 'A', '');
  const first = ctx.vfsFlush();
  let settled = false;
  const second = ctx.vfsFlush().then(() => { settled = true; });
  await Promise.resolve();
  assert.strictEqual(settled, false, 'must not resolve while a commit is in flight');
  release();
  await first;
  await second;
  assert.strictEqual(settled, true);
});

test('a burst of writes inside one debounce window is refused before it overflows', async () => {
  const { ctx } = await mounted({ quota: 1000 });
  await ctx.vfsWriteFile('a.txt', 'x'.repeat(600), '');
  await assert.rejects(
    () => ctx.vfsWriteFile('b.txt', 'x'.repeat(600), ''),
    err => err.name === 'VfsError' && err.code === 'ENOSPC'
  );
  assert.strictEqual(ctx.vfsExistsSync('b.txt', ''), false);
});

test('failed ops are retried by a later flush rather than dropped', async () => {
  const { ctx, backend, errors } = await mounted();
  await ctx.vfsWriteFile('a.txt', 'A', '');
  const realCommit = backend.commit.bind(backend);
  backend.commit = async () => { throw ctx.VfsError('ENOSPC', 'transient'); };
  await ctx.vfsFlush();
  assert.strictEqual(errors.length, 1);
  backend.commit = realCommit;
  await ctx.vfsFlush();
  assert.deepStrictEqual(Object.keys(backend._snapshot.files), ['a.txt']);
});

test('the snapshot omits blobs so it stays JSON-safe', async () => {
  const { ctx, backend } = await mounted();
  await ctx.vfsWriteFile('a.txt', 'A', '');
  await ctx.vfsWriteBlob('p.png', { url: 'blob:1', kind: 'image', size: 4, mime: 'image/png' }, '');
  await ctx.vfsFlush();
  assert.deepStrictEqual(Object.keys(backend._snapshot.files), ['a.txt']);
  assert.strictEqual('blobs' in backend._snapshot, false);
});

test('a backend whose load throws still boots on an empty tree', async () => {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  const backend = ctx.createMemStorage();
  backend.load = async () => { throw new Error('corrupted store'); };
  const errors = [];
  await ctx.vfsMount(backend, { onError: err => errors.push(err) });
  assert.strictEqual(ctx.vfsIsMounted(), true);
  assert.strictEqual(errors.length, 1);
  assert.deepStrictEqual(plain(ctx.vfsListSync('')), []);
  await ctx.vfsWriteFile('a.txt', 'A', '');
  assert.strictEqual(await ctx.vfsReadFile('a.txt', ''), 'A');
});

test('writeBlob refuses to shadow a text file of the same name', async () => {
  const { ctx } = await mounted();
  await ctx.vfsWriteFile('photo.png', '', '');
  await assert.rejects(
    () => ctx.vfsWriteBlob('photo.png', { url: 'blob:1', kind: 'image', size: 9, mime: 'image/png' }, ''),
    err => err.name === 'VfsError' && err.code === 'EEXIST'
  );
});

test('renaming an entry to its own name is a no-op, including case for dirs', async () => {
  const { ctx } = await mounted();
  await ctx.vfsWriteFile('a.txt', 'payload', '');
  await ctx.vfsMkdir('DOCS', '');
  assert.strictEqual(await ctx.vfsRename('', 'a.txt', 'a.txt'), true);
  assert.strictEqual(await ctx.vfsReadFile('a.txt', ''), 'payload');
  assert.strictEqual(await ctx.vfsRename('', 'DOCS', 'docs'), true);
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS'), true);
});

test('pending bytes for a write that lands mid-commit still count against quota after the commit', async () => {
  // quota: 300. a.txt (100 chars, cost 111) commits to a real usage of 145.
  // b.txt (100 chars, cost 111) lands mid-commit and is still uncommitted
  // afterward. c.txt (40 chars, cost 51) only overflows the quota if b.txt's
  // bytes are still being held against the budget: 145 + 111 + 51 = 307 > 300.
  // If a successful commit wrongly zeroed the whole pending total instead of
  // subtracting only what it carried, this would wrongly fit: 145 + 0 + 51 = 196.
  const { ctx, backend } = await mounted({ quota: 300 });
  let release;
  const gate = new Promise(r => { release = r; });
  const realCommit = backend.commit.bind(backend);
  backend.commit = async arg => { await gate; return realCommit(arg); };

  await ctx.vfsWriteFile('a.txt', 'A'.repeat(100), '');
  const first = ctx.vfsFlush();
  await ctx.vfsWriteFile('b.txt', 'B'.repeat(100), '');   // lands mid-commit, still uncommitted
  release();
  await first;

  await assert.rejects(
    () => ctx.vfsWriteFile('c.txt', 'x'.repeat(40), ''),
    err => err.name === 'VfsError' && err.code === 'ENOSPC'
  );
  assert.strictEqual(ctx.vfsExistsSync('c.txt', ''), false);
});

test('pending writes are reported until they commit', async () => {
  const { ctx } = await mounted();
  assert.strictEqual(ctx.vfsHasPendingWrites(), false);
  await ctx.vfsWriteFile('a.txt', 'A', '');
  assert.strictEqual(ctx.vfsHasPendingWrites(), true);
  await ctx.vfsFlush();
  assert.strictEqual(ctx.vfsHasPendingWrites(), false);
});

test('move relocates a text file between directories', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('A', '');
  await ctx.vfsMkdir('B', '');
  await ctx.vfsWriteFile('A\\note.txt', 'payload', '');
  assert.strictEqual(await ctx.vfsMove('A', 'note.txt', 'B'), 'note.txt');
  assert.strictEqual(await ctx.vfsReadFile('A\\note.txt', ''), null);
  assert.strictEqual(await ctx.vfsReadFile('B\\note.txt', ''), 'payload');
});

test('move renames when a destination name is given', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('A', '');
  await ctx.vfsMkdir('B', '');
  await ctx.vfsWriteFile('A\\note.txt', 'payload', '');
  assert.strictEqual(await ctx.vfsMove('A', 'note.txt', 'B', 'copy.txt'), 'copy.txt');
  assert.strictEqual(await ctx.vfsReadFile('B\\copy.txt', ''), 'payload');
});

test('move carries a directory subtree with it', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('A', '');
  await ctx.vfsMkdir('B', '');
  await ctx.vfsMkdir('A\\SUB', '');
  await ctx.vfsWriteFile('A\\SUB\\deep.txt', 'deep', '');
  assert.strictEqual(await ctx.vfsMove('A', 'SUB', 'B'), 'SUB');
  assert.strictEqual(await ctx.vfsReadFile('B\\SUB\\deep.txt', ''), 'deep');
  assert.strictEqual(ctx.vfsDirExistsSync('A\\SUB'), false);
});

test('move refuses when the destination name is taken', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('A', '');
  await ctx.vfsMkdir('B', '');
  await ctx.vfsWriteFile('A\\note.txt', 'one', '');
  await ctx.vfsWriteFile('B\\note.txt', 'two', '');
  await assert.rejects(
    () => ctx.vfsMove('A', 'note.txt', 'B'),
    err => err.name === 'VfsError' && err.code === 'EEXIST'
  );
  assert.strictEqual(await ctx.vfsReadFile('A\\note.txt', ''), 'one');
});

test('move refuses to put a directory inside itself and leaves the tree untouched', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsWriteFile('DOCS\\note.txt', 'payload', '');
  const before = JSON.stringify(plain(ctx.vfsSerializeTree()));
  await assert.rejects(
    () => ctx.vfsMove('', 'DOCS', 'DOCS'),
    err => err.name === 'VfsError' && err.code === 'EINVAL'
  );
  assert.strictEqual(JSON.stringify(plain(ctx.vfsSerializeTree())), before,
    'a refused move must not detach the subtree');
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS'), true);
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\note.txt', ''), 'payload');
});

test('move refuses to put a directory inside its own grandchild', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('A', '');
  await ctx.vfsMkdir('A\\SUB', '');
  await ctx.vfsMkdir('A\\SUB\\DEEP', '');
  await ctx.vfsWriteFile('A\\SUB\\DEEP\\deep.txt', 'deep', '');
  const before = JSON.stringify(plain(ctx.vfsSerializeTree()));
  await assert.rejects(
    () => ctx.vfsMove('', 'A', 'A\\SUB\\DEEP'),
    err => err.name === 'VfsError' && err.code === 'EINVAL'
  );
  assert.strictEqual(JSON.stringify(plain(ctx.vfsSerializeTree())), before,
    'a refused move must not detach the subtree');
  assert.deepStrictEqual(plain(ctx.vfsListSync('')).map(e => e.name), ['A']);
  assert.strictEqual(await ctx.vfsReadFile('A\\SUB\\DEEP\\deep.txt', ''), 'deep');
});

test('move resolves the source from a path in srcName, not from the fallback directory', async () => {
  const { ctx, backend } = await mounted();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsMkdir('B', '');
  await ctx.vfsWriteFile('DOCS\\a.txt', 'payload', '');
  assert.strictEqual(await ctx.vfsMove('', 'DOCS\\a.txt', 'B'), 'a.txt');
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\a.txt', ''), null,
    'the source dirent must be removed from its real parent');
  assert.strictEqual(await ctx.vfsReadFile('B\\a.txt', ''), 'payload',
    'the destination must receive the content, not undefined');
  await ctx.vfsFlush();
  assert.strictEqual(backend._snapshot.subdirs.B.files['a.txt'], 'payload',
    'the committed snapshot must carry the moved value');
  const moved = plain(backend._ops).filter(op => op.op === 'move').pop();
  assert.strictEqual(moved.dirName, 'DOCS', 'the op log must name the real source directory');
});

test('rename resolves the source from a path in oldName, not from the fallback directory', async () => {
  const { ctx, backend } = await mounted();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsWriteFile('DOCS\\a.txt', 'payload', '');
  assert.strictEqual(await ctx.vfsRename('', 'DOCS\\a.txt', 'b.txt'), true);
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\a.txt', ''), null,
    'the source dirent must be removed from its real parent');
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\b.txt', ''), 'payload',
    'the new name must land in the source directory, not in the fallback');
  assert.strictEqual(ctx.vfsExistsSync('b.txt', ''), false,
    'the root must not gain a phantom entry');
  await ctx.vfsFlush();
  assert.strictEqual(backend._snapshot.subdirs.DOCS.files['b.txt'], 'payload',
    'the committed snapshot must carry the renamed value');
  assert.strictEqual('b.txt' in backend._snapshot.files, false);
  const renamed = plain(backend._ops).filter(op => op.op === 'rename').pop();
  assert.strictEqual(renamed.dirName, 'DOCS', 'the op log must name the real source directory');
});

test('rename collision-checks the source directory, not the fallback directory', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsWriteFile('DOCS\\a.txt', 'payload', '');
  // A name that is taken at the ROOT but free in DOCS must not block a rename
  // inside DOCS, and a name taken in DOCS must block it even though the root
  // is clear.
  await ctx.vfsWriteFile('b.txt', 'unrelated root file', '');
  assert.strictEqual(await ctx.vfsRename('', 'DOCS\\a.txt', 'b.txt'), true);
  assert.strictEqual(await ctx.vfsReadFile('b.txt', ''), 'unrelated root file',
    'the root file must be untouched');
  await ctx.vfsWriteFile('DOCS\\c.txt', 'taken', '');
  await assert.rejects(
    () => ctx.vfsRename('', 'DOCS\\b.txt', 'c.txt'),
    err => err.name === 'VfsError' && err.code === 'EEXIST'
  );
});

test('move with a path in srcName that resolves into the destination is a rename', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsWriteFile('DOCS\\a.txt', 'payload', '');
  assert.strictEqual(await ctx.vfsMove('', 'DOCS\\a.txt', 'DOCS', 'b.txt'), 'b.txt');
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\a.txt', ''), null);
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\b.txt', ''), 'payload');
});

test('move returns null for a missing source and ENOENT for a missing directory', async () => {
  const { ctx } = await mounted();
  await ctx.vfsMkdir('A', '');
  await ctx.vfsMkdir('B', '');
  assert.strictEqual(await ctx.vfsMove('A', 'nope.txt', 'B'), null);
  await assert.rejects(
    () => ctx.vfsMove('A', 'x', 'NOPE'),
    err => err.name === 'VfsError' && err.code === 'ENOENT'
  );
});

// The localStorage quota is per-origin and os/blob-store.js writes base64 image
// content into that same origin, so backend.estimate() deliberately measures
// everything rather than just the filesystem key. vfsFlush used to overwrite
// that figure with JSON.stringify(snapshot).length after every commit, throwing
// away all foreign bytes and leaving the pre-write ENOSPC guard reporting room
// that does not exist. This models a mount whose origin holds far more than the
// tree does.
test('the ENOSPC guard keeps counting origin bytes the VFS did not write', async () => {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  const inner = ctx.createMemStorage({});
  const QUOTA = 5000;
  let foreign = 4000;          // e.g. base64 blob rows from os/blob-store.js
  const backend = {
    load: () => inner.load(),
    commit: (payload) => inner.commit(payload),
    estimate: async () => {
      const own = await inner.estimate();
      return { usage: own.usage + foreign, quota: QUOTA };
    },
  };
  await ctx.vfsMount(backend, {});

  // A small write fits and commits. Usage must NOT collapse to the tree size.
  await ctx.vfsWriteFile('a.txt', 'x', '');
  await ctx.vfsFlush();
  const est = await ctx.vfsEstimate();
  assert.ok(est.usage >= foreign,
    'usage must still include the ' + foreign + ' foreign bytes, got ' + est.usage);

  // With the origin nearly full, a write that only fits if the foreign bytes
  // are ignored must be refused up front rather than accepted and lost later.
  foreign = 4900;
  await ctx.vfsWriteFile('b.txt', 'y', '');
  await ctx.vfsFlush();
  await assert.rejects(
    () => ctx.vfsWriteFile('big.txt', 'Z'.repeat(2000), ''),
    err => err.name === 'VfsError' && err.code === 'ENOSPC'
  );
});
