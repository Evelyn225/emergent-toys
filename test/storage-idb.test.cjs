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
