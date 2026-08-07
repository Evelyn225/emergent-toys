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

// Save a single blob entry immediately (called at upload time when we have the raw File)
function saveBlobEntry(dirPath, name, kind, size, mime, arrayBuffer) {
  void storeBlobEntryInDb(dirPath, name, kind, size, mime, arrayBuffer);
  if (size > BLOB_SIZE_LIMIT) return;
  try { localStorage.setItem(blobStorageKey(dirPath, name),
    JSON.stringify({ kind, size, mime, b64: _ab2b64(arrayBuffer) })); }
  catch(ex) { /* quota */ }
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

function loadBlobsFromStorage() {
  Object.keys(localStorage).filter(k => k.startsWith(BLOB_PREFIX)).forEach(k => {
    try {
      const { kind, size, mime, b64 } = JSON.parse(localStorage.getItem(k));
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { dirPath, fileName } = splitBlobRelativePath(k.slice(BLOB_PREFIX.length));
      restoreBlobIntoFs(dirPath, fileName, kind, size, mime, new Blob([bytes], { type: mime }));
    } catch(e) { /* corrupted ? skip */ }
  });
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
  items.forEach(item => {
    const { dirPath, fileName } = splitBlobRelativePath(item.path);
    restoreBlobIntoFs(dirPath, fileName, item.kind, item.size, item.mime, item.blob);
  });
  if (items.length) document.dispatchEvent(new CustomEvent('fs-changed'));
  const savedWp = getInitialWallpaperPath();
  if (savedWp) {
    applyWallpaper(savedWp);
  }
}

