// Virtual filesystem. Metadata (path resolution, stat, listing, existence) is
// served synchronously from an in-memory tree. File content reads and all
// writes are async, because phase 4 moves them to IndexedDB.
//
// The API is path-based and never exposes an inode number. That is deliberate:
// it lets phase 4 replace the internal representation with the inode/dirent
// model without touching a single call site.

// Error carrying a POSIX-style code. Callers branch on `.code`, never on the
// message. Codes in use: ENOENT, EEXIST, ENOSPC, EINVAL, EACCES.
// ENOTDIR and EISDIR were listed here from the start and were never emitted by
// anything. They are dropped rather than added: vfsDirNodeSync cannot tell
// "no such directory" from "that component is a file" without a signature
// change on the one function every write path resolves through, and no caller
// branches on either code today. Phase 4 can add ENOTDIR when it rewrites path
// resolution against inodes; advertising it now would be a lie in a comment.
function VfsError(code, message) {
  const err = new Error(message || code);
  err.name = 'VfsError';
  err.code = code;
  return err;
}

// ── The live tree ─────────────────────────────────────────────────
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
// The drive-prefix strip requires a separator or end of string. Without the
// boundary, `C:\sleepOSother\x` had the literal text stripped and resolved to
// the bogus relative path `OTHER\X`. sleepOS has exactly one drive root, so a
// path starting `C:\sleepOS` followed by non-separator characters refers to
// nothing that exists; failing to resolve it is better than resolving it
// somewhere else.
function vfsNormalizeDir(name) {
  return String(name || '')
    .trim()
    .replace(/^C:\\sleepOS(?:\\|$)/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '')
    .toUpperCase();
}

function vfsSplitPath(path, fallbackDir) {
  const cleaned = String(path || '')
    .trim()
    .replace(/^C:\\sleepOS(?:\\|$)/i, '')
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
var _vfsOnCommit = null;
var _vfsOnError = null;
var _vfsPendingOps = [];
var _vfsFlushTimer = null;
var _vfsFlushPromise = null;
var _vfsQuotaBytes = Infinity;
var _vfsUsageBytes = 0;
var _vfsPendingBytes = 0;

const VFS_FLUSH_DELAY_MS = 400;

function vfsIsMounted() { return _vfsBackend !== null; }

// The mounted backend, for callers that need something only a specific backend
// offers - today that is the IndexedDB backend's allocation map, which is what
// makes fragmentation a measurement. Returns null when nothing is mounted.
function vfsGetBackend() { return _vfsBackend; }

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
  _vfsOnCommit = typeof options.onCommit === 'function' ? options.onCommit : null;
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

// The escape hatch for the two remaining direct-tree mutators in os/daemon.js
// (ensureFsDir, ensureStoryTextFile). Both must stay synchronous - module-level
// callers depend on ensureFsDir during bundle evaluation, and
// syncDaemonStoryFiles is synchronous - so neither can go through the async
// vfsMkdir/vfsWriteFile. What they emitted before was a pathless
// `legacy-write` marker, or for a write into an existing directory, nothing at
// all: both were invisible to a backend that commits from ops alone, and both
// only worked because every backend took a whole-tree snapshot that happened to
// include the mutation. These emit the same op shapes the real writers do, so a
// direct mutation is indistinguishable from a normal one downstream. Safe
// because readEntry resolves against the LIVE tree at commit time, and the
// caller has already mutated it.
function vfsQueueDirectMkdir(dirName, name) {
  _vfsQueue({ op: 'mkdir', dirName, name }, 0);
}

// `prevValue` is what the caller overwrote, needed only for the byte delta.
// Deliberately does NOT call _vfsAssertRoom: these callers are synchronous
// story-beat code with no path to handle an ENOSPC throw, and adding one would
// turn a full disk into a thrown error in the middle of a narrative beat. The
// bytes are still counted so the quota guard on normal writes stays honest.
function vfsQueueDirectWrite(dirName, name, prevValue) {
  const dir = vfsDirNodeSync(dirName);
  if (!dir || !dir.files || !dir.files.has(name)) return;
  const nextValue = dir.files.get(name);
  // Identical content is not a change. syncDaemonStoryFiles re-sets the same
  // text from dozens of story beats and from boot; emitting an op for each
  // would commit constantly and write the same blocks over and over.
  if (prevValue !== null && prevValue !== undefined && prevValue === nextValue) return;
  _vfsQueue({ op: 'write', dirName, name },
            _vfsTextCost(name, nextValue)
              - (prevValue === null || prevValue === undefined ? 0 : _vfsTextCost(name, prevValue)));
}

// The accessor handed to backend.commit. Returns null for a path that no
// longer exists, which is the normal case for an `unlink` op: the backend
// needs to know the entry is gone, not to be handed a stale copy of it.
//
// A non-null result for an `unlink` op is equally normal and just as real: it
// reads the LIVE tree, not a snapshot of what existed when the op was queued,
// so an unlink followed by a re-create of the same path within one debounce
// window resolves to the NEW entry, not "gone." A backend that gates deletion
// on `readEntry` returning null, rather than on `op.op === 'unlink'`, would
// silently keep the old generation's content around instead of overwriting
// it - os/storage-idb.js's commit() branches on op.op for exactly this
// reason and only falls through to readEntry's result for write/writeBlob.
//
// Async because of blobs. A blob's in-memory record is { url, kind, size,
// mime } and holds no bytes at all - the bytes are in the Blob behind that
// object URL. Fetching the URL is the only way to get them that works however
// the blob was created, and it is asynchronous. The alternative, adding a
// bytes field to the record, would keep a second full copy of every image and
// video in memory for the whole session on top of the Blob the URL pins.
async function _vfsReadEntryForCommit(dirName, name) {
  const dir = vfsDirNodeSync(dirName);
  if (!dir) return null;
  if (dir.files && dir.files.has(name)) {
    return { kind: 'file', text: dir.files.get(name), dirName, name };
  }
  if (dir.blobs && dir.blobs.has(name)) {
    const blob = dir.blobs.get(name);
    // No URL at all is a genuinely empty blob (nothing was ever there to
    // fetch) - not a read failure, so it takes the normal zero-byte path.
    if (!blob || !blob.url) {
      return { kind: 'blob', blob, bytes: new Uint8Array(0), dirName, name };
    }
    try {
      const bytes = new Uint8Array(await (await fetch(blob.url)).arrayBuffer());
      return { kind: 'blob', blob, bytes, dirName, name };
    } catch (e) {
      // A revoked or unreachable object URL must not fail the whole commit -
      // one bad blob must not drop every other change in this batch. But
      // `bytes` must NOT default to empty here: with the block layer as the
      // source of truth, empty bytes are a real, valid file, and persisting
      // them over an existing entry would silently destroy it. readFailed
      // marks this as "we don't know what these bytes are", distinct from
      // "these bytes are empty" - storage-idb.js's commit() skips the write
      // entirely for a readFailed entry (new or existing) rather than
      // treating no answer as an answer, and vfsFlush reports it through
      // onError, the same channel a save failure normally uses.
      return { kind: 'blob', blob, bytes: null, readFailed: true, dirName, name };
    }
  }
  if (dir.dirs && dir.dirs.has(name)) return { kind: 'dir', dirName, name };
  return null;
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
    // Skip the whole-tree walk for a backend that does not read it. The
    // IndexedDB backend commits from `ops` alone, and serializing the entire
    // filesystem on every commit just to throw it away would undo the main
    // reason for moving off the snapshot model. Undeclared means true, so
    // storage-local and storage-mem keep working untouched.
    const wantsSnapshot = backend.needsSnapshot !== false;
    const snapshot = wantsSnapshot ? vfsSerializeTree() : undefined;
    try {
      // `ops` are path descriptors and carry no content, so a backend writing
      // incrementally needs a way to read the current state of a named entry.
      // Reading live rather than from a snapshot is deliberate: by the time a
      // commit runs, the tree is the truth.
      const commitResult = await backend.commit({ ops, snapshot, readEntry: _vfsReadEntryForCommit });
      // A per-op failure (currently: a blob whose bytes could not be read -
      // see _vfsReadEntryForCommit's readFailed) is NOT a whole-commit
      // failure: the rest of the batch above already landed, so this must
      // not throw (that would re-queue ops that already committed) or go
      // unreported (that would be exactly the silent zero-byte overwrite
      // this exists to prevent). It gets its own onError call per failed
      // path, same channel and same "did not persist" meaning as any other
      // save failure.
      if (commitResult && commitResult.failedBlobs && commitResult.failedBlobs.length && _vfsOnError) {
        commitResult.failedBlobs.forEach(({ dirName, name }) => {
          _vfsOnError(VfsError('EIO', 'blob content unreadable, not saved: ' +
            (dirName ? dirName + '\\' : '') + name));
        });
      }
      // A remount while this was in flight means these numbers describe a
      // filesystem that is no longer mounted. Do not let them poison the new one.
      if (_vfsBackend === backend) {
        // Re-measure the ORIGIN, do not reseed from our own snapshot. The
        // localStorage quota is per-origin and os/blob-store.js writes base64
        // image content into it, so the snapshot's length describes the
        // filesystem key alone. Assigning it here silently blinded the
        // pre-write guard to every other key the moment the first commit
        // landed - on a media-heavy install vfsWriteFile would accept a write
        // the origin had no room for, report success, and only the late
        // commit failure would tell the user, by toast, that it was gone.
        // storage-local's estimate() already says the guard is only as honest
        // as this number.
        await _vfsRefreshQuota();
        // Subtract only what this commit carried. Ops that arrived mid-commit
        // are still uncommitted, and zeroing here would stop counting their
        // bytes while they are still unwritten - the same hole C2 closed.
        _vfsPendingBytes = Math.max(0, _vfsPendingBytes - opsBytes);
        // Fire only now that `ops` are durable - the whole reason this exists
        // separately from onChange. onChange fires the moment an op is
        // queued, 400ms before this; a caller that needs to read back what it
        // just wrote (fs-persist.js's fragmentation recompute reads the
        // backend's own allocation map) needs a signal that actually comes
        // after the commit, not before it.
        //
        // Same treatment as onChange: never let a throwing or rejecting
        // handler reach here as an unhandled rejection or interrupt the
        // commit path. vfsFlush deliberately never rejects, and this must not
        // become the exception. Deliberately NOT routed through _vfsOnError:
        // that channel means "this write did not persist" and drives a
        // user-facing toast (reportVfsError). The write already landed by
        // this point - a bug in a post-commit handler is not a save failure,
        // and reporting it as one would be a lie on screen.
        if (_vfsOnCommit) {
          try {
            const result = _vfsOnCommit(ops);
            if (result && typeof result.catch === 'function') {
              result.catch(e => {
                console.warn('sleepOS VFS: onCommit handler rejected -', (e && e.message) || e);
              });
            }
          } catch (e) {
            console.warn('sleepOS VFS: onCommit handler threw -', (e && e.message) || e);
          }
        }
      }
    } catch (err) {
      // Put the ops back rather than dropping them. Losing them means the
      // user's last save is gone with only a transient callback to show for it.
      // Deliberately no auto-retry: on a persistently full disk that would be
      // an error-toast storm. The next mutation or explicit flush retries, and
      // replaying these ops again is safe for either backend kind: a
      // snapshot backend re-sends the whole tree regardless of which ops
      // triggered it, and an ops-only backend (IndexedDB, needsSnapshot:
      // false) resolves `readEntry` against the LIVE tree at replay time, not
      // against whatever content was current when the op first queued - so a
      // stale value from the failed attempt can never be replayed. Per-op
      // idempotency backs this up: fsDeleteEntry and fsRenameEntry
      // (os/fs-format.js) return false rather than throwing when the target
      // is already gone or already moved, and fsWriteEntry releases a
      // rewritten entry's old blocks before allocating new ones, so a write
      // that partially landed before the failure does not double-allocate on
      // replay.
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
  return { dirName, fileName: name, created: true };
}

async function vfsUnlink(path, fallbackDir, options) {
  options = options || {};
  const st = vfsStatSync(path, fallbackDir);
  if (!st) return false;
  const dir = vfsDirNodeSync(st.dirName);
  if (st.kind === 'text') {
    dir.files.delete(st.name);
  } else if (st.kind === 'blob') {
    const blob = dir.blobs.get(st.name);
    if (blob && blob.url && !blob.seeded) URL.revokeObjectURL(blob.url);
    dir.blobs.delete(st.name);
  } else {
    dir.dirs.delete(st.name);
    if (dir.subdirs) dir.subdirs.delete(st.name);
  }
  _vfsQueue({ op: 'unlink', dirName: st.dirName, name: st.name, kind: st.kind }, 0);
  return true;
}

async function vfsRename(dirPath, oldName, newName) {
  const base = vfsNormalizeDir(dirPath);
  if (!vfsDirNodeSync(base)) throw VfsError('ENOENT', 'no such directory: ' + base);
  const st = vfsStatSync(oldName, base);
  if (!st) return false;
  // The source's real parent, exactly as vfsMove resolves it. `base` is only
  // the fallback directory: when oldName carries a path (DOCS\a.txt) the stat
  // lands in a different directory, and mutating base's node instead would
  // collision-check the wrong directory, delete nothing, and set `undefined`
  // at the target - a phantom entry that reports success, reads back empty,
  // and vanishes on the next reload.
  const dir = vfsDirNodeSync(st.dirName);
  const targetName = st.kind === 'dir' ? String(newName || '').toUpperCase() : String(newName || '');
  if (!targetName) throw VfsError('EINVAL', 'empty rename target');
  const existing = vfsStatSync(targetName, st.dirName);
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
  _vfsQueue({ op: 'rename', dirName: st.dirName, name: st.name, newName: targetName, kind: st.kind }, 0);
  return true;
}

// Move an entry between directories. vfsRename is deliberately same-directory
// only, because a rename is a single dirent update; a move touches two
// directories and needs both to exist. Returns the name actually used at the
// destination, or null if the source is missing.
async function vfsMove(srcDirPath, srcName, dstDirPath, dstName) {
  const srcBase = vfsNormalizeDir(srcDirPath);
  const dstBase = vfsNormalizeDir(dstDirPath);
  const dstDir = vfsDirNodeSync(dstBase);
  if (!vfsDirNodeSync(srcBase)) throw VfsError('ENOENT', 'no such directory: ' + srcBase);
  if (!dstDir) throw VfsError('ENOENT', 'no such directory: ' + dstBase);
  const st = vfsStatSync(srcName, srcBase);
  if (!st) return null;
  // The source's real parent. srcBase is only the fallback directory: when
  // srcName carries a path (DOCS\a.txt) vfsStatSync resolves into a different
  // directory, and mutating srcBase's node instead would delete nothing and
  // write `undefined` at the destination - a phantom entry that reports
  // success, reads back empty, and vanishes on the next reload.
  const from = vfsDirNodeSync(st.dirName);
  // Refuse to move a directory into itself or into its own subtree. The
  // destination node is resolved before the source dirent is unlinked, so
  // without this the subtree would be re-attached to a node inside itself:
  // unreachable from _vfsRoot, absent from the next snapshot, and gone for
  // good 400ms later. Names in the tree are uppercase and both paths are
  // normalized, so the prefix compare is exact.
  if (st.kind === 'dir') {
    const srcFull = st.dirName ? st.dirName + '\\' + st.name : st.name;
    if (dstBase === srcFull || dstBase.startsWith(srcFull + '\\')) {
      throw VfsError('EINVAL', 'cannot move a directory into itself: ' + srcFull);
    }
  }
  // Within one directory this is just a rename, so do not duplicate the logic.
  // Compare the source's real parent rather than srcBase, so a path-carrying
  // srcName still takes this branch when it resolves into the destination.
  if (st.dirName === dstBase) {
    const renamed = await vfsRename(st.dirName, st.name, dstName || st.name);
    return renamed ? (st.kind === 'dir' ? String(dstName || st.name).toUpperCase() : String(dstName || st.name)) : null;
  }
  const targetName = st.kind === 'dir'
    ? String(dstName || st.name).toUpperCase()
    : String(dstName || st.name);
  if (vfsStatSync(targetName, dstBase)) {
    throw VfsError('EEXIST', 'name already in use: ' + targetName);
  }
  if (st.kind === 'text') {
    const value = from.files.get(st.name);
    from.files.delete(st.name);
    dstDir.files.set(targetName, value);
  } else if (st.kind === 'blob') {
    const record = from.blobs.get(st.name);
    from.blobs.delete(st.name);
    if (!dstDir.blobs) dstDir.blobs = new Map();
    dstDir.blobs.set(targetName, record);
  } else {
    const sub = from.subdirs ? from.subdirs.get(st.name) : null;
    from.dirs.delete(st.name);
    if (from.subdirs) from.subdirs.delete(st.name);
    dstDir.dirs.add(targetName);
    if (!dstDir.subdirs) dstDir.subdirs = new Map();
    if (sub) dstDir.subdirs.set(targetName, sub);
  }
  _vfsQueue({ op: 'move', dirName: st.dirName, name: st.name, dstDirName: dstBase, newName: targetName, kind: st.kind }, 0);
  return targetName;
}

// Walk a subtree and hand every blob to a caller-supplied disposer. The VFS
// knows the tree shape; it does not know about object URLs or the blob store,
// so the caller supplies that half. Used when a delete is permanent (emptying
// the Recycle Bin), not when it is a move into it.
//
// Iterating `subdirs` rather than `dirs` is deliberate and complete: a name in
// `dirs` with no node in `subdirs` is a directory that was persisted but never
// materialized, and blobs are only ever set on a materialized node, so such a
// branch is provably blob-free.
function vfsWalkBlobs(dirPath, visit) {
  const node = vfsDirNodeSync(dirPath);
  if (!node) return;
  const base = vfsNormalizeDir(dirPath);
  (node.blobs || new Map()).forEach((blob, name) => visit(base, name, blob));
  (node.subdirs || new Map()).forEach((_sub, name) => {
    vfsWalkBlobs(base ? base + '\\' + name : name, visit);
  });
}

async function vfsEstimate() {
  if (!_vfsBackend) return { usage: 0, quota: 0 };
  await _vfsRefreshQuota();
  return { usage: _vfsUsageBytes, quota: _vfsQuotaBytes };
}
