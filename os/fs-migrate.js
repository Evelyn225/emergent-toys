// One-shot import of a phase 2 localStorage filesystem into the block layer.
//
// Two rules govern everything here:
//
//   1. The old localStorage keys are LEFT IN PLACE for one release. A failed
//      migration is then recoverable and re-runnable, and a visitor whose
//      import went wrong still has their files.
//   2. A failure partway DELETES THE INDEXEDDB DATABASE ENTIRELY. A
//      half-migrated filesystem is worse than an unmigrated one: the next boot
//      would read it, find some of the files, and quietly present that as the
//      whole disk.
//
// This function never throws. A caller booting the OS cannot usefully handle
// an exception here, and an unhandled one would stop the desktop rendering, so
// every outcome comes back as a value.
//
// DURABILITY, decided before any of this was written: the whole import -
// every file and directory, and marking the superblock migrated - runs
// inside ONE read-write transaction (backend._runInWriteTransaction, in
// os/storage-idb.js), not one write per request the way an earlier draft of
// this file did. Per-request writes would still never LOSE anything -
// localStorage is never touched until `migrated` is set, and a re-run
// converges: fsWriteEntry reuses an existing dirent's ino and frees its old
// blocks before allocating new ones, so a second attempt reclaims whatever
// its interrupted predecessor took rather than piling on top of it. But a
// partial database sitting between a tab close and the next boot's retry is
// momentarily READABLE: load() returns whatever tree is there once the
// superblock is not freshly created this session, with no way to tell "this
// is the real, complete filesystem" from "this is half an import". One
// transaction closes that window rather than relying on convergence to make
// it harmless: either the whole import becomes visible at once, or none of
// it does.
const FS_MIGRATE_SOURCE_KEY = 'sleepOS-fs';

async function fsMigrateFromLocalStorage(backend, options) {
  options = options || {};
  if (!fsIdbAvailable()) return { migrated: false, reason: 'no-indexeddb' };

  // Open the store FIRST. createIdbBackend builds its superblock lazily inside
  // ensure(), so reading backend._superblock before this point returns null,
  // the already-migrated check silently passes, and a second boot re-imports
  // the whole tree over the top of itself.
  try { await backend._store(); } catch (e) { return { migrated: false, reason: 'no-indexeddb' }; }

  const sb = backend._superblock || null;
  if (sb && sb.migrated) return { migrated: false, reason: 'already-migrated' };

  let raw = null;
  try { raw = localStorage.getItem(FS_MIGRATE_SOURCE_KEY); } catch (e) { raw = null; }
  if (!raw) {
    await _fsMarkMigrated(backend);
    return { migrated: false, reason: 'nothing-to-migrate' };
  }

  let tree = null;
  try { tree = JSON.parse(raw); } catch (e) { tree = null; }
  if (!tree || typeof tree !== 'object') {
    // Deliberately NOT marked migrated. The data is unreadable now, but the
    // key is still there, and a future release with a repair path should get
    // the chance to try again rather than find the door already closed.
    return { migrated: false, reason: 'unreadable' };
  }

  try {
    // The import and marking `migrated` both happen inside this one
    // transaction. Splitting them - import first, mark migrated as a
    // separate write afterward - would reopen exactly the window this whole
    // design exists to close: a tab closing in the gap between them leaves a
    // complete, correctly-written filesystem sitting there with `migrated`
    // still false, so the next boot would re-run the entire import over it
    // rather than simply finding it already done.
    await backend._runInWriteTransaction(async (store, txSb) => {
      await _fsImportNode(store, txSb, tree, 0, options.onProgress);
      txSb.migrated = true;
      await store.put(FS_STORE_SUPERBLOCK, 'sb', txSb);
    });
    return { migrated: true, reason: 'ok' };
  } catch (err) {
    // Rule 2. Destroy the partial database before anything can read it.
    try { await fsIdbDeleteDatabase(); } catch (e) { /* nothing further to try */ }
    return { migrated: false, reason: 'failed', error: (err && err.message) || String(err) };
  }
}

// Only reached when there is nothing to import (no key) or migration has
// already run - a real import marks migrated as the last step of its own
// transaction instead (see fsMigrateFromLocalStorage above), so this never
// needs to coordinate with any in-flight write.
async function _fsMarkMigrated(backend) {
  const sb = backend._superblock;
  if (!sb) return;
  await backend._runInWriteTransaction(async (store, txSb) => {
    txSb.migrated = true;
    await store.put(FS_STORE_SUPERBLOCK, 'sb', txSb);
  });
}

// Depth-first, directories before their contents, so a child always has a
// parent ino to attach to. Takes the transaction-scoped store and superblock
// directly rather than fetching them itself, so every write in the walk -
// however deep the recursion goes - lands on the SAME transaction
// fsMigrateFromLocalStorage opened, never a fresh one per call.
//
// NOTE ON BLOBS, so nobody "fixes" their absence: this walks files, dirs and
// subdirs and nothing else, because that is all the source data has.
// _vfsSerNode (os/vfs.js:160-165) serializes exactly { dirs, files, subdirs }
// - the snapshot in localStorage has never contained blobs. Image and video
// bytes live in os/blob-store.js under its own keys. Migrating those is a
// separate concern and is not in this task.
//
// onProgress must NOT await or otherwise yield. This entire walk runs inside
// one IndexedDB transaction, and any non-IDB work - including a callback
// that awaits something - is exactly what would kill it early: the same
// constraint that forced commit()'s readEntry resolution into its own phase
// before any transaction opens.
async function _fsImportNode(store, sb, node, parentIno, onProgress) {
  for (const [name, text] of Object.entries((node && node.files) || {})) {
    await fsWriteEntry(store, sb, parentIno, name, {
      type: 'file', bytes: fsEncodeText(text),
    });
    if (onProgress) onProgress(name);
  }

  for (const name of (node && node.dirs) || []) {
    const ino = await fsWriteEntry(store, sb, parentIno, name, { type: 'dir' });
    const child = ((node.subdirs || {})[name]) || { dirs: [], files: {}, subdirs: {} };
    await _fsImportNode(store, sb, child, ino, onProgress);
  }
}
