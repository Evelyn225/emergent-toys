// Filesystem operations the shell shares: the root system-file table, the
// protected directories, directory creation, delete-to-Recycle-Bin, restore
// and purge, and the DELETE guard every caller goes through.
//
// Which programs exist at the root. Size and date used to live here as
// authored constants; phase 6 seeded these as real files (os/fs-core.js), so
// DIR measures them off the superblock like everything else. See
// test/no-authored-exe-size.test.cjs.
const ROOT_SYSTEM_FILE_META = [
  { name: 'TERMINAL.exe' },
  { name: 'SYSMON.exe' },
  { name: 'NOTEPAD.exe' },
  { name: 'BROWSER.exe' },
  { name: 'DEFRAG.exe' },
  { name: 'CALC.exe' },
  { name: 'REGEDIT.exe' },
  { name: 'EXPLORER.exe' },
  { name: 'MINESWEEPER.exe' },
  { name: 'PAINT.exe' },
];
const ROOT_PROTECTED_DIRS = new Set(['DOCS', 'SYS', 'CACHE', 'DESKTOP', 'PICTURES']);
// The system's own processes. They have no window and no interpreter, so there
// is no measurable execution context and `ps`/SYSMON print a dash for their
// cpu and mem. Every one of them is protected: TASKKILL and SYSMON's End
// Process answer Access Denied, and KILL points at TASKKILL. The pids sit
// below KERNEL_FIRST_USER_PID (os/kernel.js), so a spawned process can never
// be handed one of them.
const BUILTIN_PROCESS_SEED = [
  { pid: 4, name: 'System', protected: true },
  { pid: 52, name: 'csrss.exe', protected: true },
  { pid: 116, name: 'services.exe', protected: true },
  { pid: 124, name: 'lsass.exe', protected: true },
  { pid: 280, name: 'svchost.exe', protected: true },
  { pid: 312, name: 'svchost.exe', protected: true },
];

// Synchronous because module-level callers depend on it during bundle
// evaluation (os/fs-persist.js seeds the wallpaper library and the recycle
// store this way). It mutates the live tree directly and lets the VFS commit
// on its own schedule.
function ensureFsDir(path) {
  const parts = vfsNormalizeDir(path).split('\\').filter(Boolean);
  let node = vfsGetTree();
  let parentPath = '';
  parts.forEach(part => {
    if (!node.dirs.has(part)) {
      node.dirs.add(part);
      // One op per directory actually created, carrying its own parent. A
      // single marker for the whole walk could not tell a backend which of
      // DOCS, DOCS\SYS, DOCS\SYS\CACHE were new.
      vfsQueueDirectMkdir(parentPath, part);
    }
    if (!node.subdirs) node.subdirs = new Map();
    // Materializing a node for a name that is already in `dirs` is not a
    // filesystem change - it is the same lazy fill vfsDirNodeSync does, and it
    // queues nothing there either.
    if (!node.subdirs.has(part)) node.subdirs.set(part, vfsMakeNode());
    node = node.subdirs.get(part);
    parentPath = parentPath ? parentPath + '\\' + part : part;
  });
  return node;
}

// The VFS handles the block-layer cleanup, the object-URL revoke and the
// commit. What it does not know about is the wallpaper binding, so that
// stays here.
async function removeFsPath(path, options) {
  options = options || {};
  const st = vfsStatSync(path);
  if (!st) return false;
  if (st.kind === 'blob' && st.blob?.kind === 'image') handleWallpaperFileDelete(st.dirName, st.name);
  // Resolve from the stat rather than re-splitting `path`, so the unlink cannot
  // land anywhere other than the entry the stat found.
  return await vfsUnlink(st.name, st.dirName, options);
}

function isRecycleBinItemName(name) {
  return String(name || '').trim().toUpperCase() === RECYCLE_BIN_NAME;
}

// `storage` is the physical shape ('text' | 'blob' | 'dir'); `kind` is what the
// UI labels the item with, which for a blob is its media kind. The node itself
// is deliberately not returned any more - every consumer now works through the
// VFS by path.
function getFsItemState(path, fallbackDir) {
  const st = vfsStatSync(path, fallbackDir);
  if (!st) return null;
  if (st.kind === 'text') return { dirName: st.dirName, entryName: st.name, kind: 'file', storage: 'text' };
  if (st.kind === 'blob') {
    return { dirName: st.dirName, entryName: st.name, kind: st.blob?.kind || 'binary', storage: 'blob', blob: st.blob };
  }
  return { dirName: st.dirName, entryName: st.name, kind: 'dir', storage: 'dir' };
}

function makeUniqueFsName(dirName, desiredName, kind, suffixToken) {
  const exists = name => vfsExistsSync(name, dirName);
  if (!exists(desiredName)) return desiredName;
  const token = String(suffixToken || 'copy');
  if (kind === 'dir') {
    const base = String(desiredName || 'NEW_FOLDER').toUpperCase();
    let candidate = base + '_' + token.toUpperCase();
    let i = 2;
    while (exists(candidate)) candidate = base + '_' + token.toUpperCase() + i++;
    return candidate;
  }
  const dot = String(desiredName).lastIndexOf('.');
  const base = dot > 0 ? desiredName.slice(0, dot) : desiredName;
  const ext = dot > 0 ? desiredName.slice(dot) : '';
  let candidate = base + '_' + token + ext;
  let i = 2;
  while (exists(candidate)) candidate = base + '_' + token + i++ + ext;
  return candidate;
}

async function moveFsItemByPath(path, fallbackDir, dstDirPath, options) {
  options = options || {};
  const item = getFsItemState(path, fallbackDir);
  const dstDirName = vfsNormalizeDir(dstDirPath);
  if (!item || !vfsDirExistsSync(dstDirName)) return null;
  if (item.storage === 'dir') {
    const srcPath = blobRelativePath(item.dirName, item.entryName);
    if (dstDirName === srcPath || dstDirName.startsWith(srcPath + '\\')) return null;
  }
  let nextName = String(options.newName || item.entryName || '').trim();
  if (!nextName) return null;
  if (item.storage === 'dir') nextName = nextName.toUpperCase();
  const sameParent = dstDirName === vfsNormalizeDir(item.dirName);
  const sameName = nextName === item.entryName;
  if (sameParent && sameName) return { kind: item.kind, name: nextName, dirName: dstDirName };
  if (options.makeUnique) nextName = makeUniqueFsName(dstDirName, nextName, item.storage === 'dir' ? 'dir' : 'file', options.suffixToken || 'copy');
  else if (vfsExistsSync(nextName, dstDirName)) return null;

  let moved;
  try {
    moved = await vfsMove(item.dirName, item.entryName, dstDirName, nextName);
  } catch (err) {
    // The guards above already cover EEXIST, ENOENT and the self-nesting
    // EINVAL, so this is unreachable in practice. It stays because callers
    // (Explorer's "Move failed.", the Recycle Bin) are written against a
    // null-on-failure contract, and a raw VfsError escaping into a drop
    // handler would take the whole gesture down instead.
    return null;
  }
  if (!moved) return null;
  // vfsMove already updates the block layer through its own queued op - the
  // bytes live there now, keyed by dirent, not by a separate path-keyed
  // mirror this caller used to have to keep in step by hand.
  return { kind: item.kind, name: moved, dirName: dstDirName };
}

function handleWallpaperTreeDelete(path) {
  const removedPath = normalizeWallpaperPath(path);
  const savedPath = normalizeWallpaperPath(localStorage.getItem(WP_KEY));
  const registryPath = normalizeWallpaperPath(getWallpaperRegistryValue());
  if (
    (currentWallpaper && currentWallpaper.startsWith(removedPath + '\\')) ||
    (savedPath && savedPath.startsWith(removedPath + '\\')) ||
    (registryPath && registryPath.startsWith(removedPath + '\\'))
  ) {
    applyWallpaper(DEFAULT_WALLPAPER_PATH);
  }
}

// vfsUnlink drops a directory's name and subtree - including the block layer
// underneath every blob in it - but revokes only the single object URL it was
// handed, which is not enough for a folder: emptying the Recycle Bin on a
// folder of images would leak one object URL per image. This is the
// permanent-delete half; a move into the Recycle Bin deliberately does not
// run it.
function purgeFsDirNode(dirPath) {
  vfsWalkBlobs(dirPath, (base, name, blob) => {
    if (blob?.kind === 'image') handleWallpaperFileDelete(base, name);
    if (blob?.url && !blob.seeded) URL.revokeObjectURL(blob.url);
  });
}

async function purgeFsPath(path, fallbackDir) {
  const item = getFsItemState(path, fallbackDir);
  if (!item) return false;
  // Rebuild the path from the resolved entry rather than passing `path`
  // through: removeFsPath re-splits with no fallback directory, so a bare name
  // plus a fallbackDir would otherwise be looked up at the root.
  if (item.storage !== 'dir') return await removeFsPath(blobRelativePath(item.dirName, item.entryName));
  purgeFsDirNode(blobRelativePath(item.dirName, item.entryName));
  return await vfsUnlink(item.entryName, item.dirName);
}

async function recycleVirtualPath(path, fallbackDir) {
  const item = getFsItemState(path, fallbackDir);
  const fileLabel = vfsSplitPath(path, fallbackDir).fileName || path;
  if (!item) return { ok: false, message: 'File not found: ' + fileLabel };
  const sourcePath = blobRelativePath(item.dirName, item.entryName);
  if (vfsNormalizeDir(sourcePath).startsWith(vfsNormalizeDir(RECYCLE_STORAGE_DIR))) {
    return { ok: false, message: 'Item is already in the Recycle Bin.' };
  }

  const id = 'RB_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const storedDir = RECYCLE_STORAGE_DIR + '\\' + id;
  ensureFsDir(storedDir);

  if (item.storage === 'blob' && item.blob?.kind === 'image') handleWallpaperFileDelete(item.dirName, item.entryName);
  if (item.storage === 'dir') handleWallpaperTreeDelete(sourcePath);

  const moved = await moveFsItemByPath(path, fallbackDir, storedDir, { newName: item.entryName });
  if (!moved) {
    await removeFsPath(storedDir);
    return { ok: false, message: 'Could not move ' + fileLabel + ' to the Recycle Bin.' };
  }

  recycleBinEntries.unshift({
    id,
    name: moved.name,
    kind: item.kind,
    originalDir: item.dirName,
    storedDir,
    deletedAt: Date.now(),
  });
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, deleted: true, recycled: true, details: ['Moved to Recycle Bin: ' + fileLabel] };
}

async function restoreRecycleEntry(entry) {
  entry = normalizeRecycleEntry(entry);
  if (!entry) return { ok: false, message: 'Recycle entry is missing.' };
  ensureFsDir(entry.originalDir);
  const moved = await moveFsItemByPath(entry.name, entry.storedDir, entry.originalDir, {
    newName: entry.name,
    makeUnique: true,
    suffixToken: 'restored',
  });
  if (!moved) return { ok: false, message: 'Could not restore ' + entry.name + '.' };
  await removeFsPath(entry.storedDir);
  recycleBinEntries = recycleBinEntries.filter(item => item.id !== entry.id);
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, restored: true, name: moved.name, dirName: entry.originalDir };
}

async function purgeRecycleEntry(entry) {
  entry = normalizeRecycleEntry(entry);
  if (!entry) return { ok: false, message: 'Recycle entry is missing.' };
  await purgeFsPath(recycleEntryStoredPath(entry), entry.storedDir);
  await removeFsPath(entry.storedDir);
  recycleBinEntries = recycleBinEntries.filter(item => item.id !== entry.id);
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, deleted: true };
}

// Sequential rather than Promise.all: each purge rewrites recycleBinEntries,
// so overlapping them would race on that array.
async function emptyRecycleBin() {
  for (const entry of recycleBinEntries.slice()) await purgeRecycleEntry(entry);
}

function confirmEmptyRecycleBin(onDone) {
  if (!recycleBinEntries.length) {
    if (typeof onDone === 'function') onDone(false);
    return;
  }
  osConfirm('Permanently delete all items in the Recycle Bin?', 'Empty Recycle Bin', async ok => {
    if (!ok) {
      if (typeof onDone === 'function') onDone(false);
      return;
    }
    // onDone re-renders the view, so it has to wait for the purge to finish or
    // it draws the bin still holding everything it just deleted.
    await emptyRecycleBin();
    if (typeof onDone === 'function') onDone(true);
  }, 'icon:recycle-full');
}

function promptCreateFolderAt(dirPath, onDone) {
  // The callback may be async: osPrompt closes its window before invoking it
  // and ignores the return value, so nothing is left on screen waiting.
  osPrompt('Folder name:', '', 'New Folder', async name => {
    const finish = result => { if (typeof onDone === 'function') onDone(result); };
    if (!name) return finish(null);
    let created;
    try {
      created = await vfsMkdir(name, dirPath);
    } catch (err) {
      // fsCreateDir returned null here and the dialog simply closed in silence.
      // vfsMkdir throws instead, so `created?.created` would stop being a
      // failure check at all - the error has to be caught, and a failure the
      // user asked for is worth saying out loud. ENOENT is reachable (the
      // target folder can be deleted while the dialog is open) and so is
      // EINVAL (a name that is nothing but separators).
      osAlert(
        err.code === 'ENOENT'
          ? 'That folder no longer exists:\nC:\\sleepOS\\' + vfsNormalizeDir(dirPath)
          : err.message,
        'New Folder', 'icon:error'
      );
      return finish(null);
    }
    // No hand-rolled 'fs-changed' dispatch: vfsMkdir queues its own op and
    // _vfsQueue fires the change callback synchronously, so the event is
    // already out by the time this resolves. onDone (Explorer's render()) runs
    // after the directory exists, not before.
    if (!created.created) return finish(null);
    finish(created);
  }, 'icon:folder');
}

function getRootSystemFiles(options) {
  const opts = options || {};
  const names = ROOT_SYSTEM_FILE_META.map(entry => entry.name);
  const explorerIndex = names.indexOf('EXPLORER.exe');
  if (opts.includeExplorer === false && explorerIndex !== -1) names.splice(explorerIndex, 1);
  return names;
}

function isVisibleRootSystemFile(name, options) {
  const target = String(name || '').toUpperCase();
  return getRootSystemFiles(options).some(item => item.toUpperCase() === target);
}

// fallbackDir is optional and defaults to unset (root), matching every call
// site that has no cwd to give - _kernelUiIsSystemPath (os/kernel.js) and the
// interpreter's fs adapter isSystemPath (os/script/interp.js) both call this
// with no third argument and must keep answering "is this a root system path"
// with no notion of cwd. A caller that already resolved the SAME path with a
// fallbackDir (deleteVirtualPath, the terminal's OPEN) must pass that same
// fallbackDir here, or the guard disagrees with the operation it guards -
// e.g. `DEL TERMINAL.exe` from cwd DOCS meaning DOCS\TERMINAL.exe while this
// guard silently treated the bare name as the root binary. This is the same
// shape as the other two phase-6 write guards, notepadGuardProtectedSave
// (apps/notepad.js) and terminalProtectedWriteError (apps/terminal.js): split
// with the operation's fallbackDir first, then check `!dirName` (root only).
function isVisibleSystemPath(path, options, fallbackDir) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  return !dirName && isVisibleRootSystemFile(fileName, options);
}

function getBuiltInProcesses() {
  return BUILTIN_PROCESS_SEED.map(proc => ({ ...proc })).sort((a, b) => a.pid - b.pid);
}

function findBuiltInProcess(pid) {
  return getBuiltInProcesses().find(proc => proc.pid === pid) || null;
}

function canAttemptDeleteItem(path, fallbackDir, meta) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) return false;
  if (meta?.sysfile) return false;
  return true;
}

async function deleteVirtualPath(path, fallbackDir) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const fileLabel = fileName || path;
  if (!fileName) return { ok: false, message: 'Usage: DEL <file>' };

  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['Core directories are protected.'],
    };
  }

  if (isVisibleSystemPath(path, { includeExplorer: true }, fallbackDir)) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['System files are protected.'],
    };
  }

  return await recycleVirtualPath(path, fallbackDir);
}
