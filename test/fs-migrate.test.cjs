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

// ── Task 5.1: deleteDatabase() defers behind onblocked ────────────

test('the abort path closes this backend\'s own connection so the delete actually completes', async () => {
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
  assert.strictEqual(result.databaseDeleted, true,
    'with nothing else connected, closing this backend\'s own connection must let the delete complete');
  assert.strictEqual(stub._databases.size, 0,
    'a partly written database must be destroyed, not left for the next boot to read');
  assert.strictEqual(ls.getItem('sleepOS-fs'), JSON.stringify(OLD_TREE));
});

// A short explicit timeout: if this regresses to the pre-5.1 shape (no
// onblocked handling), the delete request never settles and this test would
// otherwise hang the whole suite rather than fail loudly.
test('a second open connection blocks the delete, and migration fails instead of hanging', { timeout: 2000 }, async () => {
  const { ctx, ls, stub } = migrating();
  const backend = ctx.createIdbBackend();

  // Get the database created the same way fsMigrateFromLocalStorage itself
  // does, then open a SECOND, independent connection to it and deliberately
  // never close it - standing in for another tab that is still connected
  // when this one tries to clean up after a failed migration.
  await backend._store();
  const outsideReq = stub.open('sleepOS-fs');
  const outsideConn = await new Promise((res, rej) => {
    outsideReq.onsuccess = () => res(outsideReq.result);
    outsideReq.onerror = () => rej(outsideReq.error);
  });

  let calls = 0;
  const realWrite = ctx.fsWriteEntry;
  ctx.fsWriteEntry = async (...args) => {
    calls++;
    if (calls === 2) throw new Error('disk went away mid-migration');
    return realWrite(...args);
  };

  const result = await ctx.fsMigrateFromLocalStorage(backend);
  ctx.fsWriteEntry = realWrite;
  outsideConn.close();

  assert.strictEqual(result.migrated, false);
  assert.strictEqual(result.reason, 'failed');
  assert.strictEqual(result.databaseDeleted, false,
    'a connection this backend does not own must block the delete, not be silently ignored');
  // The partial database is still there - not gone, but not readable as a
  // real filesystem either, since `migrated` was never set on it.
  assert.strictEqual(stub._databases.size, 1);
  assert.strictEqual(ls.getItem('sleepOS-fs'), JSON.stringify(OLD_TREE));
});

test('a blocked delete is distinguishable from a clean abort in the return value', async () => {
  function inject(ctx) {
    let calls = 0;
    const realWrite = ctx.fsWriteEntry;
    ctx.fsWriteEntry = async (...args) => {
      calls++;
      if (calls === 2) throw new Error('disk went away mid-migration');
      return realWrite(...args);
    };
    return () => { ctx.fsWriteEntry = realWrite; };
  }

  const clean = migrating();
  const restoreClean = inject(clean.ctx);
  const cleanResult = await clean.ctx.fsMigrateFromLocalStorage(clean.ctx.createIdbBackend());
  restoreClean();

  const blocked = migrating();
  const blockedBackend = blocked.ctx.createIdbBackend();
  await blockedBackend._store();
  const outsideReq = blocked.stub.open('sleepOS-fs');
  const outsideConn = await new Promise((res, rej) => {
    outsideReq.onsuccess = () => res(outsideReq.result);
    outsideReq.onerror = () => rej(outsideReq.error);
  });
  const restoreBlocked = inject(blocked.ctx);
  const blockedResult = await blocked.ctx.fsMigrateFromLocalStorage(blockedBackend);
  restoreBlocked();
  outsideConn.close();

  // Both are commit failures and share the same `reason` - `reason` alone
  // cannot tell Task 6 "the partial database is really gone" apart from
  // "it is still sitting there, unreachable but not destroyed". That is
  // exactly what databaseDeleted is for.
  assert.strictEqual(cleanResult.reason, 'failed');
  assert.strictEqual(blockedResult.reason, 'failed');
  assert.strictEqual(cleanResult.databaseDeleted, true);
  assert.strictEqual(blockedResult.databaseDeleted, false);
});

// The bug this exists for, found in the browser and not by any of the tests
// above: on the FIRST boot after an upgrade, the user's whole filesystem was
// imported into IndexedDB and then thrown away, and they were shown the seed
// tree instead.
//
// Every other migration test in this file verifies the import by loading
// through a SECOND backend instance - `ctx.createIdbBackend().load()`. That
// instance did not create the superblock, so its `freshlyCreated` is false and
// its load() returns the tree. The real boot does not work that way:
// fsChooseBackend opens ONE backend, calls _store() on it (which creates the
// superblock, setting freshlyCreated), migrates into it, and then mounts THAT
// SAME instance. Its load() hit `if (freshlyCreated) return null` and the VFS
// seeded over the top.
//
// So the whole suite proved "the data reached the database" and never "the
// boot that migrated it can read it back". This asserts the second thing, on
// the one instance that matters.
test('the same backend that migrates can read the tree back on that boot', async () => {
  const { ctx } = migrating();
  const backend = ctx.createIdbBackend();
  // Exactly fsChooseBackend's order: force the connection open first, so the
  // superblock is created by this instance, then migrate into it.
  await backend._store();
  const result = await ctx.fsMigrateFromLocalStorage(backend);
  assert.strictEqual(result.migrated, true);

  const tree = await backend.load();
  assert.ok(tree, 'load() returned null, so the VFS would seed the default tree over a real filesystem');
  assert.strictEqual(tree.files['ROOT.txt'], 'at the root');
  assert.strictEqual(tree.subdirs.DOCS.files['INNER.txt'], 'nested content');
});

// The other half of the same condition, and the reason the fix cannot simply
// delete the freshlyCreated check: a brand-new visitor with nothing to migrate
// must still get null, or the VFS skips seeding and they boot into a
// filesystem with no DOCS and no README.
test('a first boot with nothing to migrate still asks the VFS to seed', async () => {
  const { ctx, ls } = migrating();
  ls.removeItem('sleepOS-fs');
  const backend = ctx.createIdbBackend();
  await backend._store();
  const result = await ctx.fsMigrateFromLocalStorage(backend);
  assert.strictEqual(result.reason, 'nothing-to-migrate');
  assert.strictEqual(await backend.load(), null,
    'an empty database created this session means seed the defaults');
});

// And the third case, which is why emptiness alone is not the signal either:
// a returning visitor who deleted everything has a real empty drive, and
// re-seeding it would resurrect files they deleted on purpose.
test('a deliberately emptied drive is not re-seeded on a later boot', async () => {
  const { ctx, ls } = migrating();
  ls.removeItem('sleepOS-fs');
  await ctx.createIdbBackend()._store();          // first boot creates the db
  // The stub commits a transaction on a setImmediate once its requests drain,
  // so the superblock ensure() just wrote is still buffered here. Without this
  // yield the next backend opens before that commit lands, sees no superblock,
  // creates its own, and this test passes or fails on stub timing rather than
  // on the behavior it names.
  await new Promise(r => setImmediate(r));
  const later = ctx.createIdbBackend();            // a later boot, same db
  const tree = await later.load();
  assert.notStrictEqual(tree, null, 'an existing empty database is a real empty drive, not a fresh install');
  // Length rather than deepStrictEqual: the array comes from the vm realm, so
  // it is not reference-equal to a host [] even when its contents match.
  assert.strictEqual(tree.dirs.length, 0);
  assert.strictEqual(Object.keys(tree.files).length, 0);
});
