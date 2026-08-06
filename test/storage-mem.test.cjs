'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function ctxWithMem() {
  return loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
}

test('load returns null when nothing was seeded', async () => {
  const ctx = ctxWithMem();
  assert.strictEqual(await ctx.createMemStorage().load(), null);
});

test('load returns the seeded tree', async () => {
  const ctx = ctxWithMem();
  const tree = { dirs: ['DOCS'], files: { 'a.txt': 'hello' }, subdirs: {} };
  assert.deepStrictEqual(await ctx.createMemStorage({ tree }).load(), tree);
});

test('commit records ops and the snapshot, and load reflects it', async () => {
  const ctx = ctxWithMem();
  const be = ctx.createMemStorage();
  const snapshot = { dirs: [], files: { 'b.txt': 'x' }, subdirs: {} };
  await be.commit({ ops: [{ op: 'write', dirName: '', name: 'b.txt' }], snapshot });
  assert.deepStrictEqual(plain(be._ops), [{ op: 'write', dirName: '', name: 'b.txt' }]);
  assert.deepStrictEqual(await be.load(), snapshot);
});

test('commit throws ENOSPC when the snapshot exceeds quota', async () => {
  const ctx = ctxWithMem();
  const be = ctx.createMemStorage({ quota: 200 });
  const snapshot = { dirs: [], files: { 'big.txt': 'x'.repeat(500) }, subdirs: {} };
  await assert.rejects(
    () => be.commit({ ops: [], snapshot }),
    err => err.name === 'VfsError' && err.code === 'ENOSPC'
  );
});

test('a rejected commit does not change what load returns', async () => {
  const ctx = ctxWithMem();
  const be = ctx.createMemStorage({ quota: 200 });
  await be.commit({ ops: [], snapshot: { dirs: [], files: {}, subdirs: {} } });
  await assert.rejects(() => be.commit({ ops: [], snapshot: { dirs: [], files: { a: 'x'.repeat(500) }, subdirs: {} } }));
  assert.deepStrictEqual(await be.load(), { dirs: [], files: {}, subdirs: {} });
});

test('estimate reports usage against quota', async () => {
  const ctx = ctxWithMem();
  const be = ctx.createMemStorage({ quota: 1000 });
  await be.commit({ ops: [], snapshot: { dirs: [], files: { 'a.txt': 'hello' }, subdirs: {} } });
  const est = await be.estimate();
  assert.strictEqual(est.quota, 1000);
  assert.ok(est.usage > 0 && est.usage < 1000);
});
