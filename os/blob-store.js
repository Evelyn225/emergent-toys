// ── Blob restore ────────────────────────────────────────────────────
// Blob bytes live in the block layer (os/storage-idb.js) and reach it
// through the normal vfsWriteBlob -> commit path, same as any other write.
// What is left here is purely the read side: the in-memory tree's blob
// entries hold an object URL, never bytes, and something has to turn a
// block-persisted blob dirent back into a real URL at boot. Tasks 9e and 9f
// deleted the two mirrors (a separate media IndexedDB, and a base64-in-
// localStorage copy) this file used to also maintain - blocks are the only
// store now.

function blobRelativePath(dirPath, name) {
  return (dirPath ? dirPath + '\\' : '') + name;
}

// Builds a real Blob + object URL for an entry and installs it in the live
// tree, revoking whatever URL (if any) was there before. `rawBlob` may be an
// already-real Blob or raw bytes (Uint8Array/ArrayBuffer) - callers pass
// whichever they have on hand.
function restoreBlobIntoFs(dirPath, fileName, kind, size, mime, rawBlob) {
  if (!fileName) return;
  const dir = vfsDirNodeSync(dirPath);
  if (!dir) return;
  const prev = dir.blobs.get(fileName);
  if (prev?.url) URL.revokeObjectURL(prev.url);
  const blob = rawBlob instanceof Blob ? rawBlob : new Blob([rawBlob], { type: mime || 'application/octet-stream' });
  dir.blobs.set(fileName, { url: URL.createObjectURL(blob), kind, size, mime });
}

// Boot-time restore, and the OS's one entry point for it (os/fs-persist.js's
// vfsBootMount calls this, fire-and-forget). Fetches every block-persisted
// blob's real bytes via vfsBlockBlobEntries() - the snapshot os/vfs.js's
// vfsMount takes right after building the live tree, of every blob path the
// mounted backend's block layer actually has - and restores each one with a
// real object URL. Runs eagerly, all of them, before the wallpaper-apply
// tail below - not deferred to first display, which would be a bigger,
// separate change to how the UI requests blobs. A single unreadable entry
// does not stop the rest from restoring: a corrupted or mid-migration store
// should not take down every other file's return, and the wallpaper tail
// must still run even when there is nothing in blocks at all (a non-IndexedDB
// backend, or a install with no blobs yet).
async function loadBlobsFromBlocks() {
  const backend = vfsGetBackend();
  if (backend && typeof backend._readBlobBytes === 'function') {
    const entries = vfsBlockBlobEntries();
    let restored = 0;
    for (const { dirName, name, size, kind, mime } of entries) {
      try {
        const bytes = await backend._readBlobBytes(dirName, name);
        // null means the path is gone by the time this runs - e.g. deleted
        // or renamed between mount and this fetch. Nothing to restore; the
        // tree already reflects whatever that later mutation did.
        if (!bytes) continue;
        restoreBlobIntoFs(dirName, name, kind, size, mime, bytes);
        restored++;
      } catch (e) {
        // One bad block entry must not stop the rest of the boot restore.
      }
    }
    if (restored) document.dispatchEvent(new CustomEvent('fs-changed'));
  }
  // A block-restored wallpaper is guaranteed ready by this point, since
  // everything above already ran and awaited.
  const savedWp = getInitialWallpaperPath();
  if (savedWp) {
    applyWallpaper(savedWp);
  }
}
