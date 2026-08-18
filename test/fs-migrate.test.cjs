'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, makeLocalStorageStub, makeIndexedDbStub } = require('./helpers/load-os.cjs');

const OLD_TREE = {
  dirs: ['DOCS'],
  files: { 'ROOT.txt': 'at the root' },
  subdirs: {
    DOCS: { dirs: [], files: { 'INNER.txt': 'nested content' }, subdirs: {} },
  },
};

function migrating() {
  const ls = makeLocalStorageStub();
  ls.setItem('sleepOS-fs', JSON.stringify(OLD_TREE));
  const stub = makeIndexedDbStub();
  const ctx = makeOsContext({
    localStorage: ls,
    indexedDB: stub,
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: Infinity }) } },
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/fs-format.js', 'os/storage-idb.js', 'os/fs-migrate.js']);
  return { ctx, ls, stub };
}

test('a populated localStorage tree migrates with every file intact', async () => {
  const { ctx } = migrating();
  const backend = ctx.createIdbBackend();
  const result = await ctx.fsMigrateFromLocalStorage(backend);
  assert.strictEqual(result.migrated, true);

  const tree = await ctx.createIdbBackend().load();
  assert.strictEqual(tree.files['ROOT.txt'], 'at the root');
  assert.strictEqual(tree.subdirs.DOCS.files['INNER.txt'], 'nested content');
  assert.deepStrictEqual([...tree.dirs], ['DOCS']);
});

test('the old localStorage keys survive migration', async () => {
  const { ctx, ls } = migrating();
  await ctx.fsMigrateFromLocalStorage(ctx.createIdbBackend());
  assert.ok(ls.getItem('sleepOS-fs'), 'the old tree is kept for one release so a bad migration is recoverable');
});

test('migration is re-runnable and does not duplicate anything', async () => {
  const { ctx } = migrating();
  await ctx.fsMigrateFromLocalStorage(ctx.createIdbBackend());
  const second = await ctx.fsMigrateFromLocalStorage(ctx.createIdbBackend());
  assert.strictEqual(second.migrated, false);
  assert.strictEqual(second.reason, 'already-migrated');
  const tree = await ctx.createIdbBackend().load();
  assert.strictEqual(tree.files['ROOT.txt'], 'at the root');
  assert.strictEqual(Object.keys(tree.files).length, 1);
});

test('nothing to migrate is reported rather than treated as a failure', async () => {
  const { ctx, ls } = migrating();
  ls.removeItem('sleepOS-fs');
  const result = await ctx.fsMigrateFromLocalStorage(ctx.createIdbBackend());
  assert.strictEqual(result.migrated, false);
  assert.strictEqual(result.reason, 'nothing-to-migrate');
});

test('a corrupt localStorage tree is reported, not thrown', async () => {
  const { ctx, ls } = migrating();
  ls.setItem('sleepOS-fs', '{not json');
  const result = await ctx.fsMigrateFromLocalStorage(ctx.createIdbBackend());
  assert.strictEqual(result.migrated, false);
  assert.strictEqual(result.reason, 'unreadable');
});

// THE IMPORTANT ONE. A half-migrated filesystem is worse than an unmigrated
// one, so a failure partway must leave no database at all.
test('a failure partway deletes the database and leaves localStorage untouched', async () => {
  const { ctx, ls, stub } = migrating();
  const backend = ctx.createIdbBackend();
  let calls = 0;
  const realWrite = ctx.fsWriteEntry;
  ctx.fsWriteEntry = async (...args) => {
    calls++;
    if (calls === 2) throw new Error('disk went away mid-migration');
    return realWrite(...args);
  };

  const result = await ctx.fsMigrateFromLocalStorage(backend);
  ctx.fsWriteEntry = realWrite;

  assert.strictEqual(result.migrated, false);
  assert.strictEqual(result.reason, 'failed');
  assert.strictEqual(stub._databases.size, 0,
    'a partly written database must be destroyed, not left for the next boot to read');
  assert.strictEqual(ls.getItem('sleepOS-fs'), JSON.stringify(OLD_TREE),
    'localStorage is the fallback and must be exactly as it was');
});
