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

async function fsIdbDeleteDatabase() {
  if (!fsIdbAvailable()) return;
  await _fsIdbRequest(indexedDB.deleteDatabase(FS_IDB_NAME));
}

// The abstract store from os/fs-format.js, over a real database.
function _fsIdbStore(db) {
  function tx(name, mode) {
    return db.transaction([name], mode).objectStore(name);
  }
  return {
    async get(name, key) { return await _fsIdbRequest(tx(name, 'readonly').get(String(key))); },
    async put(name, key, value) { await _fsIdbRequest(tx(name, 'readwrite').put(value, String(key))); },
    async del(name, key) { await _fsIdbRequest(tx(name, 'readwrite').delete(String(key))); },
    async scan(name) {
      const store = tx(name, 'readonly');
      const keys = await _fsIdbRequest(store.getAllKeys());
      const values = await _fsIdbRequest(tx(name, 'readonly').getAll());
      return keys.map((k, i) => [k, values[i]]);
    },
    async clear(name) { await _fsIdbRequest(tx(name, 'readwrite').clear()); },
  };
}

function createIdbBackend(options) {
  options = options || {};
  const totalBlocks = Number.isFinite(options.totalBlocks) ? options.totalBlocks : FS_IDB_TOTAL_BLOCKS;
  let db = null;
  let store = null;
  let sb = null;
  // Directory ino lookups, rebuilt on load. Ops name a directory by path, and
  // dirents are keyed by parent ino, so something has to hold the mapping.
  let dirInos = new Map();

  async function ensure() {
    if (store) return;
    db = await _fsIdbOpen();
    store = _fsIdbStore(db);
    sb = await store.get(FS_STORE_SUPERBLOCK, 'sb');
    if (!sb) {
      sb = fsMakeSuperblock(totalBlocks);
      await store.put(FS_STORE_SUPERBLOCK, 'sb', sb);
    }
  }

  // '' is the root and is always ino 0. Anything deeper is looked up, and
  // created if an op names a directory we have not seen - which happens when a
  // mkdir and a write inside it land in the same commit.
  async function inoForDir(dirName) {
    const path = String(dirName || '');
    if (!path) return 0;
    if (dirInos.has(path)) return dirInos.get(path);
    let parent = 0;
    let sofar = '';
    for (const part of path.split('\\')) {
      sofar = sofar ? sofar + '\\' + part : part;
      if (dirInos.has(sofar)) { parent = dirInos.get(sofar); continue; }
      let ino = await store.get(FS_STORE_DIRENTS, String(parent) + '/' + part);
      if (ino === undefined) ino = await fsWriteEntry(store, sb, parent, part, { type: 'dir' });
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

  return {
    // The whole reason this backend exists: it writes from ops and has no use
    // for a whole-tree snapshot.
    needsSnapshot: false,

    async load() {
      await ensure();
      const dirents = await store.scan(FS_STORE_DIRENTS);
      if (!dirents.length) return null;
      await rebuildDirInos();
      return await fsReadTree(store);
    },

    async commit({ ops, readEntry }) {
      await ensure();
      for (const op of ops || []) {
        const parent = await inoForDir(op.dirName);
        if (op.op === 'mkdir') {
          const ino = await fsWriteEntry(store, sb, parent, op.name, { type: 'dir' });
          const path = op.dirName ? op.dirName + '\\' + op.name : op.name;
          dirInos.set(path, ino);
          continue;
        }
        if (op.op === 'unlink') {
          await fsDeleteEntry(store, sb, parent, op.name);
          continue;
        }
        if (op.op === 'rename') {
          await fsRenameEntry(store, parent, op.name, parent, op.newName);
          continue;
        }
        if (op.op === 'move') {
          const dst = await inoForDir(op.dstDirName);
          await fsRenameEntry(store, parent, op.name, dst, op.newName);
          continue;
        }
        // write and writeBlob both land here: one allocator, one code path.
        // Awaited because readEntry has to fetch a blob's object URL to get
        // its bytes; the record itself carries none.
        const entry = readEntry ? await readEntry(op.dirName, op.name) : null;
        if (!entry) continue;
        if (entry.kind === 'blob') {
          await fsWriteEntry(store, sb, parent, op.name, {
            type: 'blob',
            bytes: entry.bytes || new Uint8Array(0),
            // `url` is deliberately not persisted: an object URL is dead on the
            // next boot. It is rebuilt from these bytes on load.
            meta: { kind: entry.blob && entry.blob.kind, mime: entry.blob && entry.blob.mime },
          });
        } else {
          await fsWriteEntry(store, sb, parent, op.name, {
            type: 'file', bytes: fsEncodeText(entry.text || ''),
          });
        }
      }
      await store.put(FS_STORE_SUPERBLOCK, 'sb', sb);
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
  };
}
