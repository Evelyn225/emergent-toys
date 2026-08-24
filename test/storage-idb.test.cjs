'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeIndexedDbStub, plain } = require('./helpers/load-os.cjs');

// Deliberately thin. The logic lives in os/fs-format.js and is covered by
// test/fs-format.test.cjs against a Map; this file only checks the plumbing
// between that logic and the IndexedDB API surface.
function idb(overrides) {
  const stub = makeIndexedDbStub();
  const ctx = makeOsContext(Object.assign({
    indexedDB: stub,
    navigator: { storage: { estimate: async () => ({ usage: 1234, quota: 5 * 1024 * 1024 }) } },
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  return { ctx, stub };
}

test('the backend declares that it does not want a snapshot', () => {
  const { ctx } = idb();
  assert.strictEqual(ctx.createIdbBackend().needsSnapshot, false);
});

test('loading an empty database yields null so the VFS seeds a fresh tree', async () => {
  const { ctx } = idb();
  assert.strictEqual(await ctx.createIdbBackend().load(), null);
});

test('a committed write survives a reload through a brand new backend', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
    readEntry: () => ({ kind: 'file', text: 'persisted', dirName: '', name: 'A.txt' }),
  });
  // A second backend over the same database is the real test: it proves the
  // bytes are in the store rather than in the first backend's memory.
  const tree = await ctx.createIdbBackend().load();
  assert.strictEqual(tree.files['A.txt'], 'persisted');
});

test('estimate reports the browser numbers, not invented ones', async () => {
  const { ctx } = idb();
  const est = await ctx.createIdbBackend().estimate();
  assert.strictEqual(est.usage, 1234);
  assert.strictEqual(est.quota, 5 * 1024 * 1024);
});

test('availability is false when the environment has no indexedDB', () => {
  const ctx = makeOsContext({ indexedDB: undefined });
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  assert.strictEqual(ctx.fsIdbAvailable(), false);
});

test('deleting the database really removes it', async () => {
  const { ctx, stub } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
    readEntry: () => ({ kind: 'file', text: 'x', dirName: '', name: 'A.txt' }),
  });
  assert.strictEqual(stub._databases.size, 1);
  // Task 5.1: deleteDatabase() now defers behind onblocked for as long as any
  // connection stays open, matching real IndexedDB - this backend's own
  // connection is exactly such a connection, so it has to be closed first,
  // the same way migration's abort path (os/fs-migrate.js) does.
  await backend._close();
  await ctx.fsIdbDeleteDatabase();
  assert.strictEqual(stub._databases.size, 0);
});

// ── Step 5.5: guard the commit loop against a silently-dropped op ────

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Every op name os/vfs.js can emit, taken from the source rather than a list
// kept by hand - a list by hand is how the emitter and the handler drift apart.
function extractEmittedOps() {
  const src = fs.readFileSync(path.join(ROOT, 'os/vfs.js'), 'utf8');
  const found = new Set();
  const re = /_vfsQueue\(\s*\{\s*op:\s*'([a-zA-Z]+)'/g;
  let m;
  while ((m = re.exec(src))) found.add(m[1]);
  return found;
}

function extractHandledOps() {
  const src = fs.readFileSync(path.join(ROOT, 'os/storage-idb.js'), 'utf8');
  const found = new Set();
  const re = /op\.op\s*===\s*'([a-zA-Z]+)'/g;
  let m;
  while ((m = re.exec(src))) found.add(m[1]);
  return found;
}

test('every op the VFS can emit is handled by the IndexedDB commit loop', () => {
  const emitted = extractEmittedOps();
  const handled = extractHandledOps();
  // Guards the guard: if the regex stops matching (e.g. _vfsQueue is renamed or
  // the op literals move), this fails loudly instead of the assert below
  // passing vacuously against an empty set.
  assert.ok(emitted.size >= 6,
    'expected to find the VFS op emission sites - extraction regex may be broken (found ' + emitted.size + ')');
  // `write` and `writeBlob` share the fall-through content branch rather than
  // an `op.op ===` test, so they are the two legitimate exceptions.
  const missing = [...emitted].filter(name =>
    !handled.has(name) && name !== 'write' && name !== 'writeBlob');
  assert.deepStrictEqual(missing, [],
    'os/vfs.js emits these ops but os/storage-idb.js has no branch for them: ' + missing.join(', '));
});

// ── Task 4.5: a commit is one transaction, or it is nothing ──────────

// A full dump of every store's actually-committed data, read directly off
// the stub's backing Maps rather than through the adapter - so a "leaves the
// store byte-identical" assertion is checking the real persisted state, not
// re-deriving it through the same code path being tested.
function dumpDb(stub, dbName) {
  const db = stub._databases.get(dbName);
  if (!db) return null;
  const out = {};
  db._stores.forEach((map, name) => {
    out[name] = [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  });
  return out;
}

function idbWithFailure() {
  const stub = makeIndexedDbStub();
  const ctx = makeOsContext({
    indexedDB: stub,
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js']);
  return { ctx, stub };
}

test('a commit whose write fails partway leaves the store byte-identical to before it', async () => {
  const { ctx, stub } = idbWithFailure();
  const backend = ctx.createIdbBackend();
  await backend.load();
  // One op that lands cleanly first, so the assertion below proves a
  // rollback is whole-transaction, not just "this one write didn't happen".
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'BEFORE.txt' }],
    readEntry: () => ({ kind: 'file', text: 'already here', dirName: '', name: 'BEFORE.txt' }),
  });
  const before = dumpDb(stub, 'sleepOS-fs');

  stub._failNthWriteFromNow(3);
  let threw = null;
  try {
    await backend.commit({
      ops: [
        { op: 'mkdir', dirName: '', name: 'SUB' },
        { op: 'write', dirName: '', name: 'A.txt' },
        { op: 'write', dirName: '', name: 'B.txt' },
      ],
      readEntry: (dirName, name) => ({ kind: 'file', text: 'x'.repeat(4096 * 2), dirName, name }),
    });
  } catch (e) { threw = e; }
  assert.ok(threw, 'a write failure must reject the commit, not swallow it');

  const after = dumpDb(stub, 'sleepOS-fs');
  assert.deepStrictEqual(after, before,
    'a failed commit must leave every store exactly as it was, not half-applied');
});

test('a successful commit after a failed one is not starved by a stale in-memory superblock', async () => {
  const { ctx, stub } = idbWithFailure();
  // A tiny disk: the failed commit below allocates 2 of 4 blocks in memory
  // before its 2nd block write is made to fail. If the cached superblock
  // survives the rollback, the next commit sees only 2 blocks free and a
  // 3-block write spuriously throws ENOSPC even though the whole disk is
  // actually empty, because nothing from the failed commit ever persisted.
  const backend = ctx.createIdbBackend({ totalBlocks: 4 });
  await backend.load();

  stub._failNthWriteFromNow(2);
  let threw = null;
  try {
    await backend.commit({
      ops: [{ op: 'write', dirName: '', name: 'FAIL.txt' }],
      readEntry: () => ({ kind: 'file', text: 'x'.repeat(4096 * 2), dirName: '', name: 'FAIL.txt' }),
    });
  } catch (e) { threw = e; }
  assert.ok(threw, 'setup: the injected failure must actually fire');

  // No further failure armed - this must succeed. A stale sb that still
  // thinks 2 of 4 blocks are taken would fail this with a fabricated ENOSPC.
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'OK.txt' }],
    readEntry: () => ({ kind: 'file', text: 'x'.repeat(4096 * 3), dirName: '', name: 'OK.txt' }),
  });

  const tree = await ctx.createIdbBackend().load();
  assert.strictEqual(tree.files['OK.txt'], 'x'.repeat(4096 * 3));
  assert.strictEqual(tree.files['FAIL.txt'], undefined, 'the failed write must not have landed');
});

test('a successful multi-op commit applies every op, not just the first or the last', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  await backend.commit({
    ops: [
      { op: 'mkdir', dirName: '', name: 'SUB' },
      { op: 'write', dirName: '', name: 'A.txt' },
      { op: 'write', dirName: 'SUB', name: 'B.txt' },
    ],
    readEntry: (dirName, name) => ({ kind: 'file', text: name + '-content', dirName, name }),
  });
  const tree = await ctx.createIdbBackend().load();
  assert.strictEqual(tree.files['A.txt'], 'A.txt-content');
  assert.ok(tree.dirs.includes('SUB'), 'mkdir must not be silently dropped from a multi-op batch');
  assert.strictEqual(tree.subdirs.SUB.files['B.txt'], 'B.txt-content');
});

test('scan() cannot observe a write landing between what used to be two separate reads', async () => {
  // Two parts. First, prove the STUB is actually capable of exhibiting what
  // the old scan() shape was vulnerable to - reproduce that shape by hand
  // (two separate db.transaction() calls, with a competing write from a
  // third transaction landing between them) and confirm the two reads really
  // do disagree here. If this assertion ever fails, the structural check
  // below is not evidence of anything, because the hazard it guards against
  // could never actually occur in this stub.
  const { ctx, stub } = idb();
  const backend = ctx.createIdbBackend();
  await backend.load();
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'ONE.txt' }, { op: 'write', dirName: '', name: 'TWO.txt' }],
    readEntry: (dirName, name) => ({ kind: 'file', text: name, dirName, name }),
  });

  const db = stub._databases.get('sleepOS-fs');
  const oldKeysReq = db.transaction(['dirents'], 'readonly').objectStore('dirents').getAllKeys();
  const oldKeys = await new Promise((res, rej) => {
    oldKeysReq.onsuccess = () => res(oldKeysReq.result);
    oldKeysReq.onerror = () => rej(oldKeysReq.error);
  });
  const writeTx = db.transaction(['dirents'], 'readwrite');
  const putReq = writeTx.objectStore('dirents').put(999, '0/THREE.txt');
  await new Promise((res, rej) => { putReq.onsuccess = res; putReq.onerror = () => rej(putReq.error); });
  // The put request resolving is not the same as the write being durable -
  // this stub (like real IndexedDB) only applies a transaction's writes when
  // the transaction itself completes, which is why this waits for oncomplete
  // rather than treating the request's own success as "done".
  await new Promise((res, rej) => { writeTx.oncomplete = res; writeTx.onabort = () => rej(new Error('write tx aborted')); });
  const oldValuesReq = db.transaction(['dirents'], 'readonly').objectStore('dirents').getAll();
  const oldValues = await new Promise((res, rej) => {
    oldValuesReq.onsuccess = () => res(oldValuesReq.result);
    oldValuesReq.onerror = () => rej(oldValuesReq.error);
  });
  assert.notStrictEqual(oldKeys.length, oldValues.length,
    'this stub must be able to show two separate transactions observing different ' +
    'snapshots, or the structural check below is not evidence of anything');

  // Second, the actual regression guard. Timing a real race through the
  // adapter's own scan() from outside it is exactly as fragile as the bug it
  // would be proving fixed - it would depend on landing a competing write in
  // a specific microtask gap inside a function this test does not control.
  // The structural property that actually prevents the race is checkable
  // directly and does not depend on timing: each scan() must open its store
  // ONCE and issue both getAllKeys and getAll against that same reference,
  // never opening a second store or transaction in between.
  const src = fs.readFileSync(path.join(ROOT, 'os/storage-idb.js'), 'utf8');
  const scanBodies = [...src.matchAll(/async scan\(name\) \{([\s\S]*?)\n\s{4}\},/g)].map(m => m[1]);
  assert.ok(scanBodies.length >= 2,
    'expected to find both scan() implementations (_fsIdbStore and _fsIdbTxStore) - ' +
    'extraction regex may be broken (found ' + scanBodies.length + ')');
  scanBodies.forEach((body, i) => {
    const opens = (body.match(/=\s*(tx|os)\(name/g) || []).length;
    assert.strictEqual(opens, 1,
      `scan() #${i + 1} opens the store ${opens} time(s) - it must open once and reuse ` +
      'it for both getAllKeys() and getAll()');
  });
});

test('load() distinguishes a never-written database from one the user emptied', async () => {
  const { ctx } = idb();
  const first = ctx.createIdbBackend();
  assert.strictEqual(await first.load(), null, 'a database with no prior session has never been written');

  await first.commit({
    ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
    readEntry: () => ({ kind: 'file', text: 'x', dirName: '', name: 'A.txt' }),
  });
  await first.commit({
    ops: [{ op: 'unlink', dirName: '', name: 'A.txt', kind: 'file' }],
    readEntry: () => null,
  });

  // A brand new backend instance over the same database: the superblock
  // already exists from the commits above, so this must NOT be treated as
  // never-written even though the tree it loads back is empty.
  const second = ctx.createIdbBackend();
  const tree = await second.load();
  assert.notStrictEqual(tree, null, 'an emptied drive is a real empty tree, not "never written"');
  assert.deepStrictEqual(plain(tree.dirs), []);
  assert.deepStrictEqual(plain(tree.files), {});
});

test('a rewrite interrupted mid-release leaves the original file intact, not interleaved', async () => {
  const { ctx, stub } = idbWithFailure();
  const backend = ctx.createIdbBackend();
  await backend.load();

  const original = 'ORIGINAL-'.repeat(2000); // several blocks worth
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
    readEntry: () => ({ kind: 'file', text: original, dirName: '', name: 'A.txt' }),
  });

  // Arm a failure early enough to land while _fsReleaseInode is still
  // deleting the OLD file's blocks - the exact request it lands on doesn't
  // matter, since NO partial state may ever become visible either way.
  stub._failNthWriteFromNow(2);
  let threw = null;
  try {
    await backend.commit({
      ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
      readEntry: () => ({ kind: 'file', text: 'REPLACEMENT'.repeat(2000), dirName: '', name: 'A.txt' }),
    });
  } catch (e) { threw = e; }
  assert.ok(threw, 'setup: the injected mid-release failure must actually fire');

  const tree = await ctx.createIdbBackend().load();
  // The bug this guards against preserves the ORIGINAL length exactly while
  // splicing a later block's bytes into a deleted block's position - so
  // asserting length alone would pass against the very failure this is
  // meant to catch. Only a full content comparison catches it.
  assert.strictEqual(tree.files['A.txt'], original,
    'a rolled-back rewrite must leave the original content completely intact, not spliced ' +
    'with a neighboring block\'s bytes');
});

// ── Task 4.6: the failure path must not fail ──────────────────────

test('a write REQUEST failure (the kind that auto-aborts its own transaction) still lets the next commit run clean', async () => {
  // Distinct from 4.5's "stale in-memory superblock" test in what it is
  // actually proving: that test caught the underlying bug too, but this one
  // exists specifically to guard the interaction 4.6 fixes - a failing
  // request auto-aborts the transaction before commit()'s own catch block
  // ever calls tx.abort(), so that call is redundant and (in a real browser)
  // throws InvalidStateError. If that throw escapes commit()'s catch block
  // before the cache-discard lines run, the stale sb survives and this test
  // fails the same way the 4.5 one did.
  const { ctx, stub } = idbWithFailure();
  const backend = ctx.createIdbBackend({ totalBlocks: 4 });
  await backend.load();

  // _failNthWriteFromNow fails a real put() REQUEST from inside the store,
  // not a hand-thrown error from the commit loop's own logic - this is what
  // disk pressure, a quota rejection, or a closed connection look like.
  stub._failNthWriteFromNow(2);
  let threw = null;
  try {
    await backend.commit({
      ops: [{ op: 'write', dirName: '', name: 'FAIL.txt' }],
      readEntry: () => ({ kind: 'file', text: 'x'.repeat(4096 * 2), dirName: '', name: 'FAIL.txt' }),
    });
  } catch (e) { threw = e; }
  assert.ok(threw, 'setup: the injected write failure must actually fire');

  // No further failure armed. A stale sb surviving the failed commit above
  // would make this throw a fabricated ENOSPC, because it would still think
  // 2 of the 4 blocks are taken even though nothing from that commit ever
  // actually persisted.
  await backend.commit({
    ops: [{ op: 'write', dirName: '', name: 'OK.txt' }],
    readEntry: () => ({ kind: 'file', text: 'x'.repeat(4096 * 3), dirName: '', name: 'OK.txt' }),
  });

  const tree = await ctx.createIdbBackend().load();
  assert.strictEqual(tree.files['OK.txt'], 'x'.repeat(4096 * 3));
  assert.strictEqual(tree.files['FAIL.txt'], undefined, 'the failed write must not have landed');
});

test('commit() rejects with the real cause, not the InvalidStateError from a redundant abort', async () => {
  const { ctx, stub } = idbWithFailure();
  const backend = ctx.createIdbBackend();
  await backend.load();

  stub._failNthWriteFromNow(1);
  let threw = null;
  try {
    await backend.commit({
      ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
      readEntry: () => ({ kind: 'file', text: 'x', dirName: '', name: 'A.txt' }),
    });
  } catch (e) { threw = e; }
  assert.ok(threw, 'setup: the injected write failure must actually fire');
  // The real cause is what needs to reach vfsFlush's onError and, from
  // there, the user - not an artifact of cleaning up a transaction that a
  // failing request had already finished on its own.
  assert.strictEqual(threw.name, 'SimulatedFailure');
});

// ── Task 4.7: a cleanup failure must not displace the real one ───────

test('an abort() failure other than InvalidStateError is attached to the original error, not thrown in its place', async () => {
  const { ctx, stub } = idbWithFailure();
  const backend = ctx.createIdbBackend();
  await backend.load();

  stub._failNthWriteFromNow(1);
  const weirdAbortError = new Error('the connection just died mid-abort');
  weirdAbortError.name = 'WeirdAbortError';
  stub._forceNextAbortToThrow(weirdAbortError);

  let threw = null;
  try {
    await backend.commit({
      ops: [{ op: 'write', dirName: '', name: 'A.txt' }],
      readEntry: () => ({ kind: 'file', text: 'x', dirName: '', name: 'A.txt' }),
    });
  } catch (e) { threw = e; }
  assert.ok(threw, 'setup: the injected write failure must actually fire');
  // `err` (the write failure) is why the commit actually failed and is what
  // must reach vfsFlush's onError - a second, unrelated cleanup failure must
  // not hide it by taking its place.
  assert.strictEqual(threw.name, 'SimulatedFailure',
    'the write failure must remain the primary error, not be displaced by the abort failure');
  // But the cleanup failure is real too and must not simply vanish.
  assert.strictEqual(threw.abortError, weirdAbortError,
    'a non-InvalidStateError abort failure must still be reachable from the thrown error');
});

test('the drive is 4096 blocks, which is 16 MB at 4 KB per block', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  await backend._store();
  const sb = backend._superblock;
  assert.strictEqual(sb.totalBlocks, 4096);
  assert.strictEqual(sb.totalBlocks * sb.blockSize, 16 * 1024 * 1024);
  // 4096 blocks needs 512 bytes of bitmap.
  assert.strictEqual(sb.freeBitmap.length, 512);
});

// The stub settles a transaction on a setImmediate once its requests drain, so a
// read issued in the same tick as a write opens its transaction before the write
// has committed and sees nothing. Yielding a macrotask is what makes a read-back
// mean "what is durable" rather than "what happened to have landed".
const settle = () => new Promise(r => setImmediate(r));

test('_readInodeEntries hands back the ino alongside each inode', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  const store = await backend._store();
  const ino = await ctx.fsWriteEntry(store, backend._superblock, 0, 'A.txt', {
    type: 'file', bytes: ctx.fsEncodeText('hello'),
  });
  await settle();
  const entries = await backend._readInodeEntries();
  const found = entries.find(([k]) => k === ino);
  assert.ok(found, 'the written inode is missing from the entries');
  assert.strictEqual(found[1].type, 'file');
  assert.strictEqual(typeof found[0], 'number', 'the ino must be a Number, not a key string');
});

test('_moveBlock relocates the bytes, the inode slot and both bitmap bits', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  const store = await backend._store();
  const sb = backend._superblock;
  const ino = await ctx.fsWriteEntry(store, sb, 0, 'A.txt', {
    type: 'file', bytes: ctx.fsEncodeText('move me'),
  });
  await settle();
  const before = (await store.get('inodes', ino)).blocks[0];
  const target = sb.totalBlocks - 1;

  await backend._moveBlock({ ino, slot: 0, from: before, to: target });
  await settle();

  const after = await store.get('inodes', ino);
  assert.strictEqual(after.blocks[0], target, 'the inode still points at the old block');
  assert.strictEqual(ctx.fsBitGet(backend._superblock.freeBitmap, target), 1, 'destination not marked used');
  assert.strictEqual(ctx.fsBitGet(backend._superblock.freeBitmap, before), 0, 'source not freed');
  assert.strictEqual(await store.get('blocks', before), undefined, 'the old block was not deleted');
  assert.strictEqual(
    ctx.fsDecodeText(await ctx.fsReadEntryBytes(store, backend._superblock, ino)),
    'move me');
});

test('a stale move is refused and changes nothing', async () => {
  const { ctx } = idb();
  const backend = ctx.createIdbBackend();
  const store = await backend._store();
  const sb = backend._superblock;
  const ino = await ctx.fsWriteEntry(store, sb, 0, 'A.txt', {
    type: 'file', bytes: ctx.fsEncodeText('intact'),
  });
  await settle();
  const real = (await store.get('inodes', ino)).blocks[0];

  // `from` names a block this inode does not own. That means the disk is not
  // where the plan thought it was, and moving anyway would relocate a block on
  // behalf of an inode that stopped claiming it.
  await assert.rejects(
    () => backend._moveBlock({ ino, slot: 0, from: real + 50, to: sb.totalBlocks - 1 }),
    err => err.code === 'EINVAL');
  await settle();

  // The backend discards its cached superblock on a rolled-back transaction,
  // so re-open before reading anything back.
  const store2 = await backend._store();
  assert.strictEqual((await store2.get('inodes', ino)).blocks[0], real,
    'the inode moved despite the move being refused');
  assert.strictEqual(
    ctx.fsDecodeText(await ctx.fsReadEntryBytes(store2, backend._superblock, ino)),
    'intact');
});
