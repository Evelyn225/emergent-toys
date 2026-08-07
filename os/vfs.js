// Virtual filesystem. Metadata (path resolution, stat, listing, existence) is
// served synchronously from an in-memory tree. File content reads and all
// writes are async, because phase 4 moves them to IndexedDB.
//
// The API is path-based and never exposes an inode number. That is deliberate:
// it lets phase 4 replace the internal representation with the inode/dirent
// model without touching a single call site.

// Error carrying a POSIX-style code. Callers branch on `.code`, never on the
// message. Codes in use: ENOENT, EEXIST, ENOTDIR, EISDIR, ENOSPC, EINVAL, EACCES.
function VfsError(code, message) {
  const err = new Error(message || code);
  err.name = 'VfsError';
  err.code = code;
  return err;
}

// ── The live tree -────────────────────────────────────────────────
// A node is { dirs:Set<UPPERNAME>, files:Map<name,string>,
//             blobs:Map<name,{url,kind,size,mime}>, subdirs:Map<UPPERNAME,node> }
// This is the same shape phase 1 used, so behavior is identical by
// construction and there is no data migration. Phase 4 replaces it with
// inodes and dirents; because nothing outside this file touches a node,
// that swap is invisible to callers.
var _vfsRoot = null;

function vfsSetTree(node) { _vfsRoot = node; }
function vfsGetTree() { return _vfsRoot; }

function vfsMakeNode() {
  return { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() };
}

// ── Path helpers (pure, synchronous) ──────────────────────────────
function vfsNormalizeDir(name) {
  return String(name || '')
    .trim()
    .replace(/^C:\\sleepOS\\?/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '')
    .toUpperCase();
}

function vfsSplitPath(path, fallbackDir) {
  const cleaned = String(path || '')
    .trim()
    .replace(/^C:\\sleepOS\\?/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '');
  if (!cleaned) return { dirName: vfsNormalizeDir(fallbackDir), fileName: '' };
  const parts = cleaned.split('\\').filter(Boolean);
  if (parts.length === 1) return { dirName: vfsNormalizeDir(fallbackDir), fileName: parts[0] };
  return {
    dirName: vfsNormalizeDir(parts.slice(0, -1).join('\\')),
    fileName: parts[parts.length - 1],
  };
}

// ── Sync metadata ─────────────────────────────────────────────────
// Returns the live node. Internal to the VFS and to fs-core's remaining
// wrappers; call sites use stat/list/exists instead.
function vfsDirNodeSync(dirPath) {
  if (!_vfsRoot) return null;
  const parts = vfsNormalizeDir(dirPath).split('\\').filter(Boolean);
  let node = _vfsRoot;
  for (const part of parts) {
    if (!node.subdirs) node.subdirs = new Map();
    if (!node.subdirs.has(part)) {
      // A name in `dirs` without a node in `subdirs` is a directory that was
      // persisted but never materialized. Create it lazily rather than
      // reporting a missing directory that the user can see in a listing.
      if (node.dirs.has(part)) node.subdirs.set(part, vfsMakeNode());
      else return null;
    }
    node = node.subdirs.get(part);
  }
  return node;
}

function vfsDirExistsSync(dirPath) {
  return vfsDirNodeSync(dirPath) !== null;
}

function vfsStatSync(path, fallbackDir) {
  const { dirName, fileName } = vfsSplitPath(path, fallbackDir);
  const dir = vfsDirNodeSync(dirName);
  if (!dir || !fileName) return null;
  if (dir.files && dir.files.has(fileName)) {
    return {
      dirName, name: fileName, type: 'file', kind: 'text',
      size: String(dir.files.get(fileName) || '').length,
    };
  }
  if (dir.blobs && dir.blobs.has(fileName)) {
    const blob = dir.blobs.get(fileName);
    return {
      dirName, name: fileName, type: 'file', kind: 'blob',
      size: (blob && blob.size) || 0, blob,
    };
  }
  const upper = fileName.toUpperCase();
  if (dir.dirs && dir.dirs.has(upper)) {
    return { dirName, name: upper, type: 'dir', kind: 'dir', size: 0 };
  }
  return null;
}

function vfsExistsSync(path, fallbackDir) {
  return vfsStatSync(path, fallbackDir) !== null;
}

function vfsListSync(dirPath) {
  const dir = vfsDirNodeSync(dirPath);
  if (!dir) return [];
  const base = vfsNormalizeDir(dirPath);
  const out = [];
  (dir.dirs || new Set()).forEach(name => {
    out.push({ dirName: base, name, type: 'dir', kind: 'dir', size: 0 });
  });
  (dir.files || new Map()).forEach((value, name) => {
    out.push({ dirName: base, name, type: 'file', kind: 'text', size: String(value || '').length });
  });
  (dir.blobs || new Map()).forEach((blob, name) => {
    out.push({ dirName: base, name, type: 'file', kind: 'blob', size: (blob && blob.size) || 0, blob });
  });
  return out;
}

// ── Mount, persistence, and the write path ────────────────────────
var _vfsBackend = null;
var _vfsOnChange = null;
var _vfsOnError = null;
var _vfsPendingOps = [];
var _vfsFlushTimer = null;
var _vfsFlushPromise = null;
var _vfsQuotaBytes = Infinity;
var _vfsUsageBytes = 0;
var _vfsPendingBytes = 0;

const VFS_FLUSH_DELAY_MS = 400;

function vfsIsMounted() { return _vfsBackend !== null; }

// True when mutations have been made but not yet committed. Used by the
// unload handler to skip serializing a tree that is already durable.
function vfsHasPendingWrites() { return _vfsPendingOps.length > 0; }

function _vfsSerNode(node) {
  const out = { dirs: [...node.dirs], files: {}, subdirs: {} };
  node.files.forEach((v, k) => { out.files[k] = v; });
  if (node.subdirs) node.subdirs.forEach((v, k) => { out.subdirs[k] = _vfsSerNode(v); });
  return out;
}

function _vfsDesNode(obj) {
  const node = vfsMakeNode();
  (obj.dirs || []).forEach(d => node.dirs.add(d));
  Object.entries(obj.files || {}).forEach(([k, v]) => node.files.set(k, v));
  Object.entries(obj.subdirs || {}).forEach(([k, v]) => node.subdirs.set(k, _vfsDesNode(v)));
  return node;
}

// Blobs are deliberately absent from the snapshot. Their bytes live in
// IndexedDB via the blob store and their in-memory record is an object URL,
// which cannot be serialized. Persisting the record would produce a dead URL
// on the next boot.
function vfsSerializeTree() {
  return _vfsRoot ? _vfsSerNode(_vfsRoot) : { dirs: [], files: {}, subdirs: {} };
}

async function vfsMount(backend, options) {
  options = options || {};
  // Drop anything still live from a previous mount. A surviving timer or
  // in-flight promise would fire against the new tree.
  clearTimeout(_vfsFlushTimer);
  _vfsFlushTimer = null;
  _vfsFlushPromise = null;
  _vfsPendingOps = [];
  _vfsPendingBytes = 0;
  _vfsOnChange = typeof options.onChange === 'function' ? options.onChange : null;
  _vfsOnError = typeof options.onError === 'function' ? options.onError : null;

  let stored = null;
  try {
    stored = await backend.load();
  } catch (e) {
    // A corrupted store must not stop the OS from booting. Report it and start
    // from an empty tree, exactly as loadFS did before.
    if (_vfsOnError) _vfsOnError(e);
  }
  _vfsRoot = stored ? _vfsDesNode(stored) : vfsMakeNode();
  if (typeof options.seed === 'function') options.seed(_vfsRoot);
  // Publish the backend only once the tree behind it is real, so there is no
  // window where vfsIsMounted() is true but a write throws ENOENT on the root.
  _vfsBackend = backend;
  await _vfsRefreshQuota();
}

async function _vfsRefreshQuota() {
  try {
    const est = await _vfsBackend.estimate();
    _vfsQuotaBytes = Number.isFinite(est.quota) ? est.quota : Infinity;
    _vfsUsageBytes = Number(est.usage) || 0;
  } catch (e) {
    // Fail open on the quota, but leave _vfsUsageBytes alone: a transient
    // estimate() failure must not erase a figure we already know is good.
    _vfsQuotaBytes = Infinity;
  }
}

// Refuse a write that cannot fit before mutating anything. The old code caught
// the quota exception and discarded it, so a full disk silently ate the user's
// work. Checking up front is what lets Notepad refuse to save instead of
// reporting success and losing the file.
//
// _vfsPendingBytes covers writes that have mutated the tree but not yet been
// committed. Without it the whole guard collapses for any burst inside one
// debounce window, which is the normal case: Notepad autosave, a script doing
// several `echo >`, a multi-file drop.
function _vfsAssertRoom(extraBytes) {
  if (!Number.isFinite(_vfsQuotaBytes)) return;
  const projected = _vfsUsageBytes + _vfsPendingBytes + Math.max(0, extraBytes);
  if (projected > _vfsQuotaBytes) {
    throw VfsError('ENOSPC', 'not enough space: need ' + projected + ' of ' + _vfsQuotaBytes + ' bytes');
  }
}

// Size a text write the way the snapshot will actually store it: JSON-escaped,
// plus the dirent key overhead. Raw string length under-counts newlines and
// backslashes, and sleepOS content is full of both.
function _vfsTextCost(name, value) {
  return JSON.stringify(String(value == null ? '' : value)).length + String(name).length + 4;
}

function _vfsQueue(op, deltaBytes) {
  _vfsPendingOps.push(op);
  _vfsPendingBytes += Math.max(0, Number(deltaBytes) || 0);
  if (_vfsOnChange) _vfsOnChange(op);
  clearTimeout(_vfsFlushTimer);
  _vfsFlushTimer = setTimeout(() => { void vfsFlush(); }, VFS_FLUSH_DELAY_MS);
}

// Commit pending mutations. This never rejects - `onError` is the reporting
// channel, because the debounce path discards this promise and a rejection
// there would be an unhandled rejection with no caller to catch it.
async function vfsFlush() {
  clearTimeout(_vfsFlushTimer);
  _vfsFlushTimer = null;
  // Never hand back an in-flight commit as if it were ours. Its snapshot was
  // taken before our ops existed, so returning it would report durability we
  // do not have. Wait for it to land, then commit ours.
  while (_vfsFlushPromise) {
    try { await _vfsFlushPromise; } catch (e) { /* reported via onError already */ }
  }
  if (!_vfsBackend || !_vfsPendingOps.length) return;
  const backend = _vfsBackend;
  const ops = _vfsPendingOps;
  const opsBytes = _vfsPendingBytes;
  _vfsPendingOps = [];
  const flushed = (async () => {
    const snapshot = vfsSerializeTree();
    try {
      await backend.commit({ ops, snapshot });
      // A remount while this was in flight means these numbers describe a
      // filesystem that is no longer mounted. Do not let them poison the new one.
      if (_vfsBackend === backend) {
        _vfsUsageBytes = JSON.stringify(snapshot).length;
        // Subtract only what this commit carried. Ops that arrived mid-commit
        // are still uncommitted, and zeroing here would stop counting their
        // bytes while they are still unwritten - the same hole C2 closed.
        _vfsPendingBytes = Math.max(0, _vfsPendingBytes - opsBytes);
      }
    } catch (err) {
      // Put the ops back rather than dropping them. Losing them means the
      // user's last save is gone with only a transient callback to show for it.
      // Deliberately no auto-retry: on a persistently full disk that would be
      // an error-toast storm. The next mutation or explicit flush retries, and
      // because the snapshot is whole-tree that one commit carries everything.
      if (_vfsBackend === backend) _vfsPendingOps = ops.concat(_vfsPendingOps);
      throw err;
    } finally {
      // Only clear if this is still the current flush. A remount can install a
      // newer one while we are in flight, and nulling that would let a later
      // flush run concurrently with it.
      if (_vfsFlushPromise === flushed) _vfsFlushPromise = null;
    }
  })();
  _vfsFlushPromise = flushed;
  try {
    await flushed;
  } catch (err) {
    // An onError handler must not call vfsFlush() against a failing backend:
    // the promise is already cleared by this point, so it would recurse without
    // bound and reinstate exactly the auto-retry storm this design avoids.
    if (_vfsOnError) _vfsOnError(err);
    else console.warn('sleepOS VFS: commit failed -', (err && err.message) || err);
  }
  // Ops that arrived while we were committing (or ops a failed commit put
  // back) are not scheduled again here. _vfsQueue already arms a fresh timer
  // on every write, including ones that land mid-commit, so a genuinely new
  // op is already covered. Rescheduling unconditionally here would also
  // catch ops recycled after a failure, turning a persistently broken
  // backend into an infinite retry loop - the opposite of the "no
  // auto-retry" contract above. The next write or an explicit vfsFlush()
  // call is what drains anything left over.
}

// ── Content and mutations ─────────────────────────────────────────
async function vfsReadFile(path, fallbackDir) {
  const st = vfsStatSync(path, fallbackDir);
  if (!st || st.kind !== 'text') return null;
  return vfsDirNodeSync(st.dirName).files.get(st.name);
}

async function vfsWriteFile(path, text, fallbackDir, options) {
  options = options || {};
  const { dirName, fileName } = vfsSplitPath(path, fallbackDir);
  if (!fileName) throw VfsError('EINVAL', 'no filename in path: ' + path);
  const dir = vfsDirNodeSync(dirName);
  if (!dir) throw VfsError('ENOENT', 'no such directory: ' + dirName);
  // Refuse to write text over a binary file. Without this the name ends up in
  // both files and blobs, and since stat checks files first the text entry
  // permanently shadows the blob: the media is still in memory but nothing
  // can reach it.
  if (dir.blobs && dir.blobs.has(fileName)) {
    throw VfsError('EEXIST', 'a binary file already uses that name: ' + fileName);
  }
  const nextValue = String(text == null ? '' : text);
  const hadFile = dir.files.has(fileName);
  const prevValue = hadFile ? dir.files.get(fileName) : null;
  if (hadFile && prevValue === nextValue) {
    return { dirName, fileName, created: false, unchanged: true };
  }
  _vfsAssertRoom(_vfsTextCost(fileName, nextValue) - (hadFile ? _vfsTextCost(fileName, prevValue) : 0));
  dir.files.set(fileName, nextValue);
  _vfsQueue({ op: 'write', dirName, name: fileName },
            _vfsTextCost(fileName, nextValue) - (hadFile ? _vfsTextCost(fileName, prevValue) : 0));
  if (options.trackFragmentation !== false && typeof increaseDriveFragmentation === 'function') {
    increaseDriveFragmentation(calcTextFragmentationDelta(prevValue, nextValue, !hadFile));
  }
  return { dirName, fileName, created: !hadFile, unchanged: false };
}

async function vfsWriteBlob(path, record, fallbackDir, options) {
  options = options || {};
  const { dirName, fileName } = vfsSplitPath(path, fallbackDir);
  if (!fileName) throw VfsError('EINVAL', 'no filename in path: ' + path);
  const dir = vfsDirNodeSync(dirName);
  if (!dir) throw VfsError('ENOENT', 'no such directory: ' + dirName);
  // Mirror of the guard in vfsWriteFile. stat checks files before blobs, so a
  // text entry of the same name would permanently shadow this blob.
  if (dir.files && dir.files.has(fileName)) {
    throw VfsError('EEXIST', 'a text file already uses that name: ' + fileName);
  }
  const existing = dir.blobs.get(fileName);
  if (existing && existing.url && existing.url !== (record && record.url)) {
    URL.revokeObjectURL(existing.url);
  }
  dir.blobs.set(fileName, record);
  _vfsQueue({ op: 'writeBlob', dirName, name: fileName });
  if (options.trackFragmentation !== false && typeof increaseDriveFragmentation === 'function') {
    increaseDriveFragmentation(calcBlobFragmentationDelta(record && record.size, !existing));
  }
  return { dirName, fileName, created: !existing };
}

async function vfsMkdir(path, fallbackDir, options) {
  options = options || {};
  const { dirName, fileName } = vfsSplitPath(path, fallbackDir);
  const parent = vfsDirNodeSync(dirName);
  const name = String(fileName || '').toUpperCase();
  if (!parent) throw VfsError('ENOENT', 'no such directory: ' + dirName);
  if (!name) throw VfsError('EINVAL', 'no directory name in path: ' + path);
  if (parent.dirs.has(name)) return { dirName, fileName: name, created: false };
  parent.dirs.add(name);
  if (!parent.subdirs) parent.subdirs = new Map();
  if (!parent.subdirs.has(name)) parent.subdirs.set(name, vfsMakeNode());
  _vfsQueue({ op: 'mkdir', dirName, name });
  if (options.trackFragmentation !== false && typeof increaseDriveFragmentation === 'function') {
    increaseDriveFragmentation(0.006);
  }
  return { dirName, fileName: name, created: true };
}

async function vfsUnlink(path, fallbackDir, options) {
  options = options || {};
  const st = vfsStatSync(path, fallbackDir);
  if (!st) return false;
  const dir = vfsDirNodeSync(st.dirName);
  let payload = null;
  if (st.kind === 'text') {
    payload = dir.files.get(st.name);
    dir.files.delete(st.name);
  } else if (st.kind === 'blob') {
    const blob = dir.blobs.get(st.name);
    payload = (blob && blob.size) || 0;
    if (blob && blob.url && !blob.seeded) URL.revokeObjectURL(blob.url);
    dir.blobs.delete(st.name);
  } else {
    dir.dirs.delete(st.name);
    if (dir.subdirs) dir.subdirs.delete(st.name);
  }
  _vfsQueue({ op: 'unlink', dirName: st.dirName, name: st.name, kind: st.kind }, 0);
  if (options.trackFragmentation !== false
      && typeof increaseDriveFragmentation === 'function'
      && typeof calcRemovalFragmentationDelta === 'function') {
    increaseDriveFragmentation(calcRemovalFragmentationDelta(st.kind, payload));
  }
  return true;
}

async function vfsRename(dirPath, oldName, newName) {
  const base = vfsNormalizeDir(dirPath);
  const dir = vfsDirNodeSync(base);
  if (!dir) throw VfsError('ENOENT', 'no such directory: ' + base);
  const st = vfsStatSync(oldName, base);
  if (!st) return false;
  const targetName = st.kind === 'dir' ? String(newName || '').toUpperCase() : String(newName || '');
  if (!targetName) throw VfsError('EINVAL', 'empty rename target');
  const existing = vfsStatSync(targetName, base);
  // Renaming an entry to the name it already has is a no-op, not a collision.
  // Directory names are uppercased, so typing 'docs' for DOCS lands here.
  if (existing && existing.name === st.name && existing.kind === st.kind) return true;
  if (existing) {
    throw VfsError('EEXIST', 'name already in use: ' + targetName);
  }
  if (st.kind === 'text') {
    // A rename moves the dirent. It does not read or rewrite content, which
    // is why this stays cheap when phase 4 puts content in IndexedDB.
    const value = dir.files.get(st.name);
    dir.files.delete(st.name);
    dir.files.set(targetName, value);
  } else if (st.kind === 'blob') {
    const record = dir.blobs.get(st.name);
    dir.blobs.delete(st.name);
    dir.blobs.set(targetName, record);
  } else {
    const sub = dir.subdirs ? dir.subdirs.get(st.name) : null;
    dir.dirs.delete(st.name);
    if (dir.subdirs) dir.subdirs.delete(st.name);
    dir.dirs.add(targetName);
    if (!dir.subdirs) dir.subdirs = new Map();
    if (sub) dir.subdirs.set(targetName, sub);
  }
  _vfsQueue({ op: 'rename', dirName: base, name: st.name, newName: targetName, kind: st.kind }, 0);
  return true;
}

// Move an entry between directories. vfsRename is deliberately same-directory
// only, because a rename is a single dirent update; a move touches two
// directories and needs both to exist. Returns the name actually used at the
// destination, or null if the source is missing.
async function vfsMove(srcDirPath, srcName, dstDirPath, dstName) {
  const srcBase = vfsNormalizeDir(srcDirPath);
  const dstBase = vfsNormalizeDir(dstDirPath);
  const srcDir = vfsDirNodeSync(srcBase);
  const dstDir = vfsDirNodeSync(dstBase);
  if (!srcDir) throw VfsError('ENOENT', 'no such directory: ' + srcBase);
  if (!dstDir) throw VfsError('ENOENT', 'no such directory: ' + dstBase);
  const st = vfsStatSync(srcName, srcBase);
  if (!st) return null;
  // Within one directory this is just a rename, so do not duplicate the logic.
  if (srcBase === dstBase) {
    const renamed = await vfsRename(srcBase, srcName, dstName || srcName);
    return renamed ? (st.kind === 'dir' ? String(dstName || srcName).toUpperCase() : String(dstName || srcName)) : null;
  }
  const targetName = st.kind === 'dir'
    ? String(dstName || st.name).toUpperCase()
    : String(dstName || st.name);
  if (vfsStatSync(targetName, dstBase)) {
    throw VfsError('EEXIST', 'name already in use: ' + targetName);
  }
  if (st.kind === 'text') {
    const value = srcDir.files.get(st.name);
    srcDir.files.delete(st.name);
    dstDir.files.set(targetName, value);
  } else if (st.kind === 'blob') {
    const record = srcDir.blobs.get(st.name);
    srcDir.blobs.delete(st.name);
    if (!dstDir.blobs) dstDir.blobs = new Map();
    dstDir.blobs.set(targetName, record);
  } else {
    const sub = srcDir.subdirs ? srcDir.subdirs.get(st.name) : null;
    srcDir.dirs.delete(st.name);
    if (srcDir.subdirs) srcDir.subdirs.delete(st.name);
    dstDir.dirs.add(targetName);
    if (!dstDir.subdirs) dstDir.subdirs = new Map();
    if (sub) dstDir.subdirs.set(targetName, sub);
  }
  _vfsQueue({ op: 'move', dirName: srcBase, name: st.name, dstDirName: dstBase, newName: targetName, kind: st.kind }, 0);
  return targetName;
}

async function vfsEstimate() {
  if (!_vfsBackend) return { usage: 0, quota: 0 };
  await _vfsRefreshQuota();
  return { usage: _vfsUsageBytes, quota: _vfsQuotaBytes };
}
