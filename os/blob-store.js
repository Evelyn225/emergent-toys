// ── Blob persistence (base64 per-file, separate localStorage keys) ─
const BLOB_PREFIX = 'sleepOS-blob:';
const BLOB_SIZE_LIMIT = 3 * 1024 * 1024; // skip files > 3 MB uncompressed
const MEDIA_DB_NAME = 'sleepOS-media';
const MEDIA_DB_VERSION = 1;
const MEDIA_DB_STORE = 'blobs';
let _mediaDbPromise = null;

function blobRelativePath(dirPath, name) {
  return (dirPath ? dirPath + '\\' : '') + name;
}

function blobStorageKey(dirPath, name) {
  return BLOB_PREFIX + blobRelativePath(dirPath, name);
}

function splitBlobRelativePath(path) {
  const clean = String(path || '').replace(/\//g, '\\').replace(/^\\+|\\+$/g, '');
  const lastSlash = clean.lastIndexOf('\\');
  return {
    dirPath: lastSlash === -1 ? '' : clean.slice(0, lastSlash),
    fileName: lastSlash === -1 ? clean : clean.slice(lastSlash + 1),
  };
}

function _ab2b64(ab) {
  const bytes = new Uint8Array(ab);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192)
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  return btoa(out);
}

function openMediaDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  if (_mediaDbPromise) return _mediaDbPromise;
  _mediaDbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MEDIA_DB_STORE)) {
          db.createObjectStore(MEDIA_DB_STORE, { keyPath: 'path' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = req.onblocked = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
  return _mediaDbPromise;
}

async function storeBlobEntryInDb(dirPath, name, kind, size, mime, arrayBuffer) {
  const db = await openMediaDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(MEDIA_DB_STORE, 'readwrite');
      tx.objectStore(MEDIA_DB_STORE).put({
        path: blobRelativePath(dirPath, name),
        kind,
        size,
        mime,
        blob: new Blob([arrayBuffer], { type: mime || 'application/octet-stream' }),
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function removeBlobEntryFromDb(dirPath, name) {
  const db = await openMediaDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(MEDIA_DB_STORE, 'readwrite');
      tx.objectStore(MEDIA_DB_STORE).delete(blobRelativePath(dirPath, name));
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function renameBlobEntryInDb(dirPath, oldName, newName) {
  const db = await openMediaDb();
  if (!db) return false;
  const oldPath = blobRelativePath(dirPath, oldName);
  const newPath = blobRelativePath(dirPath, newName);
  return new Promise(resolve => {
    try {
      const tx = db.transaction(MEDIA_DB_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_DB_STORE);
      const getReq = store.get(oldPath);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (!data) return;
        data.path = newPath;
        store.put(data);
        store.delete(oldPath);
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

function restoreBlobIntoFs(dirPath, fileName, kind, size, mime, rawBlob) {
  if (!fileName) return;
  const dir = vfsDirNodeSync(dirPath);
  if (!dir) return;
  const prev = dir.blobs.get(fileName);
  if (prev?.url) URL.revokeObjectURL(prev.url);
  const blob = rawBlob instanceof Blob ? rawBlob : new Blob([rawBlob], { type: mime || 'application/octet-stream' });
  dir.blobs.set(fileName, { url: URL.createObjectURL(blob), kind, size, mime });
}

// Save a single blob entry immediately (called at upload time when we have
// the raw File). Async and returns whether the bytes actually landed
// somewhere that survives a reload - `void`-ing storeBlobEntryInDb() used to
// throw that answer away, and storeBlobEntryInDb/openMediaDb never reject
// (every failure path resolves false/null), so the caller had no other way
// to find out. Above BLOB_SIZE_LIMIT the localStorage mirror is skipped
// entirely, so for a large file the media DB is the only thing that can make
// this true; a caller that ignores a false here loses the file invisibly.
async function saveBlobEntry(dirPath, name, kind, size, mime, arrayBuffer) {
  const dbOk = await storeBlobEntryInDb(dirPath, name, kind, size, mime, arrayBuffer);
  let localOk = false;
  if (size <= BLOB_SIZE_LIMIT) {
    try {
      localStorage.setItem(blobStorageKey(dirPath, name),
        JSON.stringify({ kind, size, mime, b64: _ab2b64(arrayBuffer) }));
      localOk = true;
    } catch (ex) { /* quota */ }
  }
  return dbOk || localOk;
}

function removeBlobEntry(dirPath, name) {
  localStorage.removeItem(blobStorageKey(dirPath, name));
  void removeBlobEntryFromDb(dirPath, name);
}

function renameBlobEntry(dirPath, oldName, newName) {
  const oldKey = blobStorageKey(dirPath, oldName);
  const newKey = blobStorageKey(dirPath, newName);
  const data = localStorage.getItem(oldKey);
  if (data) { try { localStorage.setItem(newKey, data); } catch(ex) {} localStorage.removeItem(oldKey); }
  void renameBlobEntryInDb(dirPath, oldName, newName);
}

async function moveBlobEntryInDb(srcDirPath, srcName, dstDirPath, dstName) {
  const db = await openMediaDb();
  if (!db) return false;
  const oldPath = blobRelativePath(srcDirPath, srcName);
  const newPath = blobRelativePath(dstDirPath, dstName);
  return new Promise(resolve => {
    try {
      const tx = db.transaction(MEDIA_DB_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_DB_STORE);
      const getReq = store.get(oldPath);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (!data) return;
        data.path = newPath;
        store.put(data);
        store.delete(oldPath);
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

function moveBlobEntryStorage(srcDirPath, srcName, dstDirPath, dstName) {
  const oldKey = blobStorageKey(srcDirPath, srcName);
  const newKey = blobStorageKey(dstDirPath, dstName);
  const data = localStorage.getItem(oldKey);
  if (data) {
    try { localStorage.setItem(newKey, data); } catch (e) {}
    localStorage.removeItem(oldKey);
  }
  void moveBlobEntryInDb(srcDirPath, srcName, dstDirPath, dstName);
}

// Copy variant of moveBlobEntryInDb: the source row stays exactly where it is.
// Resolves with the stored Blob so the caller can mint a fresh object URL for
// it, or null when there is no row to copy.
async function copyBlobEntryInDb(srcDirPath, srcName, dstDirPath, dstName) {
  const db = await openMediaDb();
  if (!db) return null;
  const oldPath = blobRelativePath(srcDirPath, srcName);
  const newPath = blobRelativePath(dstDirPath, dstName);
  return new Promise(resolve => {
    try {
      const tx = db.transaction(MEDIA_DB_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_DB_STORE);
      let copied = null;
      const getReq = store.get(oldPath);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (!data) return;
        copied = data.blob || null;
        store.put(Object.assign({}, data, { path: newPath }));
      };
      tx.oncomplete = () => resolve(copied);
      tx.onerror = tx.onabort = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

// Give a copied blob its own persisted bytes under the destination path, in
// both stores, and hand back a fresh object URL for them. A copy that shared
// the source's URL would go blank the moment either entry was deleted, because
// removeFsPath revokes that one string; and with no row under the new path the
// copy would not survive a reload at all, since blobs are deliberately absent
// from the VFS snapshot. Returns null when there is nothing stored to copy
// (a seeded blob), leaving the caller to keep the source's URL.
async function copyBlobEntryStorage(srcDirPath, srcName, dstDirPath, dstName) {
  const data = localStorage.getItem(blobStorageKey(srcDirPath, srcName));
  if (data !== null) {
    try { localStorage.setItem(blobStorageKey(dstDirPath, dstName), data); } catch (e) { /* quota */ }
  }
  const stored = await copyBlobEntryInDb(srcDirPath, srcName, dstDirPath, dstName);
  if (stored) return URL.createObjectURL(stored);
  if (data === null) return null;
  // No IndexedDB (or no row there), but the base64 copy landed: rebuild the
  // bytes from it rather than aliasing the source's URL.
  try {
    const { mime, b64 } = JSON.parse(data);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
  } catch (e) {
    return null;
  }
}

async function moveBlobSubtreeInDb(oldDirPath, newDirPath) {
  const db = await openMediaDb();
  if (!db) return false;
  const prefix = oldDirPath ? oldDirPath + '\\' : '';
  return new Promise(resolve => {
    try {
      const tx = db.transaction(MEDIA_DB_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_DB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        (req.result || []).forEach(item => {
          if (!String(item.path || '').startsWith(prefix)) return;
          const nextPath = newDirPath + '\\' + String(item.path).slice(prefix.length);
          store.put(Object.assign({}, item, { path: nextPath }));
          store.delete(item.path);
        });
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

function moveBlobStorageSubtree(oldDirPath, newDirPath) {
  const from = fsNormalizeDir(oldDirPath);
  const to = fsNormalizeDir(newDirPath);
  const prefix = BLOB_PREFIX + (from ? from + '\\' : '');
  Object.keys(localStorage)
    .filter(key => key.startsWith(prefix))
    .forEach(key => {
      const data = localStorage.getItem(key);
      const suffix = key.slice(prefix.length);
      if (data !== null) {
        try { localStorage.setItem(BLOB_PREFIX + to + '\\' + suffix, data); } catch (e) {}
      }
      localStorage.removeItem(key);
    });
  void moveBlobSubtreeInDb(from, to);
}

// Task 9d: blocks are now the primary blob source. os/vfs.js's vfsMount
// takes a snapshot (vfsBlockBlobEntries()) of every blob path the mounted
// backend's block layer actually persisted, captured before this runs and
// before anything else can overwrite those tree nodes (a seeded wallpaper or
// home-media placeholder, in particular). Both mirror restores below consult
// that SAME static snapshot to decide what counts as "already covered by
// blocks" - not the live, possibly-still-empty state of dir.blobs, which
// would otherwise race loadBlobsFromBlocks's own async byte fetches below.
function _blockBlobPathKey(dirPath, fileName) { return dirPath + '\x00' + fileName; }
function _blockBlobPathSet() {
  return new Set(vfsBlockBlobEntries().map(e => _blockBlobPathKey(e.dirName, e.name)));
}

// Fetches every block-persisted blob's real bytes and restores it into the
// live tree with a real object URL. Runs eagerly at boot, same as
// loadBlobsFromIndexedDb below - not deferred to first display, which would
// be a bigger, separate change to how the UI requests blobs. A single
// unreadable entry does not stop the rest from restoring: a corrupted or
// mid-migration store should not take down every other file's return.
async function loadBlobsFromBlocks() {
  const backend = vfsGetBackend();
  if (!backend || typeof backend._readBlobBytes !== 'function') return;
  const entries = vfsBlockBlobEntries();
  if (!entries.length) return;
  let restored = 0;
  for (const { dirName, name, size, kind, mime } of entries) {
    try {
      const bytes = await backend._readBlobBytes(dirName, name);
      // null means the path is gone by the time this runs - e.g. deleted or
      // renamed between mount and this fetch. Nothing to restore; the tree
      // already reflects whatever that later mutation did.
      if (!bytes) continue;
      restoreBlobIntoFs(dirName, name, kind, size, mime, bytes);
      restored++;
    } catch (e) {
      // One bad block entry must not stop the rest of the boot restore.
    }
  }
  if (restored) document.dispatchEvent(new CustomEvent('fs-changed'));
}

function loadBlobsFromStorage() {
  const blockPaths = _blockBlobPathSet();
  Object.keys(localStorage).filter(k => k.startsWith(BLOB_PREFIX)).forEach(k => {
    try {
      const { dirPath, fileName } = splitBlobRelativePath(k.slice(BLOB_PREFIX.length));
      // Blocks already cover this path - do not let a mirror clobber it,
      // even a stale one. See _vfsReadEntryForCommit's readFailed handling:
      // blocks can deliberately hold OLDER bytes than a mirror does, and
      // that is the whole point of what it preserves.
      if (blockPaths.has(_blockBlobPathKey(dirPath, fileName))) return;
      const { kind, size, mime, b64 } = JSON.parse(localStorage.getItem(k));
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      restoreBlobIntoFs(dirPath, fileName, kind, size, mime, new Blob([bytes], { type: mime }));
    } catch(e) { /* corrupted ? skip */ }
  });
  void loadBlobsFromBlocks();
  void loadBlobsFromIndexedDb();
}

async function loadBlobsFromIndexedDb() {
  const db = await openMediaDb();
  if (!db) return;
  const items = await new Promise(resolve => {
    try {
      const tx = db.transaction(MEDIA_DB_STORE, 'readonly');
      const req = tx.objectStore(MEDIA_DB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
  const blockPaths = _blockBlobPathSet();
  let restored = 0;
  items.forEach(item => {
    const { dirPath, fileName } = splitBlobRelativePath(item.path);
    if (blockPaths.has(_blockBlobPathKey(dirPath, fileName))) return; // blocks already cover this path
    restoreBlobIntoFs(dirPath, fileName, item.kind, item.size, item.mime, item.blob);
    restored++;
  });
  if (restored) document.dispatchEvent(new CustomEvent('fs-changed'));
  const savedWp = getInitialWallpaperPath();
  if (savedWp) {
    applyWallpaper(savedWp);
  }
}

