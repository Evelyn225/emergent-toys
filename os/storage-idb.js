// IndexedDB backend. Thin on purpose: it opens the database, exposes the
// abstract store os/fs-format.js expects, and translates the VFS's ops into
// format calls. Every decision about the format itself lives in fs-format,
// which is why that file is testable with a Map and this one needs a browser.
//
// If this file grows past roughly a hundred lines, logic has leaked out of the
// pure core and belongs back in it.
const FS_IDB_NAME = 'sleepOS-fs';
const FS_IDB_VERSION = 1;
// Sized so the disk is a believable 32 MB at 4 KB per block. IndexedDB itself
// is bounded by the origin quota, which estimate() reports honestly; this is
// the in-fiction disk size, and it is what DEFRAG's grid renders.
const FS_IDB_TOTAL_BLOCKS = 8192;

function fsIdbAvailable() {
  try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch (e) { return false; }
}

function _fsIdbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || VfsError('EIO', 'IndexedDB request failed'));
  });
}

function _fsIdbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_IDB_NAME, FS_IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      [FS_STORE_SUPERBLOCK, FS_STORE_INODES, FS_STORE_DIRENTS, FS_STORE_BLOCKS].forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || VfsError('EIO', 'could not open ' + FS_IDB_NAME));
  });
}

// Not routed through _fsIdbRequest: deleteDatabase() has a third outcome
// that plain get/put/delete requests never do. If any connection to the
// database - including this backend's own, unless the caller closed it
// first - is still open, IndexedDB does not fail the request; it fires
// onblocked and then waits, indefinitely, for every connection to close,
// never calling onsuccess or onerror on its own. _fsIdbRequest only wires
// onsuccess/onerror, so a blocked delete would leave its promise permanently
// unsettled - exactly the shape of hang this function exists to avoid.
// Failing fast on onblocked is a deliberate choice: the caller (migration's
// abort path) needs to know NOW that the partial database is still there,
// not wait on a request that may never resolve because some other tab has
// its own connection open.
async function fsIdbDeleteDatabase() {
  if (!fsIdbAvailable()) return;
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(FS_IDB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || VfsError('EIO', 'could not delete ' + FS_IDB_NAME));
    req.onblocked = () => reject(VfsError('EBUSY', 'delete of ' + FS_IDB_NAME + ' blocked by an open connection'));
  });
}

// The abstract store from os/fs-format.js, over a real database. Used only
// for the one-off reads load() and estimate() need before any commit is in
// flight - each call opens its own transaction, so this carries no atomicity
// guarantee across two calls and must never be used for commit()'s write
// phase (see _fsIdbTxStore below for that).
function _fsIdbStore(db) {
  function tx(name, mode) {
    return db.transaction([name], mode).objectStore(name);
  }
  return {
    async get(name, key) { return await _fsIdbRequest(tx(name, 'readonly').get(String(key))); },
    async put(name, key, value) { await _fsIdbRequest(tx(name, 'readwrite').put(value, String(key))); },
    async del(name, key) { await _fsIdbRequest(tx(name, 'readwrite').delete(String(key))); },
    // Both reads go through the SAME already-open store rather than each
    // calling tx() again. Two separate transactions here used to let a write
    // from anywhere else - another tab, or just another commit - land between
    // the key read and the value read, silently pairing keys from one moment
    // with values from another. IndexedDB is shared across tabs on the same
    // origin, so this was reachable without any bug in this file at all.
    async scan(name) {
      const store = tx(name, 'readonly');
      const keys = await _fsIdbRequest(store.getAllKeys());
      const values = await _fsIdbRequest(store.getAll());
      return keys.map((k, i) => [k, values[i]]);
    },
    async clear(name) { await _fsIdbRequest(tx(name, 'readwrite').clear()); },
  };
}

// The same abstract store shape, bound to an ALREADY-OPEN transaction rather
// than opening one per request. commit()'s write phase runs its whole batch
// through one of these, which is what makes the batch commit or roll back as
// a single unit instead of as N independent transactions.
function _fsIdbTxStore(tx) {
  function os(name) { return tx.objectStore(name); }
  return {
    async get(name, key) { return await _fsIdbRequest(os(name).get(String(key))); },
    async put(name, key, value) { await _fsIdbRequest(os(name).put(value, String(key))); },
    async del(name, key) { await _fsIdbRequest(os(name).delete(String(key))); },
    async scan(name) {
      const store = os(name);
      const keys = await _fsIdbRequest(store.getAllKeys());
      const values = await _fsIdbRequest(store.getAll());
      return keys.map((k, i) => [k, values[i]]);
    },
    async clear(name) { await _fsIdbRequest(os(name).clear()); },
  };
}

function createIdbBackend(options) {
  options = options || {};
  const totalBlocks = Number.isFinite(options.totalBlocks) ? options.totalBlocks : FS_IDB_TOTAL_BLOCKS;
  let db = null;
  let store = null;
  let sb = null;
  // True only for the session that actually created the superblock. load()
  // keys its null-vs-empty-tree signal off this, not off the dirent count -
  // see load() below for why the two are not the same thing.
  let freshlyCreated = false;
  // Directory ino lookups, rebuilt on load. Ops name a directory by path, and
  // dirents are keyed by parent ino, so something has to hold the mapping.
  let dirInos = new Map();

  async function ensure() {
    if (store) return;
    db = await _fsIdbOpen();
    store = _fsIdbStore(db);
    sb = await store.get(FS_STORE_SUPERBLOCK, 'sb');
    if (sb) {
      freshlyCreated = false;
    } else {
      sb = fsMakeSuperblock(totalBlocks);
      await store.put(FS_STORE_SUPERBLOCK, 'sb', sb);
      freshlyCreated = true;
    }
  }

  // '' is the root and is always ino 0. Anything deeper is looked up, and
  // created if an op names a directory we have not seen - which happens when a
  // mkdir and a write inside it land in the same commit. Takes the active
  // store explicitly (rather than closing over the module-level one) because
  // commit()'s write phase must resolve directories through the SAME
  // transaction as everything else in the batch, not through a one-off read.
  async function inoForDir(activeStore, dirName) {
    const path = String(dirName || '');
    if (!path) return 0;
    if (dirInos.has(path)) return dirInos.get(path);
    let parent = 0;
    let sofar = '';
    for (const part of path.split('\\')) {
      sofar = sofar ? sofar + '\\' + part : part;
      if (dirInos.has(sofar)) { parent = dirInos.get(sofar); continue; }
      let ino = await activeStore.get(FS_STORE_DIRENTS, String(parent) + '/' + part);
      if (ino === undefined) ino = await fsWriteEntry(activeStore, sb, parent, part, { type: 'dir' });
      dirInos.set(sofar, ino);
      parent = ino;
    }
    return parent;
  }

  async function rebuildDirInos() {
    dirInos = new Map();
    const dirents = await store.scan(FS_STORE_DIRENTS);
    const rows = dirents.map(([key, ino]) => {
      const slash = key.indexOf('/');
      return { parent: Number(key.slice(0, slash)), name: key.slice(slash + 1), ino };
    });
    const pathOf = new Map([[0, '']]);
    // Repeat until nothing new resolves, because a child can be seen before
    // its parent in an unordered scan.
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) {
        if (pathOf.has(row.ino) || !pathOf.has(row.parent)) continue;
        const inode = await store.get(FS_STORE_INODES, row.ino);
        if (!inode || inode.type !== 'dir') continue;
        const base = pathOf.get(row.parent);
        const full = base ? base + '\\' + row.name : row.name;
        pathOf.set(row.ino, full);
        dirInos.set(full, row.ino);
        changed = true;
      }
    }
  }

  // Runs a whole batch of writes as ONE transaction: opens it, hands `fn`
  // a transaction-scoped store and the live superblock, waits for the
  // transaction to actually complete (a request resolving is not the same
  // as the transaction being durable - IndexedDB only applies a
  // transaction's writes when the transaction itself does), and on any
  // failure runs the guarded abort and stale-cache discard below.
  //
  // Both commit() and migration (os/fs-migrate.js, via the `_runInWriteTransaction`
  // property this function is exposed as) go through this - one copy of a
  // sequence that has needed three separate hardening rounds (4.5's
  // transaction-completion timing, 4.6's redundant-abort throw, 4.7's
  // error-precedence rule) rather than two copies a fourth fix would have
  // to be applied to twice, and might not be.
  async function _runInWriteTransaction(fn) {
    await ensure();
    const tx = db.transaction(
      [FS_STORE_SUPERBLOCK, FS_STORE_INODES, FS_STORE_DIRENTS, FS_STORE_BLOCKS], 'readwrite');
    const txStore = _fsIdbTxStore(tx);
    try {
      const result = await fn(txStore, sb);
      // Every request resolving is not the same as the transaction being
      // durable: IndexedDB only actually applies a transaction's writes
      // when the transaction itself completes, which - like committing at
      // all - is a separate event from any one request inside it
      // succeeding. Returning as soon as the last request's promise
      // resolved would let a caller (and this backend's own next write)
      // observe "done" before the write was ever guaranteed to survive.
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(VfsError('EIO', 'IndexedDB transaction aborted'));
      });
      return result;
    } catch (err) {
      // Two different triggers land here, and only one of them touches an
      // IDB request at all: a write request failing (disk pressure, quota,
      // a closed connection) auto-aborts its own transaction the instant
      // the unhandled error fires, making the abort() below redundant - but
      // fsAllocBlocks/fsFreeBlocks throwing ENOSPC is a pure in-fiction,
      // application-level throw with no request involved, so nothing has
      // aborted anything yet and this abort() is the one doing real work.
      // Either way, .abort() on a transaction that has already finished
      // throws InvalidStateError, which is expected on the first path (the
      // transaction is already in the state this call was trying to put it
      // in) and swallowed. Anything else abort() throws is a genuinely
      // different, unexpected problem, and is attached to `err` rather than
      // thrown in its place - `err` is why the write actually failed and is
      // what needs to reach vfsFlush's onError and the user; a secondary
      // cleanup failure must not hide it, but must not be lost either.
      try { tx.abort(); } catch (e) {
        if (e.name !== 'InvalidStateError') err.abortError = e;
      }
      // fsAllocBlocks/fsFreeBlocks mutate `sb` in memory synchronously,
      // well before the request that would have persisted it either lands
      // or fails - so by the time a write fails, `sb` may already disagree
      // with what is actually durable. A cached copy that survives a
      // rolled-back transaction is its own corruption source (blocks it
      // thinks are taken stay invisible to every future allocation), and
      // it would only surface on whichever write runs after this one.
      // Discarding it, along with the directory cache built against it,
      // forces the next ensure() to re-read authoritative state instead of
      // trusting memory that this transaction never actually committed.
      // This runs unconditionally - whether abort() threw InvalidStateError,
      // threw something else, or didn't throw at all - because none of
      // those outcomes changes the fact that `sb` may no longer be trustworthy.
      store = null;
      sb = null;
      dirInos = new Map();
      throw err;
    }
  }

  return {
    // The whole reason this backend exists: it writes from ops and has no use
    // for a whole-tree snapshot.
    needsSnapshot: false,

    async load() {
      await ensure();
      // A zero-dirent tree means one of two very different things: this
      // database was never written (the VFS should seed the default tree),
      // or a prior session emptied it (the user's empty drive is real and
      // must not be silently re-seeded). Dirent count cannot tell them
      // apart; whether THIS session created the superblock can, because a
      // re-seed only ever needs to happen the very first time a database
      // exists at all.
      if (freshlyCreated) return null;
      await rebuildDirInos();
      return await fsReadTree(store);
    },

    async commit({ ops, readEntry }) {
      await ensure();
      const list = ops || [];
      if (!list.length) return;

      // Phase 1: no transaction open yet. Resolve every content op's
      // readEntry up front, because readEntry can await fetch() on a blob's
      // object URL - non-IDB work that would kill a transaction if it ran
      // while one was held open. Directory resolution (inoForDir) is IDB
      // work and happens in phase 2 instead, on the transaction that also
      // does the writes, so a mkdir and a write into it stay part of the
      // same atomic batch.
      const resolved = [];
      for (const op of list) {
        if (op.op === 'write' || op.op === 'writeBlob') {
          resolved.push({ op, entry: readEntry ? await readEntry(op.dirName, op.name) : null });
        } else {
          resolved.push({ op, entry: undefined });
        }
      }

      // Phase 2: IDB work only, run as one transaction that commits or
      // rolls back the whole batch as a single unit - not as one
      // independent transaction per request, which is what let an
      // interrupted commit leave an inode referencing blocks the free
      // bitmap still called free, or referencing blocks whose data had
      // already been deleted out from under it.
      await _runInWriteTransaction(async (txStore, txSb) => {
        for (const { op, entry } of resolved) {
          const parent = await inoForDir(txStore, op.dirName);
          if (op.op === 'mkdir') {
            const ino = await fsWriteEntry(txStore, txSb, parent, op.name, { type: 'dir' });
            const path = op.dirName ? op.dirName + '\\' + op.name : op.name;
            dirInos.set(path, ino);
            continue;
          }
          if (op.op === 'unlink') {
            await fsDeleteEntry(txStore, txSb, parent, op.name);
            continue;
          }
          if (op.op === 'rename') {
            await fsRenameEntry(txStore, parent, op.name, parent, op.newName);
            continue;
          }
          if (op.op === 'move') {
            const dst = await inoForDir(txStore, op.dstDirName);
            await fsRenameEntry(txStore, parent, op.name, dst, op.newName);
            continue;
          }
          // write and writeBlob both land here: one allocator, one code path.
          if (!entry) continue;
          if (entry.kind === 'blob') {
            await fsWriteEntry(txStore, txSb, parent, op.name, {
              type: 'blob',
              bytes: entry.bytes || new Uint8Array(0),
              // `url` is deliberately not persisted: an object URL is dead on
              // the next boot. It is rebuilt from these bytes on load.
              meta: { kind: entry.blob && entry.blob.kind, mime: entry.blob && entry.blob.mime },
            });
          } else {
            await fsWriteEntry(txStore, txSb, parent, op.name, {
              type: 'file', bytes: fsEncodeText(entry.text || ''),
            });
          }
        }
        await txStore.put(FS_STORE_SUPERBLOCK, 'sb', txSb);
      });
    },

    async estimate() {
      try {
        const est = await navigator.storage.estimate();
        return { usage: Number(est.usage) || 0, quota: Number(est.quota) || Infinity };
      } catch (e) {
        return { usage: 0, quota: Infinity };
      }
    },

    // Read by the fragmentation code in Task 7. Exposed on the backend rather
    // than through a global so there is exactly one owner of the superblock.
    async _readInodes() {
      await ensure();
      return (await store.scan(FS_STORE_INODES)).map(([, inode]) => inode);
    },
    get _superblock() { return sb; },

    // The read half of blob persistence (Task 9a) - fsReadTree only ever
    // hands back a blob's metadata, never its bytes, and this is what a
    // caller (os/blob-store.js, once Task 9b wires it in) uses to fetch them
    // lazily, on demand, rather than loading every image, video and audio
    // file into memory at boot the way the base64 mirror's atob pass does.
    // Goes through the one-off _fsIdbStore() read store, same as
    // _readInodes above, not _runInWriteTransaction: this opens no write
    // transaction, so a failed or missing read has no cache to discard.
    async _readBlobBytes(dirName, name) {
      await ensure();
      return await fsReadBlobBytesAtPath(store, sb, dirName, name);
    },

    // Migration (os/fs-migrate.js) writes through the same store this
    // backend owns, rather than opening its own connection. Two connections
    // to one database is how a migration ends up racing the boot that
    // triggered it.
    async _store() { await ensure(); return store; },

    // Closes THIS backend's own IndexedDB connection. Deliberately narrow:
    // call this only from migration's abort path (fs-migrate.js), right
    // before deleting the database, never from an ordinary commit failure.
    // deleteDatabase() defers behind onblocked for as long as ANY
    // connection stays open, including this backend's own - closing it here
    // is what lets migration's cleanup delete actually complete instead of
    // hanging on a connection it forgot it was still holding. An ordinary
    // commit failure has no reason to give up the connection at all: the
    // backend is expected to keep working afterward, and ensure()'s cheap
    // early return (`if (store) return;`) depends on `store` staying set for
    // the backend's whole normal lifetime.
    //
    // Nulls sb/dirInos too, matching the discard in _runInWriteTransaction's
    // catch: a closed connection makes both just as untrustworthy as a
    // rolled-back transaction does, even though nothing reachable today
    // calls _close() and then keeps using this backend without going through
    // ensure() again first.
    async _close() {
      if (db) db.close();
      db = null;
      store = null;
      sb = null;
      dirInos = new Map();
    },

    // Runs a whole batch of writes as ONE transaction - exposed here for
    // migration (os/fs-migrate.js), which needs this because commit() itself
    // isn't the right vehicle: migration doesn't have `ops` to hand it, and
    // importing an entire localStorage tree through commit()'s per-op
    // readEntry/write-phase split would mean a mid-import failure leaves
    // whatever files landed before it sitting in the live store as a real,
    // readable, half-imported filesystem - exactly the outcome migration
    // exists to rule out. commit() above runs through this very same
    // function.
    _runInWriteTransaction,
  };
}
