'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function ctxWithLocal(quotaBytes) {
  return loadOsSources(makeOsContext({ quotaBytes }), ['os/vfs.js', 'os/storage-local.js']);
}

test('load returns null when the key is absent', async () => {
  const ctx = ctxWithLocal();
  assert.strictEqual(await ctx.createLocalStorageBackend().load(), null);
});

test('load parses an existing sleepOS-fs payload', async () => {
  const ctx = ctxWithLocal();
  const tree = { dirs: ['DOCS'], files: { 'a.txt': 'A' }, subdirs: {} };
  ctx.localStorage.setItem('sleepOS-fs', JSON.stringify(tree));
  assert.deepStrictEqual(await ctx.createLocalStorageBackend().load(), tree);
});

test('load returns null on corrupted JSON rather than throwing', async () => {
  const ctx = ctxWithLocal();
  ctx.localStorage.setItem('sleepOS-fs', '{not json');
  assert.strictEqual(await ctx.createLocalStorageBackend().load(), null);
});

test('commit writes the snapshot under the legacy key', async () => {
  const ctx = ctxWithLocal();
  const snapshot = { dirs: [], files: { 'b.txt': 'B' }, subdirs: {} };
  await ctx.createLocalStorageBackend().commit({ ops: [], snapshot });
  assert.deepStrictEqual(JSON.parse(ctx.localStorage.getItem('sleepOS-fs')), snapshot);
});

test('commit throws ENOSPC instead of swallowing a quota error', async () => {
  const ctx = ctxWithLocal(120);
  const snapshot = { dirs: [], files: { 'big.txt': 'x'.repeat(5000) }, subdirs: {} };
  await assert.rejects(
    () => ctx.createLocalStorageBackend().commit({ ops: [], snapshot }),
    err => err.name === 'VfsError' && err.code === 'ENOSPC'
  );
});

test('a non-quota storage failure is EACCES, not ENOSPC', async () => {
  const ctx = ctxWithLocal();
  ctx.localStorage.setItem = () => {
    const err = new Error('The operation is insecure.');
    err.name = 'SecurityError';
    throw err;
  };
  await assert.rejects(
    () => ctx.createLocalStorageBackend().commit({ ops: [], snapshot: { dirs: [], files: {}, subdirs: {} } }),
    err => err.name === 'VfsError' && err.code === 'EACCES'
  );
});

test('a legacy Firefox quota error is still ENOSPC', async () => {
  const ctx = ctxWithLocal();
  ctx.localStorage.setItem = () => {
    const err = new Error('persistent storage maximum size reached');
    err.name = 'NS_ERROR_DOM_QUOTA_REACHED';
    throw err;
  };
  await assert.rejects(
    () => ctx.createLocalStorageBackend().commit({ ops: [], snapshot: { dirs: [], files: {}, subdirs: {} } }),
    err => err.name === 'VfsError' && err.code === 'ENOSPC'
  );
});

test('estimate counts every key in the origin, not just the filesystem key', async () => {
  const ctx = ctxWithLocal(10000);
  const be = ctx.createLocalStorageBackend();
  await be.commit({ ops: [], snapshot: { dirs: [], files: { 'a.txt': 'hello' }, subdirs: {} } });
  const withFsOnly = (await be.estimate()).usage;

  // Something else in the OS writes to the same origin budget - this is what
  // blob-store.js does for every uploaded image.
  ctx.localStorage.setItem('sleepOS-blob:photo.png', 'x'.repeat(500));
  const withBlob = (await be.estimate()).usage;

  assert.ok(withBlob >= withFsOnly + 500, 'blob bytes must count against the same quota');
  assert.strictEqual((await be.estimate()).quota, 5 * 1024 * 1024);
});
