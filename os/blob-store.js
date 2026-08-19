// ── Blob persistence (base64 per-file, separate localStorage keys) ─
const BLOB_PREFIX = 'sleepOS-blob:';
const BLOB_SIZE_LIMIT = 3 * 1024 * 1024; // skip files > 3 MB uncompressed

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
// somewhere that survives a reload. Above BLOB_SIZE_LIMIT there is no
// fallback at all any more - Task 9e deleted the media-IndexedDB mirror that
// used to cover that case - so a caller that ignores a false here loses this
// mirror's copy of the file invisibly. The bytes are still safe: they are
// already queued for the block layer via the vfsWriteBlob call this always
// follows (os/media.js's handleFileUpload), which is what makes this file
// (and this whole mirror) redundant rather than load-bearing - Task 9f
// deletes it once the localStorage half is also gone.
async function saveBlobEntry(dirPath, name, kind, size, mime, arrayBuffer) {
  let localOk = false;
  if (size <= BLOB_SIZE_LIMIT) {
    try {
      localStorage.setItem(blobStorageKey(dirPath, name),
        JSON.stringify({ kind, size, mime, b64: _ab2b64(arrayBuffer) }));
      localOk = true;
    } catch (ex) { /* quota */ }
  }
  return localOk;
}

function removeBlobEntry(dirPath, name) {
  localStorage.removeItem(blobStorageKey(dirPath, name));
}

function renameBlobEntry(dirPath, oldName, newName) {
  const oldKey = blobStorageKey(dirPath, oldName);
  const newKey = blobStorageKey(dirPath, newName);
  const data = localStorage.getItem(oldKey);
  if (data) { try { localStorage.setItem(newKey, data); } catch(ex) {} localStorage.removeItem(oldKey); }
}

function moveBlobEntryStorage(srcDirPath, srcName, dstDirPath, dstName) {
  const oldKey = blobStorageKey(srcDirPath, srcName);
  const newKey = blobStorageKey(dstDirPath, dstName);
  const data = localStorage.getItem(oldKey);
  if (data) {
    try { localStorage.setItem(newKey, data); } catch (e) {}
    localStorage.removeItem(oldKey);
  }
}

// Give a copied blob its own persisted bytes under the destination path, and
// hand back a fresh object URL for them. A copy that shared the source's URL
// would go blank the moment either entry was deleted, because removeFsPath
// revokes that one string; and with no row under the new path the copy would
// not survive a reload at all, since blobs are deliberately absent from the
// VFS snapshot. Returns null when there is nothing stored to copy (a seeded
// blob), leaving the caller to keep the source's URL.
async function copyBlobEntryStorage(srcDirPath, srcName, dstDirPath, dstName) {
  const data = localStorage.getItem(blobStorageKey(srcDirPath, srcName));
  if (data !== null) {
    try { localStorage.setItem(blobStorageKey(dstDirPath, dstName), data); } catch (e) { /* quota */ }
  }
  if (data === null) return null;
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
// live tree with a real object URL. Runs eagerly at boot - not deferred to
// first display, which would be a bigger, separate change to how the UI
// requests blobs. A single unreadable entry does not stop the rest from
// restoring: a corrupted or mid-migration store should not take down every
// other file's return.
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

// Async (unlike before Task 9e) so the wallpaper-apply tail below can wait
// for loadBlobsFromBlocks to actually finish, rather than firing it and
// moving on - nothing awaits loadBlobsFromStorage() itself (os/fs-persist.js
// calls it fire-and-forget), so this does not change when the desktop
// renders. It used to run that tail from loadBlobsFromIndexedDb instead,
// simply because that was the last async restore step left; deleting that
// function in Task 9e meant the tail needed a new, correct home rather than
// being dropped.
async function loadBlobsFromStorage() {
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
  await loadBlobsFromBlocks();
  const savedWp = getInitialWallpaperPath();
  if (savedWp) {
    applyWallpaper(savedWp);
  }
}

