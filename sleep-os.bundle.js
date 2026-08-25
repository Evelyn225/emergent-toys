// ─────────────────────────────────────────────────────────────────
// ICON REGISTRY
// ─────────────────────────────────────────────────────────────────
// Icon values travel through the OS as opaque strings: DESKTOP_ICONS entries
// carry one, mkWin takes one, osAlert takes one, resolveFsIcon returns one, and
// desktop shortcuts persist one into localStorage. Every one of those strings
// used to be an emoji, injected straight into innerHTML.
//
// A token ('icon:notepad') names a PNG in os/icons/. Anything else is still
// rendered as text, so the twenty-five PROJECTS emoji, the Start button, and
// any shortcut already persisted under the old scheme keep working untouched -
// and an unmapped emoji upgrades to art the moment a key is added below.
//
// ALWAYS render an icon value through iconMarkup(). Assigning one to
// textContent prints the raw token.
const OS_ICON_BASE = 'os/icons/';
const OS_ICON_TOKEN = 'icon:';
const OS_ICONS = {
  // ── Programs ──────────────────────────────────────────────────
  terminal:      'console_prompt-0.png',
  notepad:       'notepad-1.png',
  browser:       'browser.png',
  calc:          'calculator-0.png',
  sysmon:        'chart1-4.png',
  regedit:       'regedit-0.png',
  defrag:        'clean_drive.png',
  explorer:      'directory_open_file_mydocs-0.png',
  settings:      'settings.png',
  daemon:        'daemon_eye.png',
  void:          'void.png',
  // ── Filesystem ────────────────────────────────────────────────
  folder:        'directory_closed-0.png',
  'folder-open': 'directory_open_file_mydocs-0.png',
  text:          'file_lines-0.png',
  script:        'executable_script-1.png',
  exe:           'executable_script-1.png',
  image:         'image.png',
  video:         'media.png',
  audio:         'music.png',
  unknown:       'unknown-file.png',
  // The bare drive, as opposed to `defrag`'s drive-being-cleaned.
  disk:          'hard_disk_drive-0.png',
  lock:          'key_padlock-0.png',
  upload:        'upload.png',
  // ── Shell ─────────────────────────────────────────────────────
  'recycle-empty': 'recycle_bin_empty-0.png',
  'recycle-full':  'recycle_bin_full-0.png',
  home:          'homepage_alt.png',
  star:          'star.png',
  network:       'network.png',
  standby:       'standby_icon.png',
  // ── Registry value types ──────────────────────────────────────
  // Real regedit draws string values with an "ab" glyph and numeric ones with
  // the binary glyph, which is why REG_DWORD gets the binary icon rather than
  // an icon of its own: the registry only holds REG_SZ and REG_DWORD, and
  // lumping DWORD in with binary is what the OS being imitated actually does.
  'regedit-string': 'regedit_string.png',
  'regedit-binary': 'regedit_binary.png',
  // ── Web links (browser start page) ────────────────────────────
  wikipedia:         'wikipedia.png',
  'internet-archive': 'internet_archive.png',
  poolsuite:         'poolsuite-fm.png',
  // Keys are matched by test/icon-assets.test.cjs with [a-z][a-z-]* - no
  // digits - so the win98icons.alexmeub.com link cannot be keyed 'win98icons'.
  // A key with a digit is silently skipped by the registry parser there, which
  // would drop the file out of every icon guard at once.
  'win-icons':       'win98icons.png',
  // ── Dialogs ───────────────────────────────────────────────────
  warning:       'warning.png',
  error:         'restricted.png',
  // `info` is the identity of a thing (Properties, About); `tip` is advice, and
  // is what a bare osAlert falls back to.
  info:          'info.png',
  tip:           'tip.png',
  success:       'checkmark.png',
};

function osIconKey(value) {
  const s = String(value == null ? '' : value);
  if (!s.startsWith(OS_ICON_TOKEN)) return '';
  const key = s.slice(OS_ICON_TOKEN.length);
  return Object.prototype.hasOwnProperty.call(OS_ICONS, key) ? key : '';
}
function isOsIcon(value) {
  return !!osIconKey(value);
}
function osIconSrc(value) {
  const key = osIconKey(value);
  return key ? OS_ICON_BASE + OS_ICONS[key] : '';
}
// The `alt` is deliberately empty: every icon in this OS sits beside a text
// label that already names the thing, so alt text would only double it up.
function iconMarkup(value) {
  const key = osIconKey(value);
  if (key) return '<img class="os-icon" src="' + OS_ICON_BASE + OS_ICONS[key] + '" alt="" draggable="false">';
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// For the callers that build DOM nodes instead of HTML strings.
function setIconContent(el, value) {
  if (!el) return el;
  el.innerHTML = iconMarkup(value);
  return el;
}
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

// Set while DEFRAG.exe is relocating blocks. A commit landing mid-compaction
// would allocate blocks and rewrite inodes underneath a plan computed from a
// snapshot, so vfsFlush defers for the duration - ops accumulate in the
// pending queue exactly as they already do behind the 400ms debounce, and land
// when the run ends.
//
// Deferring writes for a few seconds during an explicitly user-initiated
// defragmentation is what real defragmenters do. The danger is the flag being
// left set: that silently stops the filesystem persisting for the rest of the
// session, so every exit path in fsRunCompaction clears it, including the
// throwing one.
var _vfsDefragActive = false;
function vfsSetDefragActive(active) { _vfsDefragActive = !!active; }
function vfsIsDefragActive() { return _vfsDefragActive; }

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
  // Metadata only (size/kind/mime, no url/bytes). `obj.blobs` only ever has
  // content for the IndexedDB backend - fsReadTree (os/fs-format.js) is the
  // one place that produces it; storage-mem/storage-local's load() round-
  // trips vfsSerializeTree(), which deliberately omits blobs (see that
  // function below), so this is always {} for them. Filling it in here is
  // what makes a block-persisted blob dirent show up in a listing at all
  // immediately after mount - it used to be silently dropped on the floor,
  // invisible until os/blob-store.js's localStorage/media-DB restore
  // separately reintroduced the same path moments later.
  Object.entries(obj.blobs || {}).forEach(([k, v]) => node.blobs.set(k, Object.assign({}, v)));
  Object.entries(obj.subdirs || {}).forEach(([k, v]) => node.subdirs.set(k, _vfsDesNode(v)));
  return node;
}

// The blob paths the mounted backend's block layer actually persisted, taken
// as a snapshot right after _vfsDesNode builds the live tree and before
// `seed` (or anything else) can run. A seeded wallpaper/home-media
// placeholder (os/fs-persist.js) writes straight into dir.blobs at a fixed
// path; if a real block-backed blob ever shares that path, the placeholder's
// write would silently erase the metadata this snapshot exists to preserve.
// os/blob-store.js's boot restore uses this list to know which paths blocks
// already answer for - fetching those from blocks (loadBlobsFromBlocks)
// rather than the localStorage/media-DB mirrors, and skipping those same
// paths in the mirrors' own restore passes. Blocks is the source of truth
// once a real backend has one, including a stale one: see os/vfs.js's
// readFailed handling in _vfsReadEntryForCommit, which deliberately leaves
// blocks holding OLD bytes rather than overwriting them with nothing - a
// mirror that clobbered this path on the next boot would erase that
// protection.
var _vfsBlockBlobEntries = [];
function vfsBlockBlobEntries() { return _vfsBlockBlobEntries.slice(); }

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
  // Snapshot before `seed` runs - see vfsBlockBlobEntries's own comment for
  // why order matters here.
  _vfsBlockBlobEntries = [];
  vfsWalkBlobs('', (dirName, name, blob) => {
    _vfsBlockBlobEntries.push({ dirName, name, size: (blob && blob.size) || 0, kind: blob && blob.kind, mime: blob && blob.mime });
  });
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
  if (!_vfsBackend || !_vfsPendingOps.length || _vfsDefragActive) return;
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
      // A remount while this was in flight means these numbers - and this
      // commit's own failedBlobs report - describe a filesystem that is no
      // longer mounted. Do not let them poison the new one, or its onError
      // handler: a stale "did not persist" toast about a backend nobody is
      // looking at any more would be actively misleading.
      if (_vfsBackend === backend) {
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
// The on-disk format, with no IO in it.
//
// Everything here operates on plain values and on an abstract store that the
// caller supplies, so the allocator, the bitmap and the fragmentation maths are
// testable in node with a Map behind them. os/storage-idb.js implements that
// store over IndexedDB. This is the same split phase 2 made between
// storage-local.js and storage-mem.js, and it is what keeps the risky logic out
// of the layer that needs a browser to run.
//
// NOTE ON THE IN-MEMORY TREE: this is a PERSISTENCE representation only.
// os/vfs.js keeps its Maps-and-Sets tree exactly as before. Inodes and dirents
// buy cheap renames and per-file writes at commit time; they are not what any
// read goes through. See the Non-goals section of the phase 4 design spec.

// 4 KB, matching the block size of the filesystems this is imitating. It is
// recorded in the superblock rather than read from here at each call site, so a
// future change is a format version bump rather than a code hunt.
const FS_BLOCK_SIZE = 4096;
const FS_FORMAT_VERSION = 1;

function fsMakeSuperblock(totalBlocks) {
  const count = Math.max(0, Math.trunc(Number(totalBlocks) || 0));
  return {
    version: FS_FORMAT_VERSION,
    // Ino 0 is never handed out, so 0 can mean "no inode" without ambiguity.
    nextIno: 1,
    blockSize: FS_BLOCK_SIZE,
    totalBlocks: count,
    // One bit per block, set when the block is in use. A Uint8Array rather than
    // an array of booleans because IndexedDB structured-clones typed arrays
    // directly, so this needs no encode step on the way in or out.
    freeBitmap: new Uint8Array(Math.ceil(count / 8)),
    migrated: false,
  };
}

function fsBitGet(bitmap, index) {
  return (bitmap[index >> 3] >> (index & 7)) & 1;
}

function fsBitSet(bitmap, index, value) {
  const byte = index >> 3;
  const mask = 1 << (index & 7);
  if (value) bitmap[byte] |= mask;
  else bitmap[byte] &= ~mask;
}

function fsCountFreeBlocks(sb) {
  let free = 0;
  for (let i = 0; i < sb.totalBlocks; i++) if (!fsBitGet(sb.freeBitmap, i)) free++;
  return free;
}

// Find the first free run of at least `count` blocks, or -1.
function _fsFindRun(sb, count) {
  let start = -1;
  let len = 0;
  for (let i = 0; i < sb.totalBlocks; i++) {
    if (fsBitGet(sb.freeBitmap, i)) { start = -1; len = 0; continue; }
    if (start < 0) start = i;
    len++;
    if (len >= count) return start;
  }
  return -1;
}

// Contiguous-first, scattered-fallback. Preferring a run is what keeps
// fragmentation low for the common case of writing a whole file at once, and
// the scattered fallback is what stops a partly-full disk refusing a write it
// has room for.
function fsAllocBlocks(sb, count) {
  const need = Math.max(0, Math.trunc(Number(count) || 0));
  if (!need) return [];

  const runStart = _fsFindRun(sb, need);
  if (runStart >= 0) {
    const out = [];
    for (let i = 0; i < need; i++) {
      out.push(runStart + i);
      fsBitSet(sb.freeBitmap, runStart + i, 1);
    }
    return out;
  }

  const out = [];
  for (let i = 0; i < sb.totalBlocks && out.length < need; i++) {
    if (fsBitGet(sb.freeBitmap, i)) continue;
    out.push(i);
    fsBitSet(sb.freeBitmap, i, 1);
  }
  if (out.length < need) {
    // Roll the partial allocation back before throwing. Without this a failed
    // write leaks every block it managed to take, so a user retrying a save on
    // a nearly-full disk would watch the disk shrink with each attempt.
    fsFreeBlocks(sb, out);
    throw VfsError('ENOSPC', 'no space for ' + need + ' blocks, ' + fsCountFreeBlocks(sb) + ' free');
  }
  return out;
}

function fsFreeBlocks(sb, indices) {
  (indices || []).forEach(i => {
    if (i >= 0 && i < sb.totalBlocks) fsBitSet(sb.freeBitmap, i, 0);
  });
}

// Fragmentation is measured PER FILE, not across the disk as a whole: a disk
// holding five contiguous files is not fragmented, it is just occupied. So the
// question is how many extra runs each file's blocks are broken into beyond the
// one run it would occupy if it were whole.
//
//   0 -> every file's blocks are contiguous
//   1 -> every block of every file is isolated
//
// Computed from the inodes rather than the bitmap because the bitmap alone
// cannot tell which blocks belong together.
function fsComputeFragmentation(inodes) {
  let totalBlocks = 0;
  let totalRuns = 0;
  let filesWithBlocks = 0;
  (inodes || []).forEach(inode => {
    const blocks = (inode && inode.blocks) || [];
    if (!blocks.length) return;
    filesWithBlocks++;
    totalBlocks += blocks.length;
    const sorted = blocks.slice().sort((a, b) => a - b);
    totalRuns++;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) totalRuns++;
    }
  });
  // An empty disk is not fragmented, and the denominator below would be 0.
  const maxExtraRuns = totalBlocks - filesWithBlocks;
  if (maxExtraRuns <= 0) return 0;
  return (totalRuns - filesWithBlocks) / maxExtraRuns;
}

// Plans a compaction: every file's blocks contiguous and in order, packed
// toward block 0, files in ascending ino order. Pure - it mutates neither the
// superblock nor the inodes, and returns an ordered list of moves for
// os/storage-idb.js's _moveBlock to apply one transaction at a time.
//
// A move is { ino, slot, from, to }, where slot is the index within that
// inode's blocks array. Every move is self-describing so that stopping after
// any prefix leaves a consistent disk - which is the whole crash-safety story,
// and is what test/fs-compaction.test.cjs checks over every prefix.
//
// THE ORDERING PROBLEM, which is the only hard part: the target for position t
// is usually occupied by a block that has not moved yet. The plan is a
// permutation and permutations have cycles. Breaking a cycle needs a spare
// slot, and the disk's own free space is the spare - relocate the occupant
// into a free block, then complete the intended move. One hole is enough to
// realise any permutation (the fifteen-puzzle argument), at a cost of up to
// two moves per placed block.
//
// Targets are processed in ascending order, which makes each placement
// permanent: position t is written once and never revisited. That is what
// guarantees termination even when a spare block sits inside the target range.
function fsPlanCompaction(inodeEntries, sb) {
  const moves = [];

  // Where each block currently lives, both directions.
  const ownerOf = new Map();          // blockIdx -> 'ino:slot'
  const locOf = new Map();            // 'ino:slot' -> blockIdx
  const desired = [];                 // target blockIdx -> 'ino:slot'

  const sorted = (inodeEntries || [])
    .filter(([, inode]) => inode && (inode.blocks || []).length)
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  sorted.forEach(([ino, inode]) => {
    inode.blocks.forEach((blockIdx, slot) => {
      const tag = String(ino) + ':' + slot;
      ownerOf.set(blockIdx, tag);
      locOf.set(tag, blockIdx);
      desired.push(tag);
    });
  });

  // A Set, not an array, and emit() maintains BOTH directions of it. An
  // earlier version only pushed the vacated block and never removed the
  // destination, so a cycle break - emit(occupant, t, spare) followed by
  // emit(want, loc, t) - left t sitting in the free list while it was live
  // again. A later takeFree() could then hand out t as a spare and overwrite
  // a file's block. Silent data loss, and the kind a hand-picked test fixture
  // can miss entirely.
  const free = new Set();
  for (let i = sb.totalBlocks - 1; i >= 0; i--) {
    if (!fsBitGet(sb.freeBitmap, i) && !ownerOf.has(i)) free.add(i);
  }

  // Prefers the highest free block: it is furthest from the region being
  // packed, so it is least likely to be wanted as a target soon, which keeps
  // the move count down. Linear per call, but called at most once per cycle
  // break, and correctness does not depend on which free block is chosen.
  function takeFree() {
    let best = -1;
    free.forEach(idx => { if (idx > best) best = idx; });
    if (best >= 0) free.delete(best);
    return best;
  }

  function emit(tag, from, to) {
    const colon = tag.lastIndexOf(':');
    moves.push({
      ino: Number(tag.slice(0, colon)),
      slot: Number(tag.slice(colon + 1)),
      from,
      to,
    });
    ownerOf.delete(from);
    ownerOf.set(to, tag);
    locOf.set(tag, to);
    free.delete(to);
    free.add(from);
  }

  for (let t = 0; t < desired.length; t++) {
    const want = desired[t];
    if (ownerOf.get(t) === want) continue;      // already in place

    if (ownerOf.has(t)) {
      // Someone else is sitting on this target. Park them in a free block.
      const spare = takeFree();
      if (spare < 0) {
        throw VfsError('ENOSPC', 'compaction needs at least one free block to break a cycle');
      }
      emit(ownerOf.get(t), t, spare);
    }
    emit(want, locOf.get(want), t);
  }

  return moves;
}

// ── Records and tree reconstruction ───────────────────────────────

const FS_STORE_SUPERBLOCK = 'superblock';
const FS_STORE_INODES = 'inodes';
const FS_STORE_DIRENTS = 'dirents';
const FS_STORE_BLOCKS = 'blocks';

// The abstract store. Everything above the IndexedDB adapter talks to this
// shape, which is why the whole format is testable with Maps. Async on every
// method because the IndexedDB implementation has no choice; the in-memory one
// resolves immediately.
function fsMakeStore() {
  const stores = new Map();
  function of(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }
  return {
    async get(name, key) { return of(name).get(String(key)); },
    async put(name, key, value) { of(name).set(String(key), value); },
    async del(name, key) { of(name).delete(String(key)); },
    async scan(name) { return [...of(name).entries()]; },
    async clear(name) { of(name).clear(); },
  };
}

// TextEncoder/TextDecoder exist in browsers and in node, and the terminal
// already relies on TextEncoder for WC's byte count, so this adds no new
// platform assumption.
function fsEncodeText(str) {
  return new TextEncoder().encode(String(str == null ? '' : str));
}

function fsDecodeText(bytes) {
  return new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []));
}

function _fsDirentKey(parentIno, name) {
  return String(parentIno) + '/' + name;
}

// The inverse. A name may itself contain '/', so this splits on the FIRST
// separator only - the parent ino cannot contain one.
//
// This exists because the encoding was written out by hand in four places and
// decoded by hand in two more, across three files. That is a format spread
// across the codebase rather than owned by it, and changing it would have
// meant finding every copy. os/storage-idb.js is the adapter; the key shape is
// the pure core's business.
function _fsDirentSplit(key) {
  const str = String(key);
  const slash = str.indexOf('/');
  return { parent: Number(str.slice(0, slash)), name: str.slice(slash + 1) };
}

// Walks a backslash-joined directory path to its ino, creating any component
// that does not exist yet. Distinct from _fsResolveDirIno, which returns -1
// rather than creating - both callers here genuinely want creation: a commit
// where a mkdir and a write inside it land in the same batch, and migration
// importing a blob whose directory the tree snapshot did not name.
//
// `cache` is optional and maps full path -> ino. os/storage-idb.js keeps one
// across a session so a deep path is not re-walked on every op; migration
// passes none, since it walks each path once.
async function fsResolveOrCreateDirIno(store, sb, dirName, cache) {
  const path = String(dirName || '');
  if (!path) return 0;
  if (cache && cache.has(path)) return cache.get(path);
  let parent = 0;
  let sofar = '';
  for (const part of path.split('\\')) {
    if (!part) continue;
    sofar = sofar ? sofar + '\\' + part : part;
    if (cache && cache.has(sofar)) { parent = cache.get(sofar); continue; }
    let ino = await store.get(FS_STORE_DIRENTS, _fsDirentKey(parent, part));
    if (ino === undefined) ino = await fsWriteEntry(store, sb, parent, part, { type: 'dir' });
    if (cache) cache.set(sofar, ino);
    parent = ino;
  }
  return parent;
}

async function _fsPutSuperblock(store, sb) {
  await store.put(FS_STORE_SUPERBLOCK, 'sb', sb);
}

// Splits bytes across freshly allocated blocks. The tail block is written
// short rather than padded: the inode's `size` is what bounds a read, so
// padding would only cost space and prove nothing.
async function _fsWriteBlocks(store, sb, bytes) {
  const count = Math.ceil(bytes.length / sb.blockSize);
  const indices = fsAllocBlocks(sb, count);
  for (let i = 0; i < indices.length; i++) {
    const start = i * sb.blockSize;
    await store.put(FS_STORE_BLOCKS, indices[i], bytes.slice(start, start + sb.blockSize));
  }
  return indices;
}

async function _fsReleaseInode(store, sb, ino) {
  const inode = await store.get(FS_STORE_INODES, ino);
  if (!inode) return;
  for (const idx of inode.blocks || []) await store.del(FS_STORE_BLOCKS, idx);
  fsFreeBlocks(sb, inode.blocks || []);
}

async function fsWriteEntry(store, sb, parentIno, name, entry) {
  entry = entry || {};
  const key = _fsDirentKey(parentIno, name);
  const existingIno = await store.get(FS_STORE_DIRENTS, key);
  // Reuse the inode number on a rewrite so anything holding it stays valid,
  // but release the old blocks first or a shrinking file leaks the difference.
  if (existingIno !== undefined) await _fsReleaseInode(store, sb, existingIno);

  const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(0);
  const blocks = entry.type === 'dir' ? [] : await _fsWriteBlocks(store, sb, bytes);
  const ino = existingIno !== undefined ? existingIno : sb.nextIno++;
  const now = Date.now();
  const prior = existingIno !== undefined ? await store.get(FS_STORE_INODES, ino) : null;

  await store.put(FS_STORE_INODES, ino, {
    type: entry.type || 'file',
    size: entry.type === 'dir' ? 0 : bytes.length,
    ctime: prior ? prior.ctime : now,
    mtime: now,
    blocks,
    meta: entry.meta || null,
  });
  await store.put(FS_STORE_DIRENTS, key, ino);
  await _fsPutSuperblock(store, sb);
  return ino;
}

async function fsReadEntryBytes(store, sb, ino) {
  const inode = await store.get(FS_STORE_INODES, ino);
  if (!inode) return new Uint8Array(0);
  const out = new Uint8Array(inode.size);
  let offset = 0;
  for (const idx of inode.blocks || []) {
    const block = await store.get(FS_STORE_BLOCKS, idx);
    if (!block) continue;
    const chunk = block instanceof Uint8Array ? block : new Uint8Array(block);
    const room = Math.min(chunk.length, out.length - offset);
    out.set(chunk.subarray(0, room), offset);
    offset += room;
  }
  return out;
}

// Resolves a directory name to its ino by walking dirents, one path
// component at a time - the same backslash-joined convention os/storage-idb.js's
// inoForDir uses, and the same dirent-key shape (_fsDirentKey) fsWriteEntry
// and fsDeleteEntry both write through. Deliberately NOT reusing inoForDir
// itself: that function creates a missing directory as it walks, which is
// correct for a write (a mkdir and a write into it can land in the same
// commit) and wrong for a read - a lookup must never mutate the tree as a
// side effect of failing to find something. Returns -1 for a component that
// does not resolve, rather than throwing, so a caller can tell "not found"
// from every other outcome with one comparison.
async function _fsResolveDirIno(store, dirName) {
  const path = String(dirName || '');
  if (!path) return 0;
  let parent = 0;
  for (const part of path.split('\\')) {
    if (!part) continue;
    const ino = await store.get(FS_STORE_DIRENTS, _fsDirentKey(parent, part));
    if (ino === undefined) return -1;
    parent = ino;
  }
  return parent;
}

// The read half of blob persistence (Task 9a). Blob bytes go IN through
// fsWriteEntry (called from os/storage-idb.js's commit(), entry.kind ===
// 'blob'), but until this nothing could bring them back OUT: fsReadTree
// returns a blob dirent as metadata only (see `build` below), and
// fsReadEntryBytes was called from exactly one place, for text files.
//
// Returns null, not an empty Uint8Array, for anything that isn't a readable
// blob at that exact path: a directory component that doesn't exist, a name
// that doesn't exist in a directory that does, AND a name that exists but is
// a file or dir rather than a blob. That last case is deliberate and is not
// the same kind of "missing" as the first two - the entry is right there -
// but this function exists specifically to serve blob bytes, and a same-named
// text file's UTF-8-encoded bytes are not that; handing them back would look
// like a successful blob read to a caller that never asked to distinguish the
// two. An empty Uint8Array is reserved for what it already means elsewhere in
// this file: a real, zero-byte blob.
async function fsReadBlobBytesAtPath(store, sb, dirName, name) {
  const parent = await _fsResolveDirIno(store, dirName);
  if (parent < 0) return null;
  const ino = await store.get(FS_STORE_DIRENTS, _fsDirentKey(parent, name));
  if (ino === undefined) return null;
  const inode = await store.get(FS_STORE_INODES, ino);
  if (!inode || inode.type !== 'blob') return null;
  return await fsReadEntryBytes(store, sb, ino);
}

// Every descendant of a deleted directory needs its blocks freed and its
// inode/dirent records removed, or they sit in the store unreachable from
// root forever: fsReadTree only ever walks down from root via dirent parent
// links, so an orphan never shows up again, but its bitmap bits stay set and
// free space quietly shrinks every session. One scan of the whole dirent
// store, grouped by parent, rather than one scan per recursion level - a
// scan per level is quadratic on a deep tree, and boot already pays for a
// full scan in fsReadTree so this is no new cost class.
async function _fsCollectSubtree(store, rootIno) {
  const dirents = await store.scan(FS_STORE_DIRENTS);
  const byParent = new Map();
  dirents.forEach(([key, ino]) => {
    const { parent } = _fsDirentSplit(key);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push({ key, ino });
  });

  // Depth is user-controlled (nested folders can go arbitrarily deep), so
  // this is an explicit worklist rather than a recursive call that could
  // blow the stack on a deeply nested tree.
  const out = [];
  const work = [rootIno];
  while (work.length) {
    const ino = work.pop();
    for (const child of byParent.get(ino) || []) {
      out.push(child);
      work.push(child.ino);
    }
  }
  return out;
}

async function fsDeleteEntry(store, sb, parentIno, name) {
  const key = _fsDirentKey(parentIno, name);
  const ino = await store.get(FS_STORE_DIRENTS, key);
  if (ino === undefined) return false;

  const inode = await store.get(FS_STORE_INODES, ino);
  if (inode && inode.type === 'dir') {
    const descendants = await _fsCollectSubtree(store, ino);
    for (const { key: dKey, ino: dIno } of descendants) {
      await _fsReleaseInode(store, sb, dIno);
      await store.del(FS_STORE_INODES, dIno);
      await store.del(FS_STORE_DIRENTS, dKey);
    }
  }

  await _fsReleaseInode(store, sb, ino);
  await store.del(FS_STORE_INODES, ino);
  await store.del(FS_STORE_DIRENTS, key);
  await _fsPutSuperblock(store, sb);
  return true;
}

// The cheap operation the whole dirent split exists for: one key moves, the
// inode and every block stay exactly where they are.
async function fsRenameEntry(store, parentIno, name, newParentIno, newName) {
  const from = _fsDirentKey(parentIno, name);
  const ino = await store.get(FS_STORE_DIRENTS, from);
  if (ino === undefined) return false;
  await store.put(FS_STORE_DIRENTS, _fsDirentKey(newParentIno, newName), ino);
  await store.del(FS_STORE_DIRENTS, from);
  return true;
}

// Rebuild the shape vfsMount's backend.load() must return. One full scan of
// dirents, which is why no parentIno index is maintained: boot reads all of
// them anyway and nothing else ever queries them.
// True when a node holds nothing at all. os/storage-idb.js's load() uses this
// on the root to tell "this database has never been written" from "this drive
// was deliberately emptied", which decides whether the VFS seeds a default
// tree over the top.
function _fsTreeIsEmpty(node) {
  if (!node) return true;
  return !(node.dirs || []).length
    && !Object.keys(node.files || {}).length
    && !Object.keys(node.blobs || {}).length
    && !Object.keys(node.subdirs || {}).length;
}

async function fsReadTree(store) {
  const sb = await store.get(FS_STORE_SUPERBLOCK, 'sb');
  const dirents = await store.scan(FS_STORE_DIRENTS);
  const byParent = new Map();
  dirents.forEach(([key, ino]) => {
    const { parent, name } = _fsDirentSplit(key);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push({ name, ino });
  });

  async function build(parentIno) {
    const node = { dirs: [], files: {}, blobs: {}, subdirs: {} };
    for (const { name, ino } of (byParent.get(parentIno) || [])) {
      const inode = await store.get(FS_STORE_INODES, ino);
      if (!inode) continue;
      if (inode.type === 'dir') {
        node.dirs.push(name);
        node.subdirs[name] = await build(ino);
      } else if (inode.type === 'blob') {
        node.blobs[name] = Object.assign({ size: inode.size }, inode.meta || {});
      } else {
        node.files[name] = fsDecodeText(await fsReadEntryBytes(store, sb, ino));
      }
    }
    return node;
  }
  return await build(0);
}
// IndexedDB backend. Thin on purpose: it opens the database, exposes the
// abstract store os/fs-format.js expects, and translates the VFS's ops into
// format calls. Every decision about the format itself lives in fs-format,
// which is why that file is testable with a Map and this one needs a browser.
//
// If this file grows past roughly a hundred lines, logic has leaked out of the
// pure core and belongs back in it.
const FS_IDB_NAME = 'sleepOS-fs';
const FS_IDB_VERSION = 1;
// 4096 blocks x 4 KB = 16 MB. Deliberately smaller than the 32 MB this
// shipped with: fragmentation is a real measurement now, and a drive nothing
// ever fills is a drive that never fragments, which makes DEFRAG a utility
// with nothing to do. 16 MB is still 3.2x the 5 MB localStorage drive it
// replaced, so a single large upload still fits and ENOSPC stays rare.
//
// Only ever read when creating a superblock that does not exist yet. Every
// other code path reads sb.totalBlocks, so an existing profile keeps whatever
// size it was created with.
const FS_IDB_TOTAL_BLOCKS = 4096;

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
  // True only for the session that actually created the superblock. This is
  // half of load()'s seed-or-not decision; the tree being empty is the other
  // half, and neither is sufficient alone - see load() below.
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
    return await fsResolveOrCreateDirIno(activeStore, sb, dirName, dirInos);
  }

  async function rebuildDirInos() {
    dirInos = new Map();
    const dirents = await store.scan(FS_STORE_DIRENTS);
    const rows = dirents.map(([key, ino]) => Object.assign(_fsDirentSplit(key), { ino }));
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
      await rebuildDirInos();
      const tree = await fsReadTree(store);
      // Returning null asks the VFS to seed the default tree, and getting the
      // condition for it wrong is destructive in both directions. It takes
      // BOTH halves, and an earlier version of this used only the first:
      //
      //   freshlyCreated alone is wrong. Migration imports into the very
      //   session that creates the superblock - fsChooseBackend calls
      //   _store() to force the connection open, THEN migrates, THEN mounts
      //   this same instance - so on the one boot that matters, a
      //   freshly-created database already holds the user's entire
      //   filesystem. Keying off this flag alone threw that tree away and
      //   showed the seed tree instead, on the first boot after upgrading.
      //   Their files were still in the database and came back on the next
      //   reload, which is the only reason this was recoverable at all.
      //
      //   An empty tree alone is wrong too. A visitor who deleted everything
      //   has a real empty drive, and re-seeding it would resurrect files
      //   they removed on purpose.
      //
      // Together they mean what is actually being asked: nothing has ever
      // been written here, so there is no filesystem to lose by seeding one.
      if (freshlyCreated && _fsTreeIsEmpty(tree)) return null;
      return tree;
    },

    async commit({ ops, readEntry }) {
      await ensure();
      const list = ops || [];
      if (!list.length) return;
      // A blob op whose bytes could not be read (_vfsReadEntryForCommit's
      // readFailed) is collected here rather than thrown: the whole point is
      // that ONE unreadable object URL must not roll back every other op in
      // the same transaction. Handed back to vfsFlush, which reports each one
      // through onError - the same "did not persist" channel any other save
      // failure uses.
      const failedBlobs = [];

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
            if (entry.readFailed) {
              // Do not write anything for this op: for a rewrite, that
              // leaves the existing inode and its blocks exactly as they
              // were; for a brand-new path, it leaves no dirent at all
              // rather than a phantom zero-byte one. Either way this is
              // strictly better than persisting `readFailed`'s unknown bytes
              // as if they were the file's real, empty content.
              failedBlobs.push({ dirName: op.dirName, name: op.name });
              continue;
            }
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
      return { failedBlobs };
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

    // Like _readInodes, but keeps the ino. fsPlanCompaction needs it to say
    // which inode a move belongs to; _readInodes deliberately keeps its old
    // shape because fsRefreshFragmentation depends on it and would go on
    // "working" against the wrong data if it silently changed.
    async _readInodeEntries() {
      await ensure();
      return (await store.scan(FS_STORE_INODES)).map(([key, inode]) => [Number(key), inode]);
    },

    // Applies ONE move from fsPlanCompaction, in one transaction. That
    // boundary is the entire crash-safety argument: IndexedDB applies a
    // transaction wholly or not at all, so a crash leaves each move either
    // fully applied or absent, and either way every inode points at blocks
    // that exist and hold that file's bytes. The disk ends up consistent and
    // merely partly compacted, never corrupt. The worst residue is a leaked
    // block, which the allocator already tolerates.
    //
    // Nothing is persisted about the run itself. The target layout is a pure
    // function of the current disk, so an interrupted run needs no saved
    // state - the next one replans from wherever the disk got to. That is why
    // Stop, crash recovery and resume are one mechanism rather than three.
    async _moveBlock(move) {
      await ensure();
      await _runInWriteTransaction(async (txStore, txSb) => {
        const inode = await txStore.get(FS_STORE_INODES, move.ino);
        if (!inode || (inode.blocks || [])[move.slot] !== move.from) {
          // The disk is not where the plan thought it was. Refusing is right:
          // writing anyway would move a block on behalf of an inode that no
          // longer claims it.
          throw VfsError('EINVAL', 'stale compaction move for inode ' + move.ino);
        }
        // The symmetric half of the staleness check above. The planner is
        // responsible for never targeting a live block, and this is what makes
        // a planner bug loud instead of silent: without it, a bad `to` quietly
        // overwrites another inode's data and the damage is only visible later,
        // as a file that reads back as garbage.
        if (fsBitGet(txSb.freeBitmap, move.to)) {
          throw VfsError('EINVAL', 'compaction move would overwrite live block ' + move.to);
        }
        const bytes = await txStore.get(FS_STORE_BLOCKS, move.from);
        await txStore.put(FS_STORE_BLOCKS, move.to, bytes);
        inode.blocks[move.slot] = move.to;
        await txStore.put(FS_STORE_INODES, move.ino, inode);
        fsBitSet(txSb.freeBitmap, move.to, 1);
        fsBitSet(txSb.freeBitmap, move.from, 0);
        await txStore.del(FS_STORE_BLOCKS, move.from);
        await txStore.put(FS_STORE_SUPERBLOCK, 'sb', txSb);
      });
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

  // Collected before the transaction opens, not inside it. Reading a Blob's
  // bytes and reading the legacy media database are both awaits that are not
  // requests on our own transaction, and either would let it auto-commit
  // underneath the import. See _fsCollectLegacyBlobs.
  const { blobs, skipped: blobsSkipped } = await _fsCollectLegacyBlobs();

  try {
    // The import and marking `migrated` both happen inside this one
    // transaction. Splitting them - import first, mark migrated as a
    // separate write afterward - would reopen exactly the window this whole
    // design exists to close: a tab closing in the gap between them leaves a
    // complete, correctly-written filesystem sitting there with `migrated`
    // still false, so the next boot would re-run the entire import over it
    // rather than simply finding it already done.
    //
    // The blobs go in the same transaction for the same reason: a visitor's
    // media and their tree are one filesystem, and half of it appearing is
    // the state rule 2 exists to prevent.
    await backend._runInWriteTransaction(async (store, txSb) => {
      await _fsImportNode(store, txSb, tree, 0, options.onProgress);
      await _fsImportBlobs(store, txSb, blobs, options.onProgress);
      txSb.migrated = true;
      await store.put(FS_STORE_SUPERBLOCK, 'sb', txSb);
    });
    return { migrated: true, reason: 'ok', blobsImported: blobs.length, blobsSkipped };
  } catch (err) {
    // Rule 2. Destroy the partial database before anything can read it.
    //
    // Close THIS backend's own connection first. deleteDatabase() defers
    // behind onblocked for as long as any connection to the database stays
    // open - including ours - and without this the delete below would never
    // resolve at all rather than fail: real IndexedDB does not time out or
    // reject a blocked delete on its own, it just waits.
    //
    // Closing our connection is not a guarantee the delete will succeed:
    // IndexedDB is per-origin, so another tab can hold a connection open
    // regardless of anything this function does. `databaseDeleted` records
    // which actually happened, because the two outcomes are materially
    // different - not just "did the delete API call resolve" bookkeeping.
    // A successful delete means the partial database is really gone; a
    // blocked one means it is still sitting there, unreachable through
    // `migrated` (still false, so the next boot's retry will converge over
    // it) but not actually destroyed. A caller that cannot tell those apart
    // would report a clean abort when a partial database is still on disk.
    let databaseDeleted = true;
    try {
      await backend._close();
      await fsIdbDeleteDatabase();
    } catch (e) {
      databaseDeleted = false;
    }
    return {
      migrated: false,
      reason: 'failed',
      databaseDeleted,
      error: (err && err.message) || String(err),
    };
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
// onProgress is called but never awaited: this entire walk runs inside one
// IndexedDB transaction, and it is the AWAITING, not the yielding an async
// callback would do on its own, that would put non-IDB work on the critical
// path and risk the transaction going inactive - the same reason
// commit()'s readEntry resolution had to move into its own phase before any
// transaction opens. Because this call is never awaited, an async
// onProgress does not break anything; it is simply fire-and-forgotten, its
// own promise left to settle on its own time, off this transaction's path
// entirely.
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

// ── Legacy blob import ────────────────────────────────────────────
//
// The tree snapshot under FS_MIGRATE_SOURCE_KEY contains NO blobs at all -
// vfsSerializeTree omits them deliberately, because a blob's in-memory record
// is an object URL and persisting one would produce a dead string. Before
// phase 4 the bytes lived in two other places instead, and tasks 9e/9f deleted
// the code that read them. So importing only the snapshot silently dropped
// every image, video and sound a visitor had ever uploaded - the tree would
// come across intact and the media would simply be gone.
//
// These two constants are the only remaining description of that old format,
// and this is the right place for them: they are legacy knowledge used once,
// by the importer, and nothing else in the OS should learn them again.
const FS_MIGRATE_BLOB_PREFIX = 'sleepOS-blob:';
const FS_MIGRATE_MEDIA_DB = 'sleepOS-media';
const FS_MIGRATE_MEDIA_STORE = 'blobs';

function _fsSplitLegacyBlobPath(path) {
  const clean = String(path || '').replace(/\//g, '\\').replace(/^\\+|\\+$/g, '');
  const lastSlash = clean.lastIndexOf('\\');
  return {
    dirPath: lastSlash === -1 ? '' : clean.slice(0, lastSlash),
    name: lastSlash === -1 ? clean : clean.slice(lastSlash + 1),
  };
}

function _fsB64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Reads the legacy media IndexedDB. Resolves to [] rather than rejecting for
// every failure mode including "the database does not exist", which is the
// normal case for a visitor who never uploaded anything.
async function _fsReadLegacyMediaRows() {
  if (!fsIdbAvailable()) return [];
  return new Promise(resolve => {
    let req;
    try { req = indexedDB.open(FS_MIGRATE_MEDIA_DB, 1); } catch (e) { return resolve([]); }
    // Opening at version 1 CREATES the database if it is absent, which would
    // then have no object store. Handled by the contains() check below rather
    // than by trying to avoid the creation: there is no way to ask IndexedDB
    // "does this exist" that is available everywhere.
    req.onupgradeneeded = () => {
      try { req.transaction.abort(); } catch (e) {}
    };
    req.onerror = req.onblocked = () => resolve([]);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FS_MIGRATE_MEDIA_STORE)) {
        try { db.close(); } catch (e) {}
        return resolve([]);
      }
      try {
        const tx = db.transaction(FS_MIGRATE_MEDIA_STORE, 'readonly');
        const all = tx.objectStore(FS_MIGRATE_MEDIA_STORE).getAll();
        all.onsuccess = () => { try { db.close(); } catch (e) {} resolve(all.result || []); };
        all.onerror = () => { try { db.close(); } catch (e) {} resolve([]); };
      } catch (e) {
        try { db.close(); } catch (e2) {}
        resolve([]);
      }
    };
  });
}

// Every legacy blob, keyed by path, with its bytes already resolved. Runs
// BEFORE the import transaction opens, and must: reading a Blob's bytes and
// reading another IndexedDB database are both async work that is not a request
// on the migration's own transaction, and awaiting either would let that
// transaction auto-commit underneath us. This is the same shape commit()
// (os/storage-idb.js) uses for the same reason.
//
// Best-effort per entry. One unreadable row must not cost a visitor the rest
// of their media, and it must not cost them the text tree either - the count
// of what could not be read comes back in the migration result instead, and
// the legacy keys stay on disk for a release, so a later fix can retry.
async function _fsCollectLegacyBlobs() {
  const found = new Map();   // 'dir\\name' -> { dirPath, name, kind, size, mime, bytes }
  let skipped = 0;

  // localStorage first, so the media DB can overwrite it: the base64 copy was
  // only ever written for files under 3 MB, so where both exist the media row
  // is the one guaranteed to hold the whole file.
  let keys = [];
  try { keys = Object.keys(localStorage).filter(k => k.startsWith(FS_MIGRATE_BLOB_PREFIX)); } catch (e) { keys = []; }
  for (const key of keys) {
    try {
      const { kind, size, mime, b64 } = JSON.parse(localStorage.getItem(key));
      const { dirPath, name } = _fsSplitLegacyBlobPath(key.slice(FS_MIGRATE_BLOB_PREFIX.length));
      if (!name) continue;
      found.set(dirPath + '\\' + name, { dirPath, name, kind, size, mime, bytes: _fsB64ToBytes(b64) });
    } catch (e) { skipped++; }
  }

  for (const row of await _fsReadLegacyMediaRows()) {
    try {
      const { dirPath, name } = _fsSplitLegacyBlobPath(row && row.path);
      if (!name || !row.blob) continue;
      const bytes = new Uint8Array(await row.blob.arrayBuffer());
      found.set(dirPath + '\\' + name, { dirPath, name, kind: row.kind, size: row.size, mime: row.mime, bytes });
    } catch (e) { skipped++; }
  }

  return { blobs: [...found.values()], skipped };
}

async function _fsImportBlobs(store, sb, blobs, onProgress) {
  for (const blob of blobs) {
    // Creates the directory if the tree snapshot did not name it: losing the
    // file would be the worse failure, and an empty directory is harmless.
    const parentIno = await fsResolveOrCreateDirIno(store, sb, blob.dirPath);
    await fsWriteEntry(store, sb, parentIno, blob.name, {
      type: 'blob',
      bytes: blob.bytes,
      // Matches what os/storage-idb.js's commit() writes for a blob, and what
      // fsReadTree reads back out as the tree's blob record.
      meta: { kind: blob.kind, mime: blob.mime },
    });
    if (onProgress) onProgress(blob.name);
  }
}
// The kernel owns the process table and the filesystem. Processes run in Workers
// and never touch storage; every path they name arrives here as a syscall. That
// is what lets phase 4 swap the storage backend without a process noticing.
//
// Two kinds of process share one table. System processes are the built-in apps
// on the main thread: real pids, real lifetimes, and `kill` closes the window,
// which genuinely ends them. User processes are spawned scripts in Workers:
// isolated, and killable against their will. This mirrors the distinction a Unix
// kernel makes between kernel threads and user processes.
var _kernelProcs = new Map();     // pid -> entry
var _kernelByWinId = new Map();   // winId -> pid
var _kernelNextPid = 1;
var _kernelWaiters = new Map();   // pid -> [resolve]

// Per-pid figures reported by workers. Absent means "not measured", which is
// what SYSMON renders as a dash - and after this phase a dash has one precise
// meaning: no measurable execution context.
var _kernelMetrics = new Map();

function kernelMetricsFor(pid) {
  const m = _kernelMetrics.get(pid);
  if (!m) return { cpu: null, mem: null, memUnit: null };
  return { cpu: m.cpu, mem: m.mem, memUnit: 'bytes' };
}

function kernelRecordMetrics(pid, msg) {
  const prev = _kernelMetrics.get(pid) || { lastBusyMs: 0, lastWallMs: 0 };
  const dBusy = Math.max(0, msg.busyMs - prev.lastBusyMs);
  const dWall = Math.max(0, msg.wallMs - prev.lastWallMs);
  _kernelMetrics.set(pid, {
    lastBusyMs: msg.busyMs,
    lastWallMs: msg.wallMs,
    // Share of one core since the previous heartbeat, not since spawn: a
    // script that looped hard then went idle must stop reporting busy.
    cpu: dWall > 0 ? Math.min(100, (dBusy / dWall) * 100) : 0,
    mem: msg.memBytes == null ? null : msg.memBytes,
  });
}

const KERNEL_PID = 1;

// Pids 2 through 1333 (and the generated 500 + i*13 series) belong to the daemon
// story's fictional process list in os/daemon.js - soul_svc.exe, mirror_watch.exe,
// and the rest, including pid 512, which is scripted dialogue ("It restarts pid
// 512. It is not pid 512."). Those are narrative constants and must never move.
// Real allocation used to land in 2000-7999 for the same reason, back when
// pidFromId hashed window ids into that range; this restores that floor so a
// real window can never again collide with a scripted pid. Lowering this number
// does not just look untidy - it breaks a story beat.
const KERNEL_FIRST_USER_PID = 2000;

// The machine's identity, and the root of the environment tree. This used to
// be DEFAULT_SHELL_VARS inside apps/terminal.js's openTerminal closure, which
// meant the OS's own name and PATH lived inside one window's local scope and
// no other process could see them. Every process inherits from its parent and
// every chain ends here, at pid 1.
//
// PATH is read by programResolve (os/programs.js). It is no longer decorative:
// changing it changes what the terminal can find.
const KERNEL_DEFAULT_ENV = {
  COMPUTERNAME: 'SOMA-686',
  USERNAME: 'VISITOR',
  OS: 'sleepOS 0.9b2',
  SOUL_INTEGRITY: '87',
  DAEMON_COUNT: '7',
  DAEMON_KNOWN: '4',
  TEMPORAL_DRIFT: '+/-2.3yr',
  VOID_PRESSURE: '12',
  OBSERVER_COUNT: '[classified]',
  PATH: 'C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]',
};

// A copy every time. Handing out the shared table would let one process's SET
// rewrite the defaults every later process inherits.
//
// Object.create(null), not {}: scriptResolveText (os/script/interp.js)
// expands `$name` as `vars[key] ?? ''`, which is a prototype-reachable
// lookup. An ordinary object leaks `constructor`, `toString` and every other
// Object.prototype member into the variable namespace ($constructor prints
// "function Object() { [native code] }"), and it also makes `__proto__`
// unassignable - `SET __proto__=hello` silently hits Object.prototype's
// `__proto__` setter instead of creating a variable. os/worker/host.js
// rebuilds the environment the same way for exactly this reason, and
// os/script/interp.js:533 falls back to `Object.create(null)` when no vars
// are supplied at all - this keeps the process table's own default in step
// with that fallback.
function kernelDefaultEnv() {
  return Object.assign(Object.create(null), KERNEL_DEFAULT_ENV);
}

// Shallow copy of a flat string map, which is what exec does: a child gets the
// parent's environment as it stood at spawn, and can never write back into it.
// Falls back to the kernel's own environment when the parent is gone or was
// never given - an orphan gets the machine defaults rather than nothing.
// Object.create(null) here too, for the same reason as kernelDefaultEnv above -
// a plain {} would reintroduce the prototype-pollution hole on every child a
// process spawns, not just on the machine defaults.
function kernelInheritEnv(parentPid) {
  const parent = _kernelProcs.get(parentPid);
  if (parent && parent.env) return Object.assign(Object.create(null), parent.env);
  const root = _kernelProcs.get(KERNEL_PID);
  return root && root.env ? Object.assign(Object.create(null), root.env) : kernelDefaultEnv();
}

function kernelInit() {
  _kernelProcs = new Map();
  _kernelByWinId = new Map();
  _kernelWaiters = new Map();
  _kernelNextPid = 1;
  const pid = _kernelAllocPid();
  _kernelProcs.set(pid, {
    pid, name: 'kernel', kind: 'system', state: 'running', parentPid: 0,
    cwd: '', env: kernelDefaultEnv(), worker: null, winId: null, exitCode: null, startedAt: Date.now(),
  });
  _kernelNextPid = KERNEL_FIRST_USER_PID;
}

// Monotonic and never reused within a session. Reuse would make a stale pid in a
// terminal scrollback address a different process, which is exactly the kind of
// lie this phase exists to remove.
function _kernelAllocPid() { return _kernelNextPid++; }

function kernelRegisterSystem(winId, name) {
  const existing = _kernelByWinId.get(winId);
  if (existing) return existing;
  const pid = _kernelAllocPid();
  _kernelProcs.set(pid, {
    pid, name, kind: 'system', state: 'running', parentPid: KERNEL_PID,
    cwd: '', env: kernelInheritEnv(KERNEL_PID), worker: null, winId, exitCode: null, startedAt: Date.now(),
  });
  _kernelByWinId.set(winId, pid);
  return pid;
}

function kernelDeregisterSystem(winId) {
  const pid = _kernelByWinId.get(winId);
  if (!pid) return;
  _kernelByWinId.delete(winId);
  kernelExit(pid, 0);
}

function kernelGetProcess(pid) { return _kernelProcs.get(pid) || null; }

// The terminal knows its own winId but needs its pid to parent the processes
// it spawns.
function kernelPidForWin(winId) { return _kernelByWinId.get(winId) || null; }

function kernelListProcesses() {
  return [..._kernelProcs.values()].sort((a, b) => a.pid - b.pid);
}

function kernelSignal(pid, sig) {
  const proc = _kernelProcs.get(pid);
  if (!proc || proc.state !== 'running') return false;
  if (proc.kind === 'system') {
    // The kernel itself (pid 1) is a system-kind entry with no winId, so it
    // used to fall through this branch and report success while closing
    // nothing - a lie. Refuse instead of pretending: the kernel is not
    // killable, and the caller can tell the difference now.
    if (!proc.winId || typeof closeWin !== 'function') return false;
    closeWin(proc.winId);
    return true;
  }
  if (sig === 'SIGKILL') {
    // kernelExit terminates proc.worker itself now (see below) - do not repeat
    // it here, or the "who is responsible for cleanup" story splits in two.
    kernelExit(pid, 137);
    return true;
  }
  // SIGTERM is a request. The host loop checks it between instructions, so a
  // process can finish what it is doing and exit cleanly - or ignore it.
  if (proc.worker) proc.worker.postMessage({ type: 'signal', sig: 'SIGTERM' });
  return true;
}

function kernelExit(pid, code) {
  const proc = _kernelProcs.get(pid);
  if (!proc || proc.state === 'zombie') return;
  proc.state = 'zombie';
  proc.exitCode = code;
  // A dedicated Worker outlives the return of its message handler - it is not
  // reclaimed just because the process table entry is gone. Every exit path
  // (normal `exit` syscall, SIGTERM honoured by the script, onerror, SIGKILL)
  // funnels through here, so this is the one place that needs to terminate it.
  // System-kind entries (the kernel itself, windows registered through
  // kernelRegisterSystem) never have a `worker` property, so this is a no-op
  // for them.
  if (proc.worker) proc.worker.terminate();
  // Order versus the delete below does not matter: this closes over `pid`
  // directly rather than looking the parent up in the map, and JS is
  // single-threaded, so there is no intermediate state anything could observe
  // either way.
  _kernelProcs.forEach(child => {
    if (child.parentPid !== pid) return;
    child.parentPid = KERNEL_PID;
    // The sinks close over the exiting parent's window: onStdout writes into
    // that window's output element. Clearing them makes _kernelWrite fall back
    // to buffering on the entry, so a process outliving its terminal keeps
    // running and its output is retained rather than written into a detached
    // DOM node.
    child.onStdout = null;
    child.onStderr = null;
  });
  const waiters = _kernelWaiters.get(pid) || [];
  _kernelWaiters.delete(pid);
  waiters.forEach(resolve => resolve(code));
  if (proc.winId) _kernelByWinId.delete(proc.winId);
  _kernelProcs.delete(pid);
  _kernelMetrics.delete(pid);
}

// TRAP: kernelWait(pid) on a pid that has already been reaped resolves 0,
// the same value as a process that exited successfully - because kernelExit
// deletes the table entry, there is no way to tell "already gone" apart from
// "exited with code 0" once you get here. Deliberate, not fixed: nothing
// outside tests calls kernelWait today. Fixing it for real means keeping a
// zombie entry (with its exitCode) around after kernelExit until something
// waits on it, rather than deleting immediately - a real design change to
// process lifecycle, not a one-line patch. Whoever adds the first real
// caller needs to make that call, not inherit this silently.
function kernelWait(pid) {
  const proc = _kernelProcs.get(pid);
  if (!proc) return Promise.resolve(0);
  return new Promise(resolve => {
    const list = _kernelWaiters.get(pid) || [];
    list.push(resolve);
    _kernelWaiters.set(pid, list);
  });
}

// Test seam: register a user process against any object exposing postMessage and
// terminate, so the table can be exercised without a browser.
function __spawnForTest(worker, name, parentPid) {
  const pid = _kernelAllocPid();
  const parent = parentPid || KERNEL_PID;
  _kernelProcs.set(pid, {
    pid, name, kind: 'user', state: 'running', parentPid: parent,
    cwd: '', env: kernelInheritEnv(parent), worker, winId: null, exitCode: null, startedAt: Date.now(),
  });
  return pid;
}

// ── Syscall dispatch ───────────────────────────────────────────────
// A Worker has no filesystem of its own; every path it names arrives here as
// a syscall message and every reply crosses back the same way. Defaults to
// the real VFS. Tests replace it so dispatch can be exercised without
// mounting a filesystem.
var _kernelFs = null;
function kernelSetFs(impl) { _kernelFs = impl; }
function _kernelFsImpl() {
  if (_kernelFs) return _kernelFs;
  return {
    async readFile(path, cwd) { return await vfsReadFile(path, cwd); },
    async writeFile(path, text, cwd) { return await vfsWriteFile(path, text, cwd); },
    async stat(path, cwd) { return vfsStatSync(path, cwd); },
    async mkdir(path, cwd) { return await vfsMkdir(path, cwd); },
    // deleteVirtualPath, not vfsUnlink: it enforces the Recycle Bin and the
    // story's undeletable files, and a worker must not be able to bypass either.
    // deleteVirtualPath never throws - a denied or refused delete is a normal
    // outcome it reports as a result object ({ok:false, message, details}),
    // not an exceptional one. Do NOT inspect that .ok here and throw a coded
    // error instead: os/script/interp.js's `del`/`rm` case (around line 416)
    // reads `deletion.ok` itself and turns a false into a script error - that
    // IS the adapter contract for this method, mirrored unchanged by the
    // worker-side adapter's `unlink` (os/worker/syscalls.js) and the
    // main-thread one (os/script/interp.js's makeVfsScriptFs, ~line 595).
    // `reply.ok` at the syscall-reply boundary only means "this syscall did
    // not throw"; it is a per-method contract, not a blanket success signal,
    // and for unlink the success/failure signal is the returned object's own
    // `.ok`. Throwing here would make the worker path reject where the
    // main-thread path still resolves to an object, splitting the one
    // behavior this boundary exists to keep unified.
    async unlink(path, cwd) { return await deleteVirtualPath(path, cwd); },
    // vfsDirExistsSync -> vfsDirNodeSync, which resolves the whole path as a
    // directory and ignores cwd. That disagrees with a stat-based derivation on
    // root paths and relative names, so this gets its own syscall rather than
    // being derived from stat() on the other side of the boundary.
    async dirExists(path) { return vfsDirExistsSync(path); },
    async list(path) { return vfsListSync(path); },
  };
}

async function kernelHandleSyscall(pid, msg) {
  const proc = _kernelProcs.get(pid);
  // A worker can post one last syscall after SIGKILL, or after its own exit
  // syscall is already in flight. Dropping it is correct; replying would post
  // to a terminated worker.
  if (!proc || proc.state !== 'running') return;
  const { seq, name } = msg;
  // One normalization for the whole dispatch: a missing (or null) `args` is as
  // valid as an empty one, for every syscall including `exit`, which used to
  // read args[0] before this line ran and throw an unhandled TypeError on a
  // bare `exit` with no args key at all.
  const args = msg.args || [];
  if (name === 'exit') { kernelExit(pid, Math.trunc(args[0] ?? 0)); return; }
  try {
    const value = await _kernelSyscall(proc, name, args);
    proc.worker.postMessage({ type: 'syscall-reply', seq, ok: true, value });
  } catch (err) {
    // Only code and message survive structured cloning of an Error subclass in a
    // useful form, and the interpreter branches on code to build script errors.
    proc.worker.postMessage({
      type: 'syscall-reply', seq, ok: false,
      error: { code: err && err.code ? err.code : 'EIO', message: (err && err.message) || String(err) },
    });
  }
}

// The directory a syscall resolves against is per-call, not per-process: the
// interpreter passes the resolved directory of the target, which for `run` and
// `grep` is the target's own directory rather than the script's. Fall back to
// the process cwd only when the caller supplied none.
function _kernelCwd(proc, arg) { return arg === undefined ? proc.cwd : arg; }

async function _kernelSyscall(proc, name, args) {
  const fs = _kernelFsImpl();
  switch (name) {
    case 'readFile':  return await fs.readFile(args[0], _kernelCwd(proc, args[1]));
    case 'writeFile': return await fs.writeFile(args[0], args[1], _kernelCwd(proc, args[2]));
    case 'stat':      return await fs.stat(args[0], _kernelCwd(proc, args[1]));
    case 'mkdir':     return await fs.mkdir(args[0], _kernelCwd(proc, args[1]));
    case 'unlink':    return await fs.unlink(args[0], _kernelCwd(proc, args[1]));
    case 'dirExists': return await fs.dirExists(args[0]);
    // vfsListSync, like vfsDirExistsSync, resolves a directory path directly
    // and ignores cwd - no _kernelCwd fallback here, same as dirExists.
    case 'list':      return await fs.list(args[0]);
    case 'cwd':       return proc.cwd;
    case 'getenv':    return proc.env[args[0]];
    case 'sleep':     return await new Promise(r => setTimeout(r, Math.max(0, Math.trunc(args[0]) || 0)));
    case 'write':     return _kernelWrite(proc, args[0], args[1]);
    case 'spawn':     return await kernelSpawn(args[0], args[1] || [], { parentPid: proc.pid, cwd: proc.cwd });
    case 'ui.open':   return _kernelUiOpen(proc, args[0], args[1]);
    case 'ui.openSystem': return _kernelUiOpenSystem(proc, args[0], args[1], args[2]);
    case 'ui.isSystemPath': return _kernelUiIsSystemPath(proc, args[0]);
    default: {
      const err = new Error('unknown syscall: ' + name);
      err.code = 'ENOSYS';
      throw err;
    }
  }
}

const WORKER_BUNDLE_URL = 'sleep-os-worker.bundle.js';

// Streams live on the kernel side so a process cannot write anywhere the kernel
// has not bound. The terminal binds stdout to its window; unbound output is
// retained on the entry so nothing is silently dropped.
function _kernelWrite(proc, stream, text) {
  const line = String(text == null ? '' : text);
  const sink = stream === 'stderr' ? proc.onStderr : proc.onStdout;
  if (typeof sink === 'function') sink(line);
  else (proc[stream] = proc[stream] || []).push(line);
  return true;
}

// scriptOpenUiTarget/scriptOpenSystemProgram (os/script/interp.js) are the one
// shared implementation makeVfsScriptFs's openUi/openSystem also call - see
// the comments there. Both only ever run on the main thread, so calling them
// from here (which only happens by answering a worker's syscall) is safe.
function _kernelUiOpen(proc, path, cwd) {
  return scriptOpenUiTarget(path, _kernelCwd(proc, cwd));
}

function _kernelUiOpenSystem(proc, name, cwd, arg) {
  return scriptOpenSystemProgram(name, _kernelCwd(proc, cwd), arg);
}

function _kernelUiIsSystemPath(proc, path) {
  return isVisibleSystemPath(path, { includeExplorer: true });
}

async function kernelSpawn(path, argv, opts) {
  opts = opts || {};
  const cwd = opts.cwd || '';
  const st = vfsStatSync(path, cwd);
  if (!st || st.kind !== 'text') {
    const err = new Error('script not found: ' + path);
    err.code = 'ENOENT';
    throw err;
  }
  const source = await vfsReadFile(st.name, st.dirName);
  const worker = new Worker(WORKER_BUNDLE_URL);
  const pid = _kernelAllocPid();
  const parentPid = opts.parentPid || KERNEL_PID;
  const env = kernelInheritEnv(parentPid);
  _kernelProcs.set(pid, {
    pid, name: st.name, kind: 'user', state: 'running',
    parentPid, cwd: st.dirName, env,
    worker, winId: null, exitCode: null, startedAt: Date.now(),
    onStdout: opts.onStdout || null, onStderr: opts.onStderr || null,
  });
  worker.onmessage = e => {
    if (e.data && e.data.type === 'metrics') { kernelRecordMetrics(pid, e.data); return; }
    void kernelHandleSyscall(pid, e.data);
  };
  // A worker that throws before its first syscall would otherwise stay running
  // forever in the table.
  worker.onerror = e => { _kernelWrite(_kernelProcs.get(pid) || {}, 'stderr', e.message || 'worker error'); kernelExit(pid, 1); };
  // env crosses at init rather than being fetched with the getenv syscall on
  // demand: scriptResolveText (os/script/interp.js) expands $name with a
  // synchronous object lookup inside a regex replace, so a lazy read would
  // mean making variable expansion async through the whole interpreter in both
  // realms. Copying at exec time is what real systems do anyway, and it hands
  // the child a private copy for free.
  worker.postMessage({ type: 'init', source, name: st.name, cwd: st.dirName, argv, env });
  return pid;
}
// In-memory backend. Used by the test suite (no IndexedDB polyfill needed)
// and by phase 3, where processes never touch storage directly anyway.
function createMemStorage(options) {
  options = options || {};
  const quota = Number.isFinite(options.quota) ? options.quota : Infinity;
  let stored = options.tree ? JSON.parse(JSON.stringify(options.tree)) : null;
  const ops = [];

  function measure(snapshot) {
    return JSON.stringify(snapshot).length;
  }

  const backend = {
    async load() {
      return stored ? JSON.parse(JSON.stringify(stored)) : null;
    },
    async commit({ ops: batch, snapshot }) {
      const size = measure(snapshot);
      // Check before storing so a rejected commit leaves the previous state
      // intact. A backend that half-applies is worse than one that refuses.
      if (size > quota) {
        throw VfsError('ENOSPC', 'memory backend quota exceeded: ' + size + ' > ' + quota);
      }
      (batch || []).forEach(op => ops.push(op));
      stored = JSON.parse(JSON.stringify(snapshot));
    },
    async estimate() {
      return { usage: stored ? measure(stored) : 0, quota };
    },
    _ops: ops,
    get _snapshot() { return stored; },
  };
  return backend;
}
// localStorage backend. This is phase 2's production backend and it reads and
// writes exactly the payload saveFS/loadFS used before, so an existing
// visitor's filesystem loads unchanged.
//
// The one deliberate behavior change: a quota failure throws ENOSPC. The old
// code caught the exception and discarded it, so a full disk silently ate the
// user's work. Phase 4 replaces this backend with IndexedDB.
const LOCAL_FS_KEY = 'sleepOS-fs';
// localStorage is spec'd at 5 MB per origin and exposes no quota API.
const LOCAL_QUOTA_BYTES = 5 * 1024 * 1024;

// Browsers disagree on how they signal a full quota. Chrome and Safari throw
// QuotaExceededError (legacy code 22), Firefox historically used
// NS_ERROR_DOM_QUOTA_REACHED (code 1014). Anything else - most often a
// SecurityError from storage being disabled - is a different problem and must
// not be reported as "out of space".
function _isQuotaError(e) {
  if (!e) return false;
  return e.name === 'QuotaExceededError'
      || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || e.code === 22
      || e.code === 1014;
}

function createLocalStorageBackend(options) {
  options = options || {};
  const key = options.key || LOCAL_FS_KEY;

  return {
    async load() {
      let raw = null;
      try { raw = localStorage.getItem(key); } catch (e) { return null; }
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },

    async commit({ ops, snapshot }) {
      const payload = JSON.stringify(snapshot);
      try {
        localStorage.setItem(key, payload);
      } catch (e) {
        if (_isQuotaError(e)) {
          throw VfsError('ENOSPC', 'localStorage is full: could not write ' + payload.length + ' bytes');
        }
        throw VfsError('EACCES', 'localStorage is unavailable: ' + ((e && e.message) || e));
      }
    },

    async estimate() {
      // localStorage quota is per-origin, and sleepOS writes far more than the
      // filesystem key: drive state, recycle bin, icon positions, settings, the
      // registry, and base64 blob content from os/blob-store.js. Counting only
      // our own key would report kilobytes while the origin holds megabytes,
      // and the VFS's pre-write guard is only as honest as this number.
      let usage = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k == null) continue;
          const v = localStorage.getItem(k);
          usage += k.length + (v ? v.length : 0);
        }
      } catch (e) {
        usage = 0;
      }
      return { usage, quota: LOCAL_QUOTA_BYTES };
    },
  };
}
// ─────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────
const PROJECTS = [
  { name: 'sand playground',    emoji: '⏳', file: 'evenet.fun/Sands.html' },
  { name: 'bug hotline',        emoji: '🐛', file: 'evenet.fun/critters.html' },
  { name: 'fireworks',          emoji: '🎆', file: 'evenet.fun/fireworks.html' },
  { name: 'pixel splatter',     emoji: '🔮', file: 'pixel-splatter.html' },
  { name: 'fluid',              emoji: '💧', file: 'evenet.fun/fluido.html' },
  { name: 'web wizard casino',  emoji: '🎰', file: 'evenet.fun/webwizardcasino.html' },
  { name: 'automata garden',    emoji: '🌱', file: 'evenet.fun/automata-garden.html' },
  { name: 'erosion toy',        emoji: '🏔️',  file: 'evenet.fun/erosion.html' },
  { name: 'wave collapse',      emoji: '🌊', file: 'evenet.fun/wave-collapse.html' },
  { name: 'tentacle catch',     emoji: '🦑', file: 'evenet.fun/catch.html' },
  { name: 'reaction diffusion', emoji: '⚗️',  file: 'evenet.fun/philosophers-stone.html' },
  { name: 'voronoi',            emoji: '🔬', file: 'evenet.fun/vornoi.html' },
  { name: 'morse code',         emoji: '📡', file: 'evenet.fun/morse.html' },
  { name: 'lissajous',          emoji: '〰️', file: 'evenet.fun/lissajous.html' },
  { name: 'net sanctuary',      emoji: '🌐', file: 'evenet.fun/net-sanctuary-project.html' },
  { name: 'ascii render',       emoji: '💻', file: 'evenet.fun/ascii-render.html' },
  { name: 'tablecloth',         emoji: '🧶', file: 'evenet.fun/tablecloth.html' },
  { name: 'corridor crawler',   emoji: '🚪', file: 'evenet.fun/corridor.html' },
  { name: 'patch synth',        emoji: '🎛️',  file: 'evenet.fun/synth.html' },
  { name: 'turtle',             emoji: '🐢', file: 'evenet.fun/turtle.html' },
  { name: 'ball like',          emoji: '⚪', file: 'evenet.fun/ball-like.html' },
  { name: 'magnetic pendulum',  emoji: '🧲', file: 'evenet.fun/magnetic-pendulum.html' },
  { name: 'physarum',           emoji: '🍄', file: 'evenet.fun/physarum.html' },
  { name: 'dla crystal',        emoji: '❄️', file: 'evenet.fun/dla-crystal.html' },
];
const RECYCLE_BIN_NAME = 'RECYCLE BIN';
const RECYCLE_STORAGE_DIR = 'CACHE\\RECYCLE_BIN';
const RECYCLE_BIN_KEY = 'sleepOS-recycle-bin';

const DESKTOP_ICONS = [
  { name: 'WELCOME.README', emoji: 'icon:text',     action: 'openWelcome' },
  { name: 'NOTEPAD.exe',    emoji: 'icon:notepad',  action: 'openNotepad' },
  { name: 'EXPLORER.exe',   emoji: 'icon:explorer', action: 'openExplorer' },
  { name: 'TERMINAL.exe',   emoji: 'icon:terminal', action: 'openTerminal' },
  { name: 'SYSMON.exe',     emoji: 'icon:sysmon',   action: 'openSysmon' },
  { name: 'BROWSER.exe',    emoji: 'icon:browser',  action: 'openBrowser' },
  { name: 'DEFRAG.exe',     emoji: 'icon:defrag',   action: 'openDefrag' },
  { name: 'CALC.exe',       emoji: 'icon:calc',     action: 'openCalculator' },
  { name: 'REGEDIT.exe',    emoji: 'icon:regedit',  action: 'openRegedit' },
  { name: 'daemon.core',    emoji: 'icon:daemon',   action: 'openDaemon' },
  { name: 'void.tmp',       emoji: 'icon:void',     action: 'openVoid' },
  // Not in the static map alone: the bin's icon depends on whether it holds
  // anything, so resolveFsIcon picks between empty and full at render time.
  { name: RECYCLE_BIN_NAME, emoji: 'icon:recycle-empty', action: 'openRecycleBin', recycleBin: true },
];
function getExeDisplayName() {
  return daemonStory.quarantineSigned ? 'quarantine.exe' : '?????.exe';
}

const DESKTOP_ICON_DIRS_KEY = 'sleepOS-desktop-icon-dirs';
function normalizeDesktopContainerDir(dirPath) {
  const normalized = fsNormalizeDir(dirPath || 'DESKTOP');
  if (!normalized || normalized === 'DESKTOP' || normalized.startsWith('DESKTOP\\')) return normalized || 'DESKTOP';
  return 'DESKTOP';
}
function loadDesktopIconDirs() {
  try {
    const raw = JSON.parse(localStorage.getItem(DESKTOP_ICON_DIRS_KEY) || '{}') || {};
    const out = {};
    Object.entries(raw).forEach(([name, dirPath]) => {
      const icon = DESKTOP_ICONS.find(item => item.name === name && !item.recycleBin);
      if (!icon) return;
      const normalized = normalizeDesktopContainerDir(dirPath);
      if (normalized !== 'DESKTOP') out[name] = normalized;
    });
    return out;
  } catch (e) {
    return {};
  }
}
function saveDesktopIconDirs() {
  try { localStorage.setItem(DESKTOP_ICON_DIRS_KEY, JSON.stringify(desktopIconDirs)); } catch (e) {}
}
let desktopIconDirs = loadDesktopIconDirs();
function getDesktopSystemIconDir(name) {
  if (isRecycleBinItemName(name)) return 'DESKTOP';
  const normalized = normalizeDesktopContainerDir(desktopIconDirs[name] || 'DESKTOP');
  return normalized !== 'DESKTOP' && !vfsDirExistsSync(normalized) ? 'DESKTOP' : normalized;
}
function setDesktopSystemIconDir(name, dirPath) {
  if (isRecycleBinItemName(name)) return;
  const normalized = normalizeDesktopContainerDir(dirPath);
  if (normalized === 'DESKTOP') delete desktopIconDirs[name];
  else desktopIconDirs[name] = normalized;
  saveDesktopIconDirs();
}
function getDesktopSystemIconsForDir(dirPath) {
  const normalized = normalizeDesktopContainerDir(dirPath);
  return DESKTOP_ICONS.filter(icon => {
    if (icon.name === 'void.tmp' && daemonStory.endingReached) return false;
    if (icon.recycleBin) return normalized === 'DESKTOP';
    return getDesktopSystemIconDir(icon.name) === normalized;
  });
}
function getVisibleDesktopIcons() {
  return getDesktopSystemIconsForDir('DESKTOP');
}
function isDesktopContainerPath(dirPath) {
  const normalized = fsNormalizeDir(dirPath);
  return normalized === 'DESKTOP' || normalized.startsWith('DESKTOP\\');
}
function isDesktopVirtualItem(item, srcDirPath) {
  if (!item || !isDesktopContainerPath(srcDirPath)) return false;
  if (item._shortcut || item.custom) return true;
  return !!item.sysfile && !item.recycleBin && !isRecycleBinItemName(item.name);
}
function clearDesktopRootIconPosition(name) {
  if (!Object.prototype.hasOwnProperty.call(iconPositions, name)) return;
  delete iconPositions[name];
  saveIconPositions();
}
function canMoveDesktopVirtualItem(item, srcDirPath, dstDirPath) {
  const srcDir = fsNormalizeDir(srcDirPath);
  const dstDir = fsNormalizeDir(dstDirPath);
  if (!isDesktopVirtualItem(item, srcDir)) return false;
  if (!isDesktopContainerPath(dstDir)) return false;
  return dstDir === 'DESKTOP' || vfsDirExistsSync(dstDir);
}
function moveDesktopVirtualItem(item, srcDirPath, dstDirPath) {
  const srcDir = fsNormalizeDir(srcDirPath);
  const dstDir = fsNormalizeDir(dstDirPath);
  if (!canMoveDesktopVirtualItem(item, srcDirPath, dstDir)) return false;
  if (srcDir === dstDir) return true;
  if (item._shortcut || item.custom) {
    const shortcut = item._shortcut || item;
    shortcut.dirPath = normalizeDesktopContainerDir(dstDir);
    saveDesktopShortcuts();
  } else {
    setDesktopSystemIconDir(item.name, dstDir);
  }
  clearDesktopRootIconPosition(item.name);
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return true;
}
function canMoveShellItemToDir(item, srcDirPath, dstDirPath) {
  const dstDir = fsNormalizeDir(dstDirPath);
  if (!item || item._proj || item._recycle) return false;
  if (isDesktopVirtualItem(item, srcDirPath)) return canMoveDesktopVirtualItem(item, srcDirPath, dstDir);
  if (item.sysfile || item._shortcut) return false;
  return dstDir === '' || vfsDirExistsSync(dstDir);
}
async function moveShellItemToDir(item, srcDirPath, dstDirPath) {
  const srcDir = fsNormalizeDir(srcDirPath);
  const dstDir = fsNormalizeDir(dstDirPath);
  if (isDesktopVirtualItem(item, srcDirPath)) return moveDesktopVirtualItem(item, srcDirPath, dstDir);
  if (!canMoveShellItemToDir(item, srcDirPath, dstDir)) return false;
  if (srcDir === dstDir) return true;
  const oldPath = srcDir ? srcDir + '\\' + item.name : item.name;
  const moved = await moveFsItemByPath(item.name, srcDirPath, dstDir);
  if (!moved) return false;
  const newPath = moved.dirName ? moved.dirName + '\\' + moved.name : moved.name;
  retargetDesktopShortcutsForMove(oldPath, newPath, item.kind);
  if (isDesktopContainerPath(srcDirPath) || isDesktopContainerPath(dstDir)) clearDesktopRootIconPosition(item.name);
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return true;
}
function canRecycleShellItem(item, srcDirPath) {
  return !!item && !item._proj && !item._recycle && !item._shortcut && !item.sysfile && !isDesktopVirtualItem(item, srcDirPath);
}
async function recycleShellItem(item, srcDirPath) {
  if (!canRecycleShellItem(item, srcDirPath)) return { ok: false, message: 'Move failed.' };
  const result = await recycleVirtualPath(item.name, srcDirPath);
  if (result.ok) {
    if (isDesktopContainerPath(srcDirPath)) clearDesktopRootIconPosition(item.name);
    document.dispatchEvent(new CustomEvent('fs-changed'));
  }
  return result;
}
function setShellDragPayload(payload) {
  _shellDragPayload = payload || null;
}
function getShellDragPayload() {
  return _shellDragPayload;
}
function clearShellDragPayload() {
  _shellDragPayload = null;
}
function isDesktopSurfaceTransferBlocked(payload, dstDirPath) {
  if (!payload) return false;
  return fsNormalizeDir(payload.srcCwd) === 'DESKTOP' && fsNormalizeDir(dstDirPath) === 'DESKTOP';
}
function buildShellDragPayload(item, srcCwd, source, extra) {
  const raw = Array.isArray(extra?.items) && extra.items.length ? extra.items : [item];
  const items = [];
  raw.forEach(candidate => {
    if (candidate && !items.includes(candidate)) items.push(candidate);
  });
  return {
    ...(extra || {}),
    item: item || items[0] || null,
    items,
    srcCwd,
    source,
  };
}
function getShellDragItems(payload) {
  if (!payload) return [];
  const raw = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload.item];
  return raw.filter((item, index) => item && raw.indexOf(item) === index);
}
function shellDragIncludesItem(payload, item) {
  return !!item && getShellDragItems(payload).includes(item);
}
function canMoveShellPayloadToDir(payload, dstDirPath) {
  const items = getShellDragItems(payload);
  return !!items.length && items.every(item => canMoveShellItemToDir(item, payload.srcCwd, dstDirPath));
}
// Sequential, not Promise.all: two concurrent moves into the same directory
// would resolve their unique-name checks against the same pre-move listing.
async function moveShellPayloadToDir(payload, dstDirPath) {
  const items = getShellDragItems(payload);
  if (!items.length || !canMoveShellPayloadToDir(payload, dstDirPath)) return false;
  let moved = 0;
  for (const item of items) {
    if (await moveShellItemToDir(item, payload.srcCwd, dstDirPath)) moved++;
  }
  return moved === items.length;
}
function canRecycleShellPayload(payload) {
  const items = getShellDragItems(payload);
  return !!items.length && items.every(item => canRecycleShellItem(item, payload.srcCwd));
}
async function recycleShellPayload(payload) {
  const items = getShellDragItems(payload);
  if (!items.length || !canRecycleShellPayload(payload)) return false;
  let recycled = 0;
  for (const item of items) {
    const result = await recycleShellItem(item, payload.srcCwd);
    if (result.ok) recycled++;
  }
  return recycled === items.length;
}
const SYSTEM_FILE_ICONS = DESKTOP_ICONS.reduce((icons, { name, emoji }) => {
  icons[name.toUpperCase()] = emoji;
  return icons;
}, Object.create(null));

const DESKTOP_SHORTCUTS_KEY = 'sleepOS-desktop-shortcuts';
const customDesktopIcons = [];
function normalizeShortcutPath(path) {
  return String(path || '')
    .trim()
    .replace(/^C:\\sleepOS\\?/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '');
}
function normalizeDesktopShortcut(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const target = entry.target && typeof entry.target === 'object' ? entry.target : null;
  if (!target) return null;
  const kind = target.kind === 'dir' ? 'dir' : 'file';
  const path = normalizeShortcutPath(target.path);
  const name = String(entry.name || target.name || path.split('\\').pop() || '').trim();
  const emoji = String(entry.emoji || '').trim();
  if (!name || !emoji) return null;
  if (!path && !target.sysfile) return null;
  const dirPath = normalizeDesktopContainerDir(entry.dirPath || 'DESKTOP');
  return {
    name,
    emoji,
    custom: true,
    dirPath,
    target: {
      name,
      path,
      kind,
      sysfile: !!target.sysfile,
    },
  };
}
function saveDesktopShortcuts() {
  try {
    localStorage.setItem(DESKTOP_SHORTCUTS_KEY, JSON.stringify(customDesktopIcons.map(({ name, emoji, dirPath, target }) => ({
      name,
      emoji,
      dirPath: normalizeDesktopContainerDir(dirPath || 'DESKTOP'),
      target,
    }))));
  } catch (e) {}
}
function loadDesktopShortcuts() {
  customDesktopIcons.length = 0;
  try {
    const raw = JSON.parse(localStorage.getItem(DESKTOP_SHORTCUTS_KEY) || '[]');
    raw.map(normalizeDesktopShortcut).filter(Boolean).forEach(icon => customDesktopIcons.push(icon));
  } catch (e) {}
}
function getDesktopShortcutsForDir(dirPath) {
  const normalized = normalizeDesktopContainerDir(dirPath);
  return customDesktopIcons.filter(icon => {
    const iconDir = normalizeDesktopContainerDir(icon.dirPath || 'DESKTOP');
    const resolvedDir = iconDir !== 'DESKTOP' && !vfsDirExistsSync(iconDir) ? 'DESKTOP' : iconDir;
    return resolvedDir === normalized;
  });
}
function retargetDesktopShortcutsForMove(oldPath, newPath, kind) {
  const from = normalizeShortcutPath(oldPath);
  const to = normalizeShortcutPath(newPath);
  if (!from || !to) return false;
  let changed = false;
  customDesktopIcons.forEach(icon => {
    const target = icon?.target;
    if (!target || target.sysfile) return;
    const targetPath = normalizeShortcutPath(target.path);
    if (!targetPath) return;
    if (kind === 'dir') {
      if (targetPath === from || targetPath.startsWith(from + '\\')) {
        target.path = to + targetPath.slice(from.length);
        changed = true;
      }
      return;
    }
    if (targetPath === from) {
      target.path = to;
      changed = true;
    }
  });
  if (changed) saveDesktopShortcuts();
  return changed;
}
loadDesktopShortcuts();
function openSystemFile(name) {
  const key = String(name || '').trim();
  if (!key) return false;
  if (key.toLowerCase() === 'void.tmp' && daemonStory.endingReached) {
    osAlert('void.tmp is no longer present.', 'void.tmp', 'icon:void');
    return true;
  }
  // The Recycle Bin is a desktop object rather than a program, so it stays
  // here rather than going in the registry - it has no directory, cannot be
  // typed at the terminal, and must never resolve on PATH.
  if (key.toLowerCase() === String(RECYCLE_BIN_NAME).toLowerCase()) {
    openRecycleBin();
    return true;
  }
  // A GUI launch does not consult PATH. Explorer and the desktop already know
  // where the thing is, and this is what keeps a player who breaks PATH from
  // also losing their desktop icons. Same reason Windows launches a
  // double-clicked file without searching.
  //
  // Two constraints on this call, both correct today only because of what
  // programsInDir('') currently returns:
  //
  // 1. Everything programsInDir('') hands back is treated as GUI-launchable -
  //    `if (!program || !program.open) return false` is the only gate, and
  //    every entry the registry can produce today has an `open`. Phase 6
  //    (master spec) adds a vfsListSync pass to programsInDir so real VFS
  //    `.exe` files show up too; the day that lands, a naive read of this
  //    function will make any root file - a stray .txt, a blob - something
  //    openSystemFile "launches" and reports true for. That silently changes
  //    behaviour for both of this function's callers: Explorer's
  //    double-click (which ignores the return value, so it would just start
  //    quietly doing nothing useful) and the terminal's OPEN command (which
  //    would report success for a file it did not actually open). Phase 6
  //    needs an executables-only filter here, not just in programsInDir.
  //
  // 2. This only ever searches '' (the root). Explorer calls openSystemFile
  //    with a bare name from whatever directory it is currently showing, not
  //    necessarily the root - correct today only because programsInDir has
  //    programs solely at the root ('' and 'PROJECTS', and PROJECTS entries
  //    are not opened through this path). If a future directory ever gains
  //    launchable entries, this needs the caller's directory, not a
  //    hardcoded ''.
  const program = programsInDir('').find(entry =>
    entry.name.toLowerCase() === key.toLowerCase());
  if (!program || !program.open) return false;
  program.open({ cwd: '' });
  return true;
}
function openDesktopShortcutTarget(target) {
  if (!target || typeof target !== 'object') return;
  const path = normalizeShortcutPath(target.path);
  const name = String(target.name || path.split('\\').pop() || '').trim();
  if (target.sysfile) {
    if (!openSystemFile(name || path)) {
      osAlert('Shortcut target not found:\n' + (name || path || 'Unknown target'), 'Missing Shortcut', 'icon:error');
    }
    return;
  }
  if (target.kind === 'dir') {
    openExplorer(path);
    return;
  }
  // `!st` alone is not enough: fsGetEntry returned null for a directory but
  // vfsStatSync returns a full stat for one, and a shortcut whose persisted
  // kind is not literally 'dir' reaches here with a directory path. Falling
  // through would open Notepad on a directory, whose save then puts the same
  // name in both files and dirs and makes the directory unreachable.
  const st = vfsStatSync(path);
  if (!st || st.type !== 'file') {
    osAlert('Shortcut target not found:\n' + (path || name || 'Unknown target'), 'Missing Shortcut', 'icon:error');
    return;
  }
  if (openWithAssociation(st.name, st.dirName)) return;
  if (st.kind === 'blob') openMediaFile(st.name, st.dirName);
  else openNotepad(st.name, st.dirName);
}

function openRecycleBin() {
  openExplorer('RECYCLE');
}

// `homeIcon` is an icon token rather than an HTML entity now, and buildHome
// (apps/browser.js) runs it through iconMarkup. It stays a per-entry field
// rather than being derived from the URL because these are the only favourites
// that get branded art: one a player adds themselves has no icon to use, and
// falls back to the same star the project links carry.
const DEFAULT_BROWSER_FAVORITES = [
  { title: 'Wikipedia: Random', url: 'https://en.wikipedia.org/wiki/Special:Random', homeIcon: 'icon:wikipedia' },
  { title: 'Internet Archive',  url: 'https://archive.org', homeIcon: 'icon:internet-archive' },
  { title: 'Poolsuite FM',      url: 'https://poolsuite.net', homeIcon: 'icon:poolsuite' },
  { title: 'Win98 Icons',       url: 'https://win98icons.alexmeub.com', homeIcon: 'icon:win-icons' },
];
const DEFAULT_BROWSER_FAVORITE_URLS = new Set(DEFAULT_BROWSER_FAVORITES.map(fav => fav.url.toLowerCase()));
function normalizeFavoriteEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const url = String(entry.url || '').trim();
  if (!url) return null;
  const title = String(entry.title || url).trim() || url;
  return { title, url };
}
function dedupeFavorites(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map(normalizeFavoriteEntry)
    .filter(entry => {
      if (!entry) return false;
      const key = entry.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
let browserFavorites = [];
try {
  browserFavorites = dedupeFavorites(JSON.parse(localStorage.getItem('sleepOS-favorites') || '[]'));
} catch {
  browserFavorites = [];
}
function saveFavorites() {
  browserFavorites = dedupeFavorites(browserFavorites);
  localStorage.setItem('sleepOS-favorites', JSON.stringify(browserFavorites));
}
if (localStorage.getItem('sleepOS-favorites-seeded') !== '1') {
  browserFavorites = dedupeFavorites([...DEFAULT_BROWSER_FAVORITES, ...browserFavorites]);
  saveFavorites();
  localStorage.setItem('sleepOS-favorites-seeded', '1');
}

// One table of everything sleepOS can launch, and the resolver that finds an
// entry by name. This replaces the three lists the original spec inventoried
// that had to be edited together and silently disagreed when they were not:
// `launchers` in apps/terminal.js, `SYS` in os/desktop-model.js, and the
// launcher half of ROOT_SYSTEM_FILE_META.
//
// It does NOT replace every hand-maintained name -> launcher map in the
// codebase - two more are still live, and adding an entry here today is
// invisible to both of them:
//   - os/run-dialog.js's RUN_MAP (the Run... dialog)
//   - os/script/interp.js's scriptOpenSystemProgram map (reached by a
//     .script file's START/OPEN, and by a spawned worker's ui.openSystem
//     syscall)
// A PROGRAM_LAUNCHERS entry with no matching RUN_MAP/scriptOpenSystemProgram
// entry launches fine from the desktop and the terminal's own START, but Run...
// reports "Cannot find program" and a script's START/OPEN falls through to
// openSystemFile instead of running it. Folding those two in is known
// follow-up work, not done here.
//
// Every `open` is an arrow rather than a direct function reference. The
// launchers it names (openNotepad, openDaemon, openVoid) are declared in files
// that come LATER in tools/split-manifest.json, and while a hoisted function
// declaration is safe to call later, it is not safe to reference while this
// file is still evaluating.
//
// PROJECTS and ROOT_SYSTEM_FILE_META are read inside function bodies too, but
// not for the same reason as each other, and not for the reason once claimed
// here. Per tools/split-manifest.json, os/desktop-model.js (PROJECTS) is
// manifest position 6 and this file, os/programs.js, is position 7 - PROJECTS
// loads BEFORE PROGRAM_LAUNCHERS, not after, so referencing it at evaluation
// time would already be safe. It is read lazily inside programProjectEntry
// anyway, purely so every registry-consuming function shares the same
// lazy-read shape. ROOT_SYSTEM_FILE_META is the one where lazy reading is
// load-bearing: it is `const` in os/daemon.js, manifest position 13, which
// genuinely loads after this file, so touching it at evaluation time (rather
// than inside programsInDir, which only runs once the OS is up) would throw
// on boot.
//
// PHASE 6 SEAM: when executables become real VFS files (master spec phase 6),
// programsInDir gains a vfsListSync pass yielding entries whose `open` spawns
// the script. programResolve, programPathDirs and all four terminal commands
// work against whatever programsInDir returns, so none of them need touching.
// That is why `open` is a closure rather than a name: a spawned .exe and a
// built-in window have to sit in the same table.
//
// ONE CONSUMER IS NOT COVERED BY THAT SENTENCE. openSystemFile
// (os/desktop-model.js) also reads programsInDir(''), and it treats every
// entry it gets back as GUI-launchable - `if (!program || !program.open)` is
// its only gate. Harmless today, because every entry is a built-in with a real
// `open`. The moment a vfsListSync pass starts contributing entries for
// arbitrary root files, that call would make any root .txt or blob "launch"
// and report success to Explorer's double-click (which ignores the return
// value, so the failure is invisible there) and to the terminal's OPEN. Phase
// 6 needs an executables-only filter at THAT call site, not only in here.

// Keyed by uppercase name. ROOT_SYSTEM_FILE_META stays the source of which
// programs exist at the root and of their DIR display metadata; this is the
// source of what launching one DOES.
const PROGRAM_LAUNCHERS = {
  'TERMINAL.EXE': {
    lines: ['Starting TERMINAL.exe...'],
    open: () => openTerminal(),
    // Printed instead of launching when the TERMINAL is the thing resolving
    // it. Data rather than a branch in the terminal, so the one table still
    // describes the whole behaviour of every program.
    selfLines: ['TERMINAL.exe is already running.', 'You are inside it.'],
  },
  'NOTEPAD.EXE':  { lines: ['Opening Notepad...'],        open: ctx => openNotepad(undefined, ctx.cwd) },
  'EXPLORER.EXE': { lines: ['Opening File Explorer...'],  open: ctx => openExplorer(ctx.cwd || '') },
  'SYSMON.EXE':   { lines: ['Starting SYSMON.exe...'],    open: () => openSysmon() },
  'BROWSER.EXE':  { lines: ['Starting BROWSER.exe...'],   open: () => openBrowser() },
  'DEFRAG.EXE':   { lines: ['Starting DEFRAG.exe...'],    open: () => openDefrag() },
  'CALC.EXE':     { lines: ['Starting CALC.exe...'],      open: () => openCalculator() },
  'REGEDIT.EXE':  { lines: ['Starting REGEDIT.exe...'],   open: () => openRegedit() },
  'VOID.TMP':     { lines: ['Opening void.tmp...'],       open: () => openVoid() },
  '?????.EXE':    { lines: ['Executing ?????.exe...'],    open: () => openUnknown(), aliases: ['?????'] },
  'DAEMON.CORE':  {
    lines: ['Opening daemon.core...'],
    open: () => openDaemon(),
    // The daemon gets a longer beat before its window appears. This was the
    // only entry in the old `launchers` map with a delay of its own and it is
    // a deliberate story beat, not a rounding error.
    delay: 320,
  },
  'WELCOME.README': { lines: ['Opening WELCOME.README...'], open: () => openWelcome(), aliases: ['welcome'] },
  // Launchable but deliberately not in ROOT_SYSTEM_FILE_META, so DIR does not
  // list them. Both were reachable from the old `launchers`/`SYS` maps and
  // stay reachable; neither has ever been a file.
  //
  // FILES specifically is programsInDir('')'s thirteenth root entry - it is
  // appended alongside WELCOME.README in the '' branch below even though it
  // has no ROOT_SYSTEM_FILE_META row and DIR never lists it, preserving what
  // the old `launchers.files` entry did. That means `WHERE files` resolves
  // and prints a C:\sleepOS\FILES path that does not exist as a file; this
  // is the same launchable-but-not-a-file behaviour as WELCOME.README's
  // aliasing, just undeclared until now.
  'FILES': { lines: ['Opening Files...'], open: () => openFiles() },
};

// Story files exist at the root without being in ROOT_SYSTEM_FILE_META, and
// their visibility depends on story state, so the list is rebuilt per call
// rather than captured. Same reason isSystemPath is a live syscall instead of
// a spawn-time snapshot.
function programStoryRootNames() {
  const names = [];
  if (!daemonStory.endingReached) names.push('void.tmp');
  names.push('daemon.core', '?????.exe');
  return names;
}

function programEntry(name, dir) {
  const spec = PROGRAM_LAUNCHERS[String(name).toUpperCase()];
  if (!spec) return null;
  return {
    name,
    dir,
    lines: spec.lines || [],
    delay: spec.delay === undefined ? 300 : spec.delay,
    open: spec.open,
    aliases: spec.aliases || [],
    selfLines: spec.selfLines || null,
  };
}

function programProjectEntry(project) {
  return {
    name: project.name,
    dir: 'PROJECTS',
    lines: ['Launching ' + project.name + '...', 'Opening in new tab.'],
    delay: 400,
    open: () => window.open(project.file, '_blank'),
    // The four forms findTerminalProject accepted before this module existed.
    // Dropping any of them would break START commands players already type.
    aliases: [
      project.file,
      project.file.replace(/\.html$/i, ''),
      project.name.replace(/ /g, '-'),
    ],
    selfLines: null,
  };
}

function programsInDir(dir) {
  const key = String(dir || '').toUpperCase();
  if (key === '') {
    const names = ROOT_SYSTEM_FILE_META.map(meta => meta.name)
      .concat(programStoryRootNames())
      .concat(['WELCOME.README', 'FILES']);
    return names.map(name => programEntry(name, '')).filter(Boolean);
  }
  if (key === 'PROJECTS') return PROJECTS.map(programProjectEntry);
  return [];
}

// Delegates to vfsNormalizeDir rather than parsing paths itself: its prefix
// regex is anchored /^C:\\sleepOS(?:\\|$)/i, so it already maps 'C:\sleepOS'
// to '' and 'C:\sleepOS\PROJECTS' to 'PROJECTS', and reusing it means PATH
// cannot drift from how every other path in the VFS is read.
//
// Empties are dropped BEFORE normalizing, and that ordering is load-bearing:
// vfsNormalizeDir('') returns '', which IS the root, so a trailing semicolon
// in `SET PATH=C:\sleepOS\DOCS;` would splice the root back onto PATH and
// leave every root program resolvable from everywhere - the feature looking
// broken in exactly the case someone is testing it.
function programPathDirs(pathValue) {
  const seen = new Set();
  const dirs = [];
  String(pathValue == null ? '' : pathValue).split(';').forEach(raw => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const dir = vfsNormalizeDir(trimmed);
    if (seen.has(dir)) return;
    seen.add(dir);
    dirs.push(dir);
  });
  return dirs;
}

function programMatches(entry, key) {
  if (entry.name.toLowerCase() === key) return true;
  if (entry.name.toLowerCase() === key + '.exe') return true;
  return entry.aliases.some(alias => String(alias).toLowerCase() === key);
}

function programFindIn(dir, key) {
  return programsInDir(dir).find(entry => programMatches(entry, key)) || null;
}

// cmd.exe order: the current directory first, then PATH. Not a fidelity
// flourish - it is what keeps a cleared PATH from putting daemon.core and
// ?????.exe permanently out of reach in a persisted filesystem, since both
// live at the root and the root is where a player stands.
function programResolve(name, cwd, pathValue) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  const cwdDir = vfsNormalizeDir(cwd || '');
  const inCwd = programFindIn(cwdDir, key);
  if (inCwd) return { program: inCwd, dir: cwdDir, via: 'cwd' };
  const dirs = programPathDirs(pathValue);
  for (let i = 0; i < dirs.length; i++) {
    if (dirs[i] === cwdDir) continue; // already searched
    const hit = programFindIn(dirs[i], key);
    if (hit) return { program: hit, dir: dirs[i], via: 'path' };
  }
  return null;
}

// PATH-ignoring lookup. Its only caller is the terminal's failure path, which
// turns a miss into "X exists in C:\sleepOS, which is not on PATH." Without
// that line a player who breaks PATH concludes the OS is broken rather than
// that they broke it, which is why programResolve returns null instead of
// throwing: the caller needs a second look to explain the first.
function programFindAnywhere(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  const dirs = ['', 'PROJECTS'];
  for (let i = 0; i < dirs.length; i++) {
    const hit = programFindIn(dirs[i], key);
    if (hit) return { program: hit, dir: dirs[i] };
  }
  return null;
}

function programDisplayDir(dir) {
  const key = vfsNormalizeDir(dir || '');
  return key ? 'C:\\sleepOS\\' + key : 'C:\\sleepOS';
}
// ── Settings bootstrap (must be early so BIOS skip works) ────────
const SETTINGS_KEY = 'sleepOS-settings';
const FORCE_BOOT_SESSION_KEY = 'sleepOS-force-boot';
const osSettings = { crtScanlines: true, videoDither: true, clock12h: false, skipBoot: false, sounds: true, soundVolume: 0.6 };
try { Object.assign(osSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch(e) {}

// ── Registry data ─────────────────────────────────────────────────
const REG_KEY = 'sleepOS-registry';
const SYSTEM_WALLPAPER_DIR = 'SYS\\WALLPAPERS';
const DEFAULT_WALLPAPER_PATH = SYSTEM_WALLPAPER_DIR + '\\DEFAULT.JPG';
const USER_VIDEO_DIR = 'VIDEOS';
const USER_MUSIC_DIR = 'MUSIC';
const PRELOADED_MEDIA_BASE_URL = 'https://pub-1e78b32b6c14474da39103ed015fc3c9.r2.dev';
function encodeAssetPath(path) {
  return String(path || '')
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}
function getPreloadedAssetUrl(objectName, fallbackLocalPath) {
  if (PRELOADED_MEDIA_BASE_URL) {
    return PRELOADED_MEDIA_BASE_URL.replace(/\/+$/, '') + '/' + encodeAssetPath(objectName);
  }
  return encodeAssetPath(fallbackLocalPath || objectName);
}
const SEEDED_HOME_MEDIA = [
  { path: USER_VIDEO_DIR + '\\bunnies and furry friends.mp4', assetUrl: getPreloadedAssetUrl('bunnies and furry friends.mp4', 'videos/bunnies and furry friends.mp4'), kind: 'video', mime: 'video/mp4', size: 421218044 },
  { path: USER_VIDEO_DIR + '\\Dragonball_HG_EP01.mp4', assetUrl: getPreloadedAssetUrl('Dragonball_HG_EP01.mp4', 'videos/Dragonball_HG_EP01.mp4'), kind: 'video', mime: 'video/mp4', size: 306739027 },
  { path: USER_VIDEO_DIR + '\\lain.mp4', assetUrl: getPreloadedAssetUrl('lain-web.mp4', 'videos/lain-web.mp4'), kind: 'video', mime: 'video/mp4', size: 269121971 },
  { path: USER_VIDEO_DIR + '\\Tcz62PMls-I.webm', assetUrl: getPreloadedAssetUrl('Tcz62PMls-I.webm', 'videos/Tcz62PMls-I.webm'), kind: 'video', mime: 'video/webm', size: 2295519 },
  { path: USER_VIDEO_DIR + '\\Theory Of Angel.mkv', assetUrl: getPreloadedAssetUrl('Theory Of Angel.mkv', 'videos/Theory Of Angel.mkv'), kind: 'video', mime: 'video/x-matroska', size: 31040788 },
  { path: USER_MUSIC_DIR + '\\hum.wav', assetUrl: getPreloadedAssetUrl('hum.wav', 'audio/hum.wav'), kind: 'audio', mime: 'audio/wav', size: 12815618, author: 'Alex McCulloch' },
  { path: USER_MUSIC_DIR + '\\Hello There.mp3', assetUrl: getPreloadedAssetUrl('Hello There.mp3', 'audio/Hello there.mp3'), kind: 'audio', mime: 'audio/mpeg', size: 735225, author: 'Alex McCulloch' },
  { path: USER_MUSIC_DIR + '\\Space++.mp3', assetUrl: getPreloadedAssetUrl('Space++.mp3', 'audio/Space++.mp3'), kind: 'audio', mime: 'audio/mpeg', size: 5753711, author: 'Alex McCulloch' },
];
const LEGACY_BUILTIN_WALLPAPER_IDS = new Set(['default', 'magicant', 'hills', 'battle', 'summers', 'saturn', 'cave']);
const SEEDED_WALLPAPERS = [
  { path: DEFAULT_WALLPAPER_PATH, label: 'Default', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/default.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\CITY.JPG', label: 'City', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/city.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\CRAFT.PNG', label: 'Craft', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/craft.png', mime: 'image/png' },
  { path: SYSTEM_WALLPAPER_DIR + '\\DARK.JPG', label: 'Dark', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/dark.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\FOREST.PNG', label: 'Forest', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/forest.png', mime: 'image/png' },
  { path: SYSTEM_WALLPAPER_DIR + '\\HILLS.JPG', label: 'Hills', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/hills.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\OCEAN.GIF', label: 'Ocean', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/ocean.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\POWERLINES.JPG', label: 'Powerlines', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/powerlines.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\REBIRTH.GIF', label: 'Rebirth', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/rebirth.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\SPACE.PNG', label: 'Space', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/space.png', mime: 'image/png' },
  { path: SYSTEM_WALLPAPER_DIR + '\\STATIC.GIF', label: 'Static', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/static.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\WATCHING.GIF', label: 'Watching', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/watching.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\WAVES.GIF', label: 'Waves', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/waves.gif', mime: 'image/gif' },
];
const SEEDED_WALLPAPER_MAP = new Map(SEEDED_WALLPAPERS.map(item => [item.path, item]));
const registryData = {
  'HKEY_CLASSES_ROOT': {
    'Associations\\Text': {
      '.txt':    { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.md':     { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.json':   { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.js':     { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.css':    { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.html':   { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.log':    { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.script': { type:'REG_SZ', value:'NOTEPAD.exe' },
    },
    'Associations\\Media': {
      '.png':  { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.jpg':  { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.jpeg': { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.gif':  { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.webp': { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.mp3':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.wav':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.mp4':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.webm': { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.mkv':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
    },
  },
  'HKEY_SLEEPBOX_MACHINE': {
    'SYSTEM\\CurrentConfig': {
      CRT_SCANLINES:      { type:'REG_DWORD', value: 1 },
      VIDEO_DITHER:       { type:'REG_DWORD', value: 1 },
      CLOCK_FORMAT:       { type:'REG_SZ',    value: '24h' },
    },
    'SOUL\\Metrics': {
      SOUL_INTEGRITY:     { type:'REG_DWORD', value: 87 },
      DAEMON_COUNT:       { type:'REG_DWORD', value: 7  },
      TEMPORAL_DRIFT:     { type:'REG_SZ',    value: '+/-2.3yr' },
    },
    'VOID': {
      VOID_PRESSURE_BASE: { type:'REG_DWORD', value: 12 },
      OBSERVER_COUNT:     { type:'REG_SZ',    value: '[classified]' },
    },
    'Containment': {
      RESPAWN_LOCK:       { type:'REG_DWORD', value: 1 },
      MIRROR_LOCK:        { type:'REG_DWORD', value: 1 },
      ANCHOR_FILE:        { type:'REG_SZ',    value: 'SYS\\anchor.seed' },
    },
  },
  'HKEY_CURRENT_USER': {
    'Desktop': {
      Wallpaper:          { type:'REG_SZ',    value: DEFAULT_WALLPAPER_PATH },
    },
    'SOFTWARE\\sleepOS': {
      SkipBoot:           { type:'REG_DWORD', value: 0 },
      IdleSleepMinutes:   { type:'REG_DWORD', value: 10 },
      SoundEnabled:       { type:'REG_DWORD', value: 1 },
      SoundVolume:        { type:'REG_DWORD', value: 60 },
    },
    'SOFTWARE\\sleepOS\\Daemon': {
      STATUS:             { type:'REG_SZ',    value: 'Dormant' },
      LAST_EVENT:         { type:'REG_SZ',    value: 'none' },
      OBSERVED:           { type:'REG_DWORD', value: 0 },
    },
  },
};

// ── File associations ─────────────────────────────────────────────
// Which app opens a file type is read from HKEY_CLASSES_ROOT at open time,
// so editing the value in REGEDIT.exe actually changes the behaviour. The
// defaults below reproduce what was previously hardcoded, so nothing changes
// until someone edits the registry.
// Deliberately unchecked: any handler may be pointed at any file type. Opening
// a video in NOTEPAD.exe is allowed, the same way a real OS lets you. The only
// thing guarded is the destructive part -- see the blob check in
// vfsWriteFile, which throws EEXIST rather than letting a save shadow the
// binary.
const FILE_HANDLERS = {
  'NOTEPAD.exe':   (name, dir) => openNotepad(name, dir),
  'IMAGEVIEW.exe': (name, dir) => openImageViewer(name, dir),
  'MEDIAPLAY.exe': (name, dir) => {
    // Blob metadata only, so this stays synchronous.
    const st = vfsStatSync(name, dir);
    const kind = st?.blob?.kind || inferBlobKindFromName(name);
    if (kind === 'video') openVideoPlayer(name, dir);
    else openAudioPlayer(name, dir);
  },
  'TERMINAL.exe':  (name, dir) => runScriptInTerminal(name, dir),
  'BROWSER.exe':   () => openBrowser(),
};

// Returns the configured app for a filename's extension, or '' if unassociated.
function getFileAssociation(fileName) {
  const dot = String(fileName || '').lastIndexOf('.');
  if (dot < 0) return '';
  const ext = String(fileName).slice(dot).toLowerCase();
  const hive = registryData['HKEY_CLASSES_ROOT'];
  if (!hive) return '';
  for (const keyPath of Object.keys(hive)) {
    const entry = hive[keyPath][ext];
    if (entry && entry.value) return String(entry.value);
  }
  return '';
}

// Open a file through its registry association. Returns false when there is no
// association or the named app is unknown, so callers keep their own fallback.
function openWithAssociation(fileName, dirName) {
  const app = getFileAssociation(fileName);
  if (!app) return false;
  const key = Object.keys(FILE_HANDLERS).find(k => k.toLowerCase() === app.toLowerCase());
  if (!key) return false;
  FILE_HANDLERS[key](fileName, dirName);
  return true;
}

try {
  const saved = JSON.parse(localStorage.getItem(REG_KEY) || 'null');
  if (saved) {
    Object.keys(saved).forEach(hive => {
      if (!registryData[hive]) return;
      Object.keys(saved[hive]).forEach(path => {
        if (!registryData[hive][path]) return;
        Object.keys(saved[hive][path]).forEach(key => {
          if (registryData[hive][path][key]) registryData[hive][path][key].value = saved[hive][path][key].value;
        });
      });
    });
  }
} catch(e) {}
const DEFAULT_IDLE_SLEEP_MINUTES = 10;
const MIN_IDLE_SLEEP_MINUTES = 1;
function normalizeIdleSleepMinutes(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_IDLE_SLEEP_MINUTES;
  return Math.max(MIN_IDLE_SLEEP_MINUTES, parsed);
}
function getIdleSleepMinutes() {
  return normalizeIdleSleepMinutes(registryData['HKEY_CURRENT_USER']?.['SOFTWARE\\sleepOS']?.IdleSleepMinutes?.value);
}
function getIdleSleepMs() {
  return getIdleSleepMinutes() * 60 * 1000;
}
// Stored as a REG_DWORD percentage because that is what a registry value looks
// like; osSettings.soundVolume carries the 0..1 the gain node wants. REGEDIT
// can be pointed at this key by hand, so anything out of range is clamped
// rather than trusted. DEFAULT_SOUND_VOLUME lives in os/audio.js, which the
// bundle reaches after this file - safe here because nothing calls this during
// evaluation, only from applyRegistrySettings and the Settings window.
function normalizeSoundVolumePercent(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return Math.round(DEFAULT_SOUND_VOLUME * 100);
  return Math.max(0, Math.min(100, parsed));
}
registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS'].IdleSleepMinutes.value = getIdleSleepMinutes();
function saveRegistry() {
  const out = {};
  Object.keys(registryData).forEach(hive => {
    out[hive] = {};
    Object.keys(registryData[hive]).forEach(path => {
      out[hive][path] = {};
      Object.keys(registryData[hive][path]).forEach(key => {
        out[hive][path][key] = { value: registryData[hive][path][key].value };
      });
    });
  });
  try { localStorage.setItem(REG_KEY, JSON.stringify(out)); } catch(e) {}
}
function applyRegistrySettings() {
  const cc = registryData['HKEY_SLEEPBOX_MACHINE']['SYSTEM\\CurrentConfig'];
  const cu = registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS'];
  osSettings.crtScanlines = !!cc.CRT_SCANLINES.value;
  osSettings.videoDither   = !!cc.VIDEO_DITHER.value;
  osSettings.clock12h      = cc.CLOCK_FORMAT.value === '12h';
  osSettings.skipBoot      = !!cu.SkipBoot.value;
  osSettings.sounds        = !!cu.SoundEnabled.value;
  osSettings.soundVolume   = normalizeSoundVolumePercent(cu.SoundVolume.value) / 100;
  cu.IdleSleepMinutes.value = getIdleSleepMinutes();
  saveSettings();
  applySettings();
}

// WALLPAPERS

const WALLPAPER_FILE_PREFIX = 'FILE:';
let currentWallpaper = DEFAULT_WALLPAPER_PATH;

function isWallpaperFileId(id) {
  return typeof id === 'string' && id.startsWith(WALLPAPER_FILE_PREFIX);
}

function normalizeWallpaperPath(path, fallbackDir) {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  if (isWallpaperFileId(raw)) return normalizeWallpaperPath(raw.slice(WALLPAPER_FILE_PREFIX.length), fallbackDir);
  if (LEGACY_BUILTIN_WALLPAPER_IDS.has(raw.toLowerCase())) return DEFAULT_WALLPAPER_PATH;
  const { dirName, fileName } = fsSplitPath(raw, fallbackDir);
  return fileName ? blobRelativePath(dirName, fileName) : '';
}

function isSystemWallpaperPath(path) {
  const normalized = normalizeWallpaperPath(path);
  return normalized === SYSTEM_WALLPAPER_DIR || normalized.startsWith(SYSTEM_WALLPAPER_DIR + '\\');
}

// Wallpaper paths come from the registry and from localStorage, so their case
// may not match the tree. vfsStatSync is case-sensitive for files and blobs, so
// the fallback scan stays - exact hit first, then a case-insensitive sweep.
function findBlobEntryInsensitive(dirName, fileName) {
  if (!fileName) return null;
  const entries = vfsListSync(dirName).filter(entry => entry.kind === 'blob');
  const exact = entries.find(entry => entry.name === fileName);
  if (exact) return exact;
  const target = String(fileName).toUpperCase();
  return entries.find(entry => String(entry.name).toUpperCase() === target) || null;
}

function resolveWallpaperEntry(path, fallbackDir) {
  const normalized = normalizeWallpaperPath(path, fallbackDir);
  if (!normalized) return null;
  const { dirName, fileName } = vfsSplitPath(normalized);
  const entry = findBlobEntryInsensitive(dirName, fileName);
  if (!entry || entry.blob?.kind !== 'image') return null;
  return { dirName, fileName: entry.name, path: blobRelativePath(dirName, entry.name), blob: entry.blob };
}

function getWallpaperRegistryValue() {
  return registryData['HKEY_CURRENT_USER']?.Desktop?.Wallpaper?.value || '';
}

function setWallpaperRegistryValue(path) {
  const entry = registryData['HKEY_CURRENT_USER']?.Desktop?.Wallpaper;
  if (!entry) return;
  entry.value = path;
  saveRegistry();
}

function syncWallpaperSwatches() {
  document.querySelectorAll('.wp-swatch').forEach(swatch => {
    swatch.classList.toggle('wp-selected', swatch.dataset.id === currentWallpaper);
  });
}

function getInitialWallpaperPath() {
  const rawRegistry = String(getWallpaperRegistryValue() || '').trim();
  const rawSaved = String(localStorage.getItem(WP_KEY) || '').trim();
  const registryPath = normalizeWallpaperPath(rawRegistry);
  const savedPath = normalizeWallpaperPath(rawSaved);
  const registryWasLegacyDefault = rawRegistry && LEGACY_BUILTIN_WALLPAPER_IDS.has(rawRegistry.toLowerCase());
  if (savedPath && (!registryPath || registryWasLegacyDefault)) return savedPath;
  return registryPath || savedPath || DEFAULT_WALLPAPER_PATH;
}

function wallpaperFileId(path, fallbackDir) {
  const normalized = normalizeWallpaperPath(path, fallbackDir);
  return normalized ? WALLPAPER_FILE_PREFIX + normalized : '';
}

function wallpaperFilePath(id) {
  return normalizeWallpaperPath(id);
}

function getUploadedWallpaperChoices() {
  const items = [];
  // The final sort below is total, so traversal order does not matter; the
  // directories are still visited in name order to keep the walk stable.
  function walk(dirPath) {
    const entries = vfsListSync(dirPath);
    entries.forEach(entry => {
      if (entry.kind !== 'blob' || entry.blob?.kind !== 'image') return;
      const relPath = blobRelativePath(dirPath, entry.name);
      items.push({
        id: relPath,
        name: (SEEDED_WALLPAPER_MAP.get(relPath) || {}).label || entry.name.replace(/\.[^.]+$/, ''),
        path: relPath,
        url: entry.blob.url,
        system: isSystemWallpaperPath(relPath),
      });
    });
    entries
      .filter(entry => entry.kind === 'dir')
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b))
      .forEach(subName => walk(dirPath ? dirPath + '\\' + subName : subName));
  }
  walk('');
  return items.sort((a, b) => {
    if (a.system !== b.system) return a.system ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
}

function renderWallpaperSwatch(grid, choice) {
  const item = document.createElement('div');
  item.dataset.id = choice.id;
  item.className = 'wp-swatch' + (choice.id === currentWallpaper ? ' wp-selected' : '');
  item.title = `C:\\sleepOS\\${choice.path}`;
  item.style.cssText = 'cursor:default;display:flex;flex-direction:column;align-items:center;gap:3px;';

  const thumb = document.createElement('div');
  thumb.className = 'wp-thumb';
  thumb.style.cssText = 'width:72px;height:50px;box-sizing:border-box;overflow:hidden;flex-shrink:0;background:#c0c0c0;';

  const img = document.createElement('img');
  img.src = choice.url;
  img.alt = choice.name;
  img.draggable = false;
  thumb.appendChild(img);

  const label = document.createElement('div');
  label.style.cssText = 'font-size:10px;text-align:center;line-height:1.25;max-width:84px;word-break:break-word;';
  label.textContent = choice.name;
  item.appendChild(thumb);
  item.appendChild(label);

  const meta = document.createElement('div');
  meta.textContent = choice.path.replace(/\\[^\\]+$/, '') || 'Root';
  meta.style.cssText = 'font-size:9px;color:#555;text-align:center;line-height:1.1;max-width:84px;word-break:break-word;';
  item.appendChild(meta);

  item.addEventListener('click', () => applyWallpaper(choice.path));
  grid.appendChild(item);
}

function renderWallpaperSection(gridId, choices, emptyText) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (!choices.length) {
    grid.innerHTML = `<div style="grid-column:1 / -1;padding:8px 10px;border:2px solid;border-color:#808080 #fff #fff #808080;background:#d4d0c8;font-size:10px;line-height:1.4;">${emptyText}</div>`;
    return;
  }
  choices.forEach(choice => renderWallpaperSwatch(grid, choice));
}

function renderAppearanceWindow() {
  const body = document.getElementById('wb-appearance');
  if (!body) return;
  const choices = getUploadedWallpaperChoices();
  const systemWallpapers = choices.filter(choice => choice.system);
  const otherWallpapers = choices.filter(choice => !choice.system);
  body.style.cssText = 'padding:10px;overflow:auto;';
  body.innerHTML = `
    <div style="font-size:11px;margin-bottom:8px;">Wallpaper</div>
    <div style="font-size:10px;font-weight:bold;margin-bottom:4px;">SYS\\WALLPAPERS</div>
    <div id="wp-grid-system" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;"></div>
    <div style="font-size:10px;font-weight:bold;margin-bottom:4px;">Other Image Files</div>
    <div id="wp-grid-uploaded" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;"></div>
    <div id="wp-upload-note" style="font-size:10px;line-height:1.4;margin-top:10px;color:#333;"></div>`;

  renderWallpaperSection('wp-grid-system', systemWallpapers, 'System wallpaper files will appear here.');
  renderWallpaperSection('wp-grid-uploaded', otherWallpapers, 'Upload an image anywhere in File Explorer, or add more files under SYS\\WALLPAPERS.');
  const note = document.getElementById('wp-upload-note');
  note.textContent = 'Right-click any image to set it as your wallpaper.';
}

function refreshAppearanceWindow() {
  if (document.getElementById('wb-appearance')) renderAppearanceWindow();
}

function applyWallpaperColorFallback() {
  const bg = document.getElementById('desktop-bg');
  if (!bg) return false;
  currentWallpaper = '';
  bg.style.cssText = 'background:#008080;';
  syncWallpaperSwatches();
  return false;
}

function applyWallpaper(path, options = {}) {
  const { deferMissing = false, updateRegistry = true } = options;
  const bg = document.getElementById('desktop-bg');
  if (!bg) return false;

  const resolved = resolveWallpaperEntry(path);
  if (resolved) {
    currentWallpaper = resolved.path;
    bg.style.cssText = `background-color:#c0c0c0;background-image:url("${resolved.blob.url}");background-position:center;background-size:cover;background-repeat:no-repeat;`;
    try { localStorage.setItem(WP_KEY, resolved.path); } catch (e) {}
    if (updateRegistry) setWallpaperRegistryValue(resolved.path);
    syncWallpaperSwatches();
    return true;
  }

  return applyWallpaperColorFallback();
}

function handleWallpaperFileRename(dirPath, oldName, newName) {
  const oldPath = normalizeWallpaperPath(blobRelativePath(dirPath, oldName));
  const newPath = normalizeWallpaperPath(blobRelativePath(dirPath, newName));
  const savedPath = normalizeWallpaperPath(localStorage.getItem(WP_KEY));
  const registryPath = normalizeWallpaperPath(getWallpaperRegistryValue());
  if (currentWallpaper === oldPath || savedPath === oldPath || registryPath === oldPath) {
    applyWallpaper(newPath);
  } else {
    refreshAppearanceWindow();
  }
}

function handleWallpaperFileDelete(dirPath, name) {
  const deletedPath = normalizeWallpaperPath(blobRelativePath(dirPath, name));
  const savedPath = normalizeWallpaperPath(localStorage.getItem(WP_KEY));
  const registryPath = normalizeWallpaperPath(getWallpaperRegistryValue());
  if (currentWallpaper === deletedPath || savedPath === deletedPath || registryPath === deletedPath) {
    applyWallpaper(DEFAULT_WALLPAPER_PATH);
  } else {
    refreshAppearanceWindow();
  }
}

function openAppearance() {
  if (!mkWin({ id:'appearance', title:'Appearance', icon:'icon:image', w:410, h:360, x:130, y:90, menubar:false, statusbar:false }) && !document.getElementById('wb-appearance')) return;
  renderAppearanceWindow();
}

function openSettings() {
  // 316 = 18px titlebar + 4px borders + the panel's exact content height. The
  // old 294 already left ~70px of dead space below the footer; adding the
  // Sound section without re-measuring would have kept it.
  if (!mkWin({ id:'settings', title:'Settings', icon:'icon:settings', w:390, h:316, x:145, y:95, menubar:false, statusbar:false })) return;
  const body = document.getElementById('wb-settings');
  body.className = 'win-body st-panel';

  body.innerHTML =     `<div class="st-section">Display</div>
     <div class="st-row"><div class="st-label">CRT scan lines</div><button class="st-toggle" data-setting="crtScanlines"></button></div>
     <div class="st-row"><div class="st-label">Video dithering</div><button class="st-toggle" data-setting="videoDither"></button></div>
     <div class="st-section">Sound</div>
     <div class="st-row"><div class="st-label">System sounds</div><button class="st-toggle" data-setting="sounds"></button></div>
     <div class="st-row"><div class="st-label">Volume</div><div class="st-vol vp-vol-blocks" id="settings-volume" role="slider" tabindex="0" aria-label="System volume" aria-valuemin="0" aria-valuemax="100" title="System volume"></div></div>
     <div class="st-section">System</div>
     <div class="st-row"><div class="st-label">12-hour clock</div><button class="st-toggle" data-setting="clock12h"></button></div>

     <div class="st-row"><div class="st-label">Skip boot screen</div><button class="st-toggle" data-setting="skipBoot"></button></div>
     <div class="st-footer">
       <button class="dlg-btn primary" id="settings-open-appearance">Open Appearance</button>
       <button class="dlg-btn" id="settings-close">Close</button>
     </div>`;

  // \u2500\u2500 Volume, drawn as the media player's block meter \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const VOL_BLOCKS = 10;
  const volEl = document.getElementById('settings-volume');
  let volDragging = false;

  function renderVolume() {
    const filled = osSettings.sounds ? Math.round(getSystemVolume() * VOL_BLOCKS) : 0;
    volEl.innerHTML =
      `<span style="color:#000080">${'&#9632;'.repeat(filled)}</span>` +
      `<span style="color:#6a6a6a">${'&#9643;'.repeat(VOL_BLOCKS - filled)}</span>`;
    volEl.classList.toggle('off', !osSettings.sounds);
    volEl.setAttribute('aria-valuenow', String(Math.round(getSystemVolume() * 100)));
  }

  // Quantised to the blocks that are actually drawn: clicking a block should
  // land on that block, not on a continuous value that rounds to its neighbour.
  function setVolumeStep(step) {
    const clamped = Math.max(0, Math.min(VOL_BLOCKS, step));
    osSettings.soundVolume = clamped / VOL_BLOCKS;
    // Dragging a muted slider upwards unmutes, the way every OS mixer does.
    if (clamped > 0 && !osSettings.sounds) osSettings.sounds = true;
  }

  // Live during a drag, but nothing is written to disk until the pointer is
  // released - saveSettings and saveRegistry both hit localStorage, and
  // pointermove fires at frame rate.
  function previewVolume(clientX) {
    // Measured against the content box, not the border box: the blocks are
    // drawn inside 2px of bevel and 6px of padding, and mapping the pointer
    // across the full width would land a click a block away from the one it
    // was aimed at near either end.
    const r = volEl.getBoundingClientRect();
    const cs = getComputedStyle(volEl);
    const inset = n => parseFloat(cs.getPropertyValue(n)) || 0;
    const left = r.left + inset('border-left-width') + inset('padding-left');
    const width = Math.max(1, r.width - inset('border-left-width') - inset('border-right-width')
                                      - inset('padding-left') - inset('padding-right'));
    setVolumeStep(Math.round(((clientX - left) / width) * VOL_BLOCKS));
    applySystemAudioSettings();
    renderVolume();
  }

  function commitVolume() {
    saveSettings();
    applySettings();
    refresh();
    playSound('click');
  }

  // Pointer capture instead of document-level move/up listeners: those would
  // outlive the window and stack up one pair per Settings open.
  volEl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    volDragging = true;
    try { volEl.setPointerCapture(e.pointerId); } catch (err) {}
    previewVolume(e.clientX);
  });
  volEl.addEventListener('pointermove', e => { if (volDragging) previewVolume(e.clientX); });
  volEl.addEventListener('pointerup', e => {
    if (!volDragging) return;
    volDragging = false;
    try { volEl.releasePointerCapture(e.pointerId); } catch (err) {}
    commitVolume();
  });
  volEl.addEventListener('pointercancel', () => {
    if (!volDragging) return;
    volDragging = false;
    commitVolume();
  });
  volEl.addEventListener('keydown', e => {
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1
              : (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    setVolumeStep(Math.round(getSystemVolume() * VOL_BLOCKS) + dir);
    commitVolume();
  });

  function refresh() {
    body.querySelectorAll('[data-setting]').forEach(btn => {
      const key = btn.dataset.setting;
      const enabled = !!osSettings[key];
      btn.classList.toggle('on', enabled);
      btn.textContent = enabled ? 'ON' : 'OFF';
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    });
    renderVolume();
  }

  body.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.setting;
      osSettings[key] = !osSettings[key];
      saveSettings();
      applySettings();
      refresh();
      // The click feedback on this button fires at pointerdown, while sound is
      // still off, so switching it on would otherwise be silent - the one
      // control whose effect you most want to hear.
      if (key === 'sounds' && osSettings.sounds) playSound('click');
    });
  });

  document.getElementById('settings-open-appearance').addEventListener('click', openAppearance);
  document.getElementById('settings-close').addEventListener('click', () => closeWin('settings'));
  refresh();
}
// ─────────────────────────────────────────────────────────────────
// SYSTEM AUDIO
// ─────────────────────────────────────────────────────────────────
// One AudioContext for the whole OS, chosen over <audio> elements for three
// reasons that all show up in this codebase:
//
//   - The Settings volume is one assignment on a master gain node, not a walk
//     over every element that happens to be playing.
//   - ctx.suspend() silences everything on tab-hide in a single call, with no
//     bookkeeping about what was mid-playback and no restart glitch on the way
//     back. Scheduled times are expressed against ctx.currentTime, which stops
//     advancing while suspended, so a loop resumes exactly where it froze.
//   - Overlapping one-shots (a click during a glitch, two clicks in 40ms) come
//     free. HTMLAudioElement restarts the single element instead, so the usual
//     workaround is cloneNode per shot.
//
// The context cannot exist before a user gesture: browsers create it suspended
// and refuse to resume it. Every entry point here is therefore a no-op until
// unlockSystemAudio() has run, and no caller has to check - playSound and
// startSoundLoop are safe to call at any time, including during boot, and
// startSoundLoop remembers the request so the loop begins at the first click.

const SOUND_DIR = 'os/sounds/';
const SOUND_FILES = {
  ambience: 'computerAmbience.ogg',
  boot:     'win95Start.ogg',
  shutdown: 'ShutdownJingle.ogg',
  defrag:   'defrag.ogg',
  error:    'error.ogg',
  glitch:   'glitch.ogg',
  click:    'mouseClick.ogg',
};

// Per-sound trim, so the mix lives in one table instead of being spread across
// call sites. These multiply the master volume from Settings. The ambience is
// deliberately far below everything else: it plays for the whole session and
// is meant to sit under the OS, not in front of it.
const SOUND_GAIN = {
  ambience: 0.40,
  boot:     0.75,
  shutdown: 0.75,
  defrag:   0.40,
  error:    0.65,
  glitch:   0.50,
  click:    0.30,
};

// defrag.ogg does not loop seamlessly and a slow run can outlast its ~1 minute,
// so its tail is overlapped with its head by this much. Long enough to bury the
// discontinuity in drive chatter, short enough that the overlap is not heard as
// a doubling. A seam-matched source file would let this drop to 0 and use the
// seamless path below instead.
const DEFRAG_CROSSFADE_SEC = 0.35;
// The monitor sleeps; the machine does not. Ambience drops to this while the
// idle-sleep overlay is up rather than stopping.
const AMBIENCE_SLEEP_DUCK = 0.3;
// exponentialRampToValueAtTime cannot reach or cross zero.
const GAIN_FLOOR = 0.0001;
const DEFAULT_SOUND_VOLUME = 0.6;
// How long the master takes to reach silence before the context is suspended
// on tab-hide, and to come back after it resumes. Long enough that the output
// lands on silence instead of stepping to it, short enough that a quick flick
// to another tab and back does not sound like a fade effect.
const HIDE_FADE_SEC = 0.18;

let audioCtx = null;
let audioMaster = null;
let audioUnlocked = false;
let audioSuspendedByHide = false;
let audioHideFadeTimer = null;
let systemAudioInited = false;
const audioBuffers = new Map();
const audioLoads = new Map();
// name -> { volume, crossfade, duck, active, buffer, gain, passes:Set, nextStart }
const audioLoops = new Map();

function systemAudioEnabled() {
  return osSettings.sounds !== false;
}

function getSystemVolume() {
  const v = Number(osSettings.soundVolume);
  if (!Number.isFinite(v)) return DEFAULT_SOUND_VOLUME;
  return Math.max(0, Math.min(1, v));
}

function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch (e) {
    return null;
  }
  audioMaster = audioCtx.createGain();
  audioMaster.gain.value = masterTargetGain();
  audioMaster.connect(audioCtx.destination);
  return audioCtx;
}

// Called from the gesture listeners at the bottom of this file, and again by
// them if a resume() was ever rejected, so a revoked activation heals on the
// next click instead of leaving the OS permanently silent.
function unlockSystemAudio() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (audioUnlocked && ctx.state === 'running') return;
  if (ctx.state === 'running') { markAudioUnlocked(); return; }
  ctx.resume().then(markAudioUnlocked).catch(() => {});
}

function markAudioUnlocked() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  audioUnlocked = true;
  // Loops asked for before the first gesture - the desktop ambience starts
  // during boot - have been waiting on exactly this.
  audioLoops.forEach((entry, name) => { if (entry.active) primeLoop(name, entry); });
}

function loadSound(name) {
  if (audioBuffers.has(name)) return Promise.resolve(audioBuffers.get(name));
  const pending = audioLoads.get(name);
  if (pending) return pending;
  const file = SOUND_FILES[name];
  const ctx = ensureAudioContext();
  if (!file || !ctx) return Promise.resolve(null);
  const load = fetch(SOUND_DIR + file)
    .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer(); })
    .then(data => ctx.decodeAudioData(data))
    .then(buffer => { audioBuffers.set(name, buffer); return buffer; })
    .catch(() => {
      // A missing or undecodable sound must never break the thing it decorates.
      // Forgetting the rejection lets a later call retry rather than caching
      // the failure for the rest of the session.
      audioLoads.delete(name);
      return null;
    });
  audioLoads.set(name, load);
  return load;
}

// Fire-and-forget one-shot. `volume` is a multiplier on the sound's entry in
// SOUND_GAIN, for callers that vary intensity (see triggerGlitch).
//
// Returns a promise resolving to how many milliseconds the sound will play for,
// or 0 if it did not play at all - for callers that need to sequence something
// after it, like the shutdown flow holding the screen until the jingle is done.
// Nearly every caller ignores it.
//
// It resolves when playback STARTS, not when it ends, and that is deliberate:
// an `ended` event never arrives if a tab switch suspends the context mid-sound,
// so a caller awaiting the end could wait forever. Resolving with the duration
// up front lets the caller decide its own deadline against the wall clock.
function playSound(name, options = {}) {
  if (!audioUnlocked || !systemAudioEnabled() || document.hidden) return Promise.resolve(0);
  const scale = Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1;
  return loadSound(name).then(buffer => {
    // Re-checked after the decode: on the very first play of a sound this
    // resolves a frame or more later, by which time the tab may be hidden or
    // the user may have switched sound off.
    if (!buffer || !audioUnlocked || !systemAudioEnabled() || document.hidden) return 0;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = Math.max(0, (SOUND_GAIN[name] ?? 0.5) * scale);
    src.connect(gain);
    gain.connect(audioMaster);
    src.onended = () => { try { src.disconnect(); gain.disconnect(); } catch (e) {} };
    src.start();
    return Math.round(buffer.duration * 1000);
  });
}

// Idempotent: calling this on an already-running loop does nothing, so a
// caller does not have to track whether it already started one.
function startSoundLoop(name, options = {}) {
  let entry = audioLoops.get(name);
  if (!entry) {
    entry = {
      volume: SOUND_GAIN[name] ?? 0.5,
      crossfade: 0,
      duck: 1,
      active: false,
      buffer: null,
      gain: null,
      passes: new Set(),
      nextStart: 0,
    };
    audioLoops.set(name, entry);
  }
  // Re-read on every start rather than only at creation. The entry outlives the
  // loop - stopping keeps it so `duck` survives - and reading the option once
  // would mean the second start of a sound silently used the first one's
  // scheduling mode.
  if ('crossfade' in options) entry.crossfade = Math.max(0, Number(options.crossfade) || 0);
  if (entry.active) return;
  entry.active = true;
  primeLoop(name, entry);
}

function stopSoundLoop(name, options = {}) {
  const entry = audioLoops.get(name);
  if (!entry) return;
  entry.active = false;
  stopLoopPasses(entry, Math.max(0, Number(options.fade) || 0));
}

function primeLoop(name, entry) {
  if (!audioUnlocked || !systemAudioEnabled()) return;
  if (entry.passes.size) return;
  loadSound(name).then(buffer => {
    // Same re-check as playSound: the first prime waits on a decode, and the
    // loop may have been stopped in the meantime.
    if (!buffer || !entry.active || !audioUnlocked || !systemAudioEnabled()) return;
    if (entry.passes.size) return;
    entry.buffer = buffer;

    if (!entry.gain) {
      entry.gain = audioCtx.createGain();
      entry.gain.connect(audioMaster);
    }
    // Always reset: a previous stop may have left this ramped down to the floor.
    const now = audioCtx.currentTime;
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(Math.max(GAIN_FLOOR, entry.volume * entry.duck), now);

    if (!entry.crossfade) {
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(entry.gain);
      entry.passes.add(src);
      src.start();
      return;
    }

    // Crossfaded loop. Two passes are queued up front and every pass queues the
    // one two ahead of it when it ends. Chaining a single pass on `ended` would
    // always be late by exactly the crossfade length, because pass N+1 has to
    // START before pass N finishes - so the schedule runs one pass deep. With a
    // one-minute file and a 350ms overlap that is ~59 seconds of lead, and it
    // needs no timers: setTimeout is throttled in a background tab, while
    // buffer sources are scheduled against ctx.currentTime, which is frozen for
    // exactly as long as the context is suspended.
    entry.nextStart = audioCtx.currentTime + 0.02;
    queueLoopPass(entry);
    queueLoopPass(entry);
  });
}

function queueLoopPass(entry) {
  const buffer = entry.buffer;
  if (!buffer) return;
  const fade = Math.min(entry.crossfade, buffer.duration / 3);
  const at = entry.nextStart;
  entry.nextStart = at + Math.max(0.05, buffer.duration - fade);

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  src.connect(gain);
  gain.connect(entry.gain);

  // Equal-gain in and out across the overlap. The pass envelope peaks at 1 and
  // entry.gain carries the trim, so volume and ducking stay one node away from
  // the scheduling.
  gain.gain.setValueAtTime(GAIN_FLOOR, at);
  gain.gain.exponentialRampToValueAtTime(1, at + fade);
  gain.gain.setValueAtTime(1, at + buffer.duration - fade);
  gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, at + buffer.duration);

  // So stopLoopPasses can tear the pair down without closing over this scope.
  src._passGain = gain;
  entry.passes.add(src);
  src.onended = () => {
    entry.passes.delete(src);
    try { src.disconnect(); gain.disconnect(); } catch (e) {}
    if (entry.active && audioUnlocked && systemAudioEnabled()) queueLoopPass(entry);
  };
  src.start(at);
}

// Tears down the sources without clearing `active`, so the caller decides
// whether this is a stop or a pause that should re-prime later.
function stopLoopPasses(entry, fadeSec) {
  const passes = [...entry.passes];
  entry.passes.clear();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  if (entry.gain && fadeSec > 0) {
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(Math.max(GAIN_FLOOR, entry.gain.gain.value), now);
    entry.gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, now + fadeSec);
  }
  passes.forEach(src => {
    // Replaced, not dropped, and the disconnect happens in it rather than
    // here: the handler being replaced is the one that queues the next pass,
    // and a stop must not schedule more audio on its way out - but
    // disconnecting a node that is still fading cuts it dead and there is no
    // fade left to hear.
    src.onended = () => {
      try { src.disconnect(); } catch (e) {}
      try { if (src._passGain) src._passGain.disconnect(); } catch (e) {}
    };
    try { fadeSec > 0 ? src.stop(now + fadeSec) : src.stop(); } catch (e) {}
  });
}

// Ramps a running loop to `factor` of its normal level and keeps it there.
// The factor is remembered, so a loop ducked while stopped comes back ducked.
function duckSoundLoop(name, factor, seconds = 0.6) {
  const entry = audioLoops.get(name);
  if (!entry) return;
  entry.duck = Math.max(0, Math.min(1, Number(factor) || 0));
  if (!entry.gain || !audioCtx) return;
  const now = audioCtx.currentTime;
  entry.gain.gain.cancelScheduledValues(now);
  entry.gain.gain.setValueAtTime(Math.max(GAIN_FLOOR, entry.gain.gain.value), now);
  entry.gain.gain.exponentialRampToValueAtTime(
    Math.max(GAIN_FLOOR, entry.volume * entry.duck), now + Math.max(0.01, seconds));
}

// Where the master gain belongs right now. Floored rather than allowed to
// reach a true zero: every ramp here is exponential, and an exponential ramp
// cannot start from or cross zero - parking the master at exactly 0 would mean
// the next fade back up did nothing at all. GAIN_FLOOR is -80dB, so the
// difference from silence is not a thing anyone can hear.
function masterTargetGain() {
  return Math.max(GAIN_FLOOR, systemAudioEnabled() ? getSystemVolume() : 0);
}

function rampMasterTo(target, seconds) {
  if (!audioCtx || !audioMaster) return;
  const now = audioCtx.currentTime;
  const gain = audioMaster.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(GAIN_FLOOR, gain.value), now);
  gain.exponentialRampToValueAtTime(Math.max(GAIN_FLOOR, target), now + Math.max(0.01, seconds));
}

// Called by applySettings whenever osSettings changes, from either the
// Settings window or REGEDIT.
function applySystemAudioSettings() {
  const enabled = systemAudioEnabled();
  // Ramped rather than assigned: a step change on a gain node is an audible
  // click, which is a poor sound for the control that turns sound off. Skipped
  // while hidden, where the master is parked at the floor by the visibility
  // handler below - the new level is picked up by the fade back in.
  if (!document.hidden) rampMasterTo(masterTargetGain(), 0.08);
  // Muting is not enough for the loops: a silent ambience would keep a decoder
  // running for the rest of the session. They are torn down and re-primed.
  audioLoops.forEach((entry, name) => {
    if (!entry.active) return;
    if (enabled) primeLoop(name, entry);
    else stopLoopPasses(entry, 0.08);
  });
}

// Which chrome clicks: buttons, menu entries, icons and titlebar controls.
// Deliberately not text fields, window bodies, the bare desktop, or drags -
// a click on every pointerdown is authentic for about ninety seconds and
// unbearable after that.
const CLICK_SOUND_SELECTOR = [
  '#start-btn',
  '.sm-item',
  '.taskbar-btn',
  '.desktop-icon',
  '.dlg-btn',
  '.win-btn',
  '.menu-item',
  '.menu-dd-item:not(.disabled)',
  '.st-toggle',
  '.cad-action',
  '.vp-btn',
].join(',');

function initSystemAudio() {
  if (systemAudioInited) return;
  systemAudioInited = true;
  // Capture phase: several apps stopPropagation on their own menu handling,
  // and the click feedback should not depend on which of them do.
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const target = e.target instanceof Element ? e.target.closest(CLICK_SOUND_SELECTOR) : null;
    if (!target || target.disabled) return;
    playSound('click');
  }, true);
}

// The whole point of the Web Audio path: one call stops everything, including
// mid-flight one-shots and both kinds of loop, and resuming picks up where it
// left off because ctx.currentTime did not advance while suspended.
//
// It cannot be that one call on its own, though. ctx.suspend() halts the graph
// wherever the waveform happens to be, and a step from that sample straight to
// silence is, precisely, a click - the ambience is a continuous hum, so it is
// essentially never near a zero crossing at the moment a tab is switched.
// Resuming does the same in reverse. So the master is faded to the floor first
// and the context suspended only once that fade has been rendered, and on the
// way back the context is resumed while still silent and faded up after.
document.addEventListener('visibilitychange', () => {
  if (!audioCtx) return;
  clearTimeout(audioHideFadeTimer);
  audioHideFadeTimer = null;

  if (document.hidden) {
    if (audioCtx.state !== 'running') return;
    audioSuspendedByHide = true;
    rampMasterTo(GAIN_FLOOR, HIDE_FADE_SEC);
    // Background tabs clamp setTimeout to about a second, so this can land
    // well after the fade it is waiting on. That is harmless: the fade is
    // scheduled on the AudioParam and rendered by the audio thread on time
    // regardless of what the timer does, so a late suspend costs a moment of
    // silent processing. An early one costs the click this exists to remove.
    audioHideFadeTimer = setTimeout(() => {
      audioHideFadeTimer = null;
      if (document.hidden && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
    }, HIDE_FADE_SEC * 1000 + 40);
    return;
  }

  if (!audioSuspendedByHide) return;
  audioSuspendedByHide = false;
  // Back before the timer fired: the context never stopped, so only the fade
  // needs reversing.
  if (audioCtx.state === 'running') { rampMasterTo(masterTargetGain(), HIDE_FADE_SEC); return; }
  // Resume first, fade second. Ramps are scheduled against ctx.currentTime,
  // which is frozen until the resume resolves.
  //
  // May be rejected if the browser has since dropped this page's activation.
  // unlockSystemAudio re-checks ctx.state on the next gesture, so the failure
  // costs one click rather than the session - but the master would be left at
  // the floor, so it is restored on that path too.
  audioCtx.resume()
    .then(() => rampMasterTo(masterTargetGain(), HIDE_FADE_SEC))
    .catch(() => rampMasterTo(masterTargetGain(), HIDE_FADE_SEC));
});

// Registered at load, not from initSystemAudio: clicking through the BIOS
// screen has to count as the unlocking gesture, or the startup jingle that
// plays right after it would be blocked.
['pointerdown', 'keydown', 'touchstart'].forEach(type => {
  document.addEventListener(type, unlockSystemAudio, { capture: true, passive: true });
});
function getBootRegistryNumber(keyPath, valueName, fallback, min = 0, max = 999) {
  const parsed = Number(registryData['HKEY_SLEEPBOX_MACHINE']?.[keyPath]?.[valueName]?.value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
function getBootRegistryText(keyPath, valueName, fallback) {
  const raw = registryData['HKEY_SLEEPBOX_MACHINE']?.[keyPath]?.[valueName]?.value;
  const text = String(raw == null ? '' : raw).trim();
  return text || fallback;
}
function getBiosSoulIntegrityStatus(value) {
  if (value >= 92) return 'STABLE';
  if (value >= 70) return 'DEGRADED';
  if (value >= 45) return 'UNSTABLE';
  return 'CRITICAL';
}
function formatBiosMetric(label, value, suffix = '') {
  return `  ${String(label).padEnd(18, ' ')}: ${value}${suffix ? '  ' + suffix : ''}`;
}
function getBiosStorySnapshot() {
  const fallback = {
    stage: 0,
    phaseLabel: 'Dormant',
    coProcessorLine: 'Co-processor: present (unresponsive)',
    segmentLine: '  Segment C: WARN - residual data found',
    usbLine: '  USB: 1 device attached (unrecognized)',
    relayState: 'Nominal',
    containmentState: 'Baseline',
    profileState: 'none',
    bootLine: 'Loading sleepOS v0.903b2...',
  };
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('sleepOS-daemon-story') || 'null');
  } catch (e) {}
  const story = saved && typeof saved === 'object' ? saved : {};
  const bool = key => !!story[key];
  const voidActions = Array.isArray(story.voidActions)
    ? story.voidActions
        .map(action => String(action || '').toLowerCase().trim())
        .filter(Boolean)
    : [];
  const analyticalCount = voidActions.filter(action => action !== 'observe').length;
  let stage = Math.max(0, Math.min(8, Math.trunc(Number(story.stage) || 0)));

  if (bool('openedDaemon')) stage = Math.max(stage, 1);
  if (bool('falseContainmentSeen')) stage = Math.max(stage, 2);
  if (bool('respawnDisabledKill')) stage = Math.max(stage, 3);
  if (bool('daemonStopped') || bool('wrongVictory')) stage = Math.max(stage, 4);
  if (bool('anchorDeleted')) stage = Math.max(stage, 5);
  if (bool('anchorDeleted') && bool('voidObserved') && (analyticalCount > 0 || bool('mirrorInspected') || bool('protocolInspected'))) {
    stage = Math.max(stage, 6);
  }
  if (bool('mirrorLockRestored') || bool('quarantineSigned')) stage = Math.max(stage, 7);
  if (bool('endingReached')) stage = Math.max(stage, 8);

  if (stage >= 8) {
    return {
      stage,
      phaseLabel: 'Contained',
      coProcessorLine: 'Co-processor: present (archived)',
      segmentLine: '  Segment C: OK - archive checksum sealed',
      usbLine: '  USB: 0 external devices required',
      relayState: 'Archived',
      containmentState: 'Sealed',
      profileState: 'sealed',
      bootLine: 'Loading archival shell...',
    };
  }
  if (stage >= 7) {
    return {
      stage,
      phaseLabel: 'Seal Ready',
      coProcessorLine: 'Co-processor: present (quarantine primed)',
      segmentLine: '  Segment C: OK - quarantine lattice primed',
      usbLine: '  USB: 1 device attached (quarantine signer)',
      relayState: 'Bypassed',
      containmentState: 'Armed',
      profileState: bool('quarantineSigned') ? 'bound' : 'ready',
      bootLine: 'Loading seal-ready shell...',
    };
  }
  if (stage >= 6) {
    return {
      stage,
      phaseLabel: 'Profiled',
      coProcessorLine: 'Co-processor: present (replying in-band)',
      segmentLine: '  Segment C: WARN - seal lattice charging',
      usbLine: '  USB: 1 device attached (void instrument)',
      relayState: 'Bypassed',
      containmentState: 'Profiling',
      profileState: analyticalCount >= 3 ? 'deep' : 'active',
      bootLine: 'Loading analysis shell...',
    };
  }
  if (stage >= 5) {
    return {
      stage,
      phaseLabel: 'Contact',
      coProcessorLine: 'Co-processor: present (replying in-band)',
      segmentLine: '  Segment C: FAIL - anchor bleedthrough',
      usbLine: '  USB: 1 device attached (mirror echo)',
      relayState: 'Compromised',
      containmentState: 'Open',
      profileState: 'contact',
      bootLine: 'Loading degraded shell...',
    };
  }
  if (stage >= 4) {
    return {
      stage,
      phaseLabel: 'Containment Lost',
      coProcessorLine: 'Co-processor: present (unstable handshake)',
      segmentLine: '  Segment C: FAIL - daemon relay bleedthrough',
      usbLine: '  USB: 1 device attached (relay ghost)',
      relayState: 'Degraded',
      containmentState: 'Fractured',
      profileState: 'surface',
      bootLine: 'Loading recovery shell...',
    };
  }
  if (stage >= 1) {
    return {
      stage,
      phaseLabel: 'Observed',
      coProcessorLine: 'Co-processor: present (listening)',
      segmentLine: '  Segment C: WARN - foreign pattern repeating',
      usbLine: '  USB: 1 device attached (observer channel)',
      relayState: 'Listening',
      containmentState: 'Passive',
      profileState: voidActions.length ? 'surface' : 'noise',
      bootLine: 'Loading sleepOS v0.903b2...',
    };
  }
  return fallback;
}
function buildBiosLines() {
  const soulIntegrity = Math.trunc(getBootRegistryNumber('SOUL\\Metrics', 'SOUL_INTEGRITY', 87, 0, 100));
  const daemonCount = Math.trunc(getBootRegistryNumber('SOUL\\Metrics', 'DAEMON_COUNT', 7, 0, 99));
  const temporalDrift = getBootRegistryText('SOUL\\Metrics', 'TEMPORAL_DRIFT', '+/-2.3yr');
  const observerCount = getBootRegistryText('VOID', 'OBSERVER_COUNT', '[classified]');
  const voidPressureBase = Math.trunc(getBootRegistryNumber('VOID', 'VOID_PRESSURE_BASE', 12, 0, 99));
  const unknownDaemons = Math.max(0, daemonCount - 4);
  const memoryCoherence = Math.max(0, Math.min(99.9, soulIntegrity + 0.3 - Math.max(0, voidPressureBase - 12) * 0.18));
  const story = getBiosStorySnapshot();

  return [
    'sleepOS BIOS v2.33b  (C) MMXXI Eve Networks Corp.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'CPU: SOMA-686 @ 666 MHz                [DETECTED]',
    story.coProcessorLine,
    '',
    'Testing RAM...',
    '  Segment A: OK',
    '  Segment B: OK',
    story.segmentLine,
    '  262144 KB total',
    '',
    'Scanning devices...',
    '  IDE 0 Master : WD Corpus-40GB  (ATA-6)',
    '  IDE 0 Slave  : CD-ROM VOID-52x  (no disc)',
    story.usbLine,
    '',
    'Running POST diagnostics...',
    formatBiosMetric('Memory coherence', memoryCoherence.toFixed(1) + '%'),
    formatBiosMetric('Clock drift', temporalDrift, '[WARNING]'),
    formatBiosMetric('Daemon count', `${daemonCount} (${unknownDaemons} unrecognized)`),
    formatBiosMetric('Observer count', observerCount),
    formatBiosMetric('Story phase', story.phaseLabel),
    formatBiosMetric('Relay state', story.relayState),
    formatBiosMetric('Containment', story.containmentState),
    formatBiosMetric('Void profile', story.profileState),
    formatBiosMetric('Void pressure', `${voidPressureBase} baseline`),
    formatBiosMetric('Soul integrity', `${soulIntegrity}%`, '[' + getBiosSoulIntegrityStatus(soulIntegrity) + ']'),
    '',
    story.bootLine,
  ];
}
let biosLines = buildBiosLines();

// BIOS BOOT// BIOS BOOT
// ─────────────────────────────────────────────────────────────────
const biosTextEl = document.getElementById('bios-text');
let biosIdx = 0, biosChar = 0, biosTimer, bisDone = false;
let forceBootSequence = false;
try {
  forceBootSequence = sessionStorage.getItem(FORCE_BOOT_SESSION_KEY) === '1';
  if (forceBootSequence) sessionStorage.removeItem(FORCE_BOOT_SESSION_KEY);
} catch (e) {}

function biosFinish() {
  if (bisDone) return; bisDone = true;
  clearTimeout(biosTimer);
  // The kernel owns the process table and the filesystem (see os/kernel.js), so
  // it is seeded here, next to the filesystem mount below, before anything can
  // open a window. kernelInit only touches its own module-level state, so it is
  // safe this early even on the skipBoot path where the rest of the bundle may
  // still be mid-evaluation.
  kernelInit();
  const biosEl = document.getElementById('bios');
  // Start the filesystem mount now so its I/O overlaps the 600ms fade rather
  // than leaving a blank screen after it. By the time the fade ends this has
  // almost always resolved, so the await below is free.
  //
  // Nothing before the first `await` inside vfsBootMount may touch a `const`
  // declared later in the bundle: on the skipBoot path below, this function
  // runs while the bundle is still evaluating. vfsBootMount's first statement
  // is `await vfsMount(...)`, so everything after it runs as a microtask once
  // evaluation has finished and every `const` exists. Do not move work above
  // that await.
  const mounted = vfsBootMount();
  biosEl.style.transition = 'opacity 0.6s';
  biosEl.style.opacity = '0';
  setTimeout(() => {
    // Never leave the OS stuck on a boot screen: a mount failure is already
    // reported through onError, so proceed either way.
    mounted.catch(() => {}).then(() => {
      biosEl.style.display = 'none';
      startDesktop();
    });
  }, 600);
}

function biosType() {
  if (bisDone) return;
  if (biosIdx >= biosLines.length) { biosTimer = setTimeout(biosFinish, 700); return; }
  const line = biosLines[biosIdx];
  if (biosChar <= line.length) {
    if (biosChar > 0) {
      // Replace last line
      const lines = biosTextEl.textContent.split('\n');
      lines[lines.length - 1] = line.slice(0, biosChar);
      biosTextEl.textContent = lines.join('\n');
    }
    biosChar++;
    biosTimer = setTimeout(biosType, line === '' ? 0 : 11);
  } else {
    biosTextEl.textContent += '\n';
    biosIdx++; biosChar = 0;
    biosTimer = setTimeout(biosType, line === '' ? 25 : 55);
  }
}

document.addEventListener('keydown',   biosFinish, { once: true });
document.addEventListener('click',     biosFinish, { once: true });
document.addEventListener('touchend',  biosFinish, { once: true });
// Load settings early so skipBoot is available
try { Object.assign(osSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch(e) {}
if (osSettings.skipBoot && !forceBootSequence) {
  // Deferred by a tick so nothing here runs while the bundle is still
  // evaluating. Visually identical, and it means biosFinish cannot touch a
  // `const` from a file that has not been reached yet.
  setTimeout(biosFinish, 0);
} else {
  biosLines = buildBiosLines();
  setTimeout(biosType, 250);
}

// ─────────────────────────────────────────────────────────────────
// WINDOW MANAGEMENT
// ─────────────────────────────────────────────────────────────────
let zTop = 100;
const wins = {};
let _expClipboard = null; // { items:[{name,kind,sysfile,srcCwd}], cut:bool }
let _shellDragPayload = null; // { item, srcCwd, source:'explorer'|'desktop', sourceId?:string }
let _explorerWinSeq = 0;

// Pick a free name in dirName for `name`, appending _copy / _copy2 / _copy3...
// on a collision. Built on vfsExistsSync so it never pokes at a dir node's
// files/blobs/dirs directly.
function _uniqueNameIn(dirName, name) {
  if (!vfsExistsSync(name, dirName)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext  = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (vfsExistsSync(base + '_copy' + (i > 2 ? i : '') + ext, dirName)) i++;
  return base + '_copy' + (i > 2 ? i : '') + ext;
}

// Recursively copy one entry into a directory that has already been checked
// to exist. Used by the non-cut (copy) side of pasteClipboardInto, which has
// no single VFS primitive to lean on the way a move does.
// The caller must already have refused a paste whose destination lies inside
// the source directory; see pasteClipboardInto. Without that check this
// recursion never terminates, because vfsListSync(srcPath) rediscovers the
// copy it just made one level up.
async function _copyEntryInto(name, srcCwd, dstCwd, dstName, kind) {
  if (kind === 'dir') {
    // Recurse under the name vfsMkdir ACTUALLY created, not the one we asked
    // for. Directory names are uppercased in the tree, and _uniqueNameIn
    // returns mixed case ('PHOTOS_copy'), so building the path from dstName
    // would resolve to a name the tree never actually used.
    const made = await vfsMkdir(dstName, dstCwd);
    const srcPath = srcCwd ? srcCwd + '\\' + name : name;
    const dstPath = dstCwd ? dstCwd + '\\' + made.fileName : made.fileName;
    for (const entry of vfsListSync(srcPath)) {
      await _copyEntryInto(entry.name, srcPath, dstPath, entry.name, entry.kind);
    }
  } else if (kind === 'blob') {
    const st = vfsStatSync(name, srcCwd);
    if (st && st.blob) {
      // A copy needs its own independent object URL - sharing the source's
      // means deleting either entry revokes the other one's bytes (removeFsPath
      // and purgeFsDirNode both revoke the exact URL they were handed). Task
      // 9e/9f deleted the blob-store mirror this used to lean on for a spare
      // copy of the bytes; re-fetching the source's live URL and minting a
      // fresh Blob from it gets the same independence directly, with no
      // separate store involved - vfsWriteBlob below queues the usual commit
      // that persists these bytes to blocks under the new path.
      const record = { ...st.blob };
      if (record.url) {
        try {
          const bytes = await (await fetch(record.url)).arrayBuffer();
          record.url = URL.createObjectURL(new Blob([bytes], { type: record.mime || 'application/octet-stream' }));
        } catch (e) {
          // Unreachable (a seeded item's external URL is CORS-blocked, or the
          // source URL was already revoked): fall back to sharing the
          // source's URL, same as the old code's seeded-blob case.
        }
      }
      await vfsWriteBlob(dstName, record, dstCwd);
    }
  } else {
    const content = await vfsReadFile(name, srcCwd);
    await vfsWriteFile(dstName, content == null ? '' : content, dstCwd);
  }
}

// Paste the shell clipboard into a directory. Lives here beside _expClipboard
// rather than inside openExplorer so the desktop and every Explorer window
// share one implementation. Returns true if anything changed; callers that
// render their own view (Explorer) should refresh on true. The desktop needs
// no explicit refresh because setupIcons listens for 'fs-changed', which the
// VFS now fires itself on every mutation.
//
// Each item is awaited in turn rather than pasted via Promise.all/forEach: a
// concurrent paste could resolve before every item lands, so a caller's
// render() would draw a half-pasted directory.
async function pasteClipboardInto(dstCwd) {
  if (!_expClipboard || dstCwd === 'PROJECTS' || dstCwd === 'RECYCLE') return false;
  if (!vfsDirExistsSync(dstCwd)) return false;
  let changed = false;
  let failMessage = null;
  const items = _expClipboard.items;
  const cut = _expClipboard.cut;
  for (const { name, srcCwd } of items) {
    if (!vfsDirExistsSync(srcCwd)) continue;
    // Trust the live stat over the clipboard's remembered kind: a blob's kind
    // is image/video/audio/binary there, not 'blob', and the entry may have
    // changed kind entirely since it was cut or copied.
    const st = vfsStatSync(name, srcCwd);
    if (!st) continue;
    const dstName = _uniqueNameIn(dstCwd, name);
    try {
      if (cut) {
        const movedName = await vfsMove(srcCwd, name, dstCwd, dstName);
        if (!movedName) continue;
        // vfsMove already queues the block-layer's own move op - nothing
        // further to keep in sync.
      } else {
        // A copy into the source's own subtree would recurse without bound:
        // _copyEntryInto re-lists the source on every level and would keep
        // rediscovering the directory it just created. Refuse it here rather
        // than inside the recursion so the user gets a message instead of a
        // silently skipped item. Same predicate vfsMove uses for a cut.
        if (st.kind === 'dir') {
          const srcFull = st.dirName ? st.dirName + '\\' + st.name : st.name;
          const dstNorm = vfsNormalizeDir(dstCwd);
          if (dstNorm === srcFull || dstNorm.startsWith(srcFull + '\\')) {
            failMessage = failMessage || 'Cannot paste a folder into itself.';
            continue;
          }
        }
        await _copyEntryInto(name, srcCwd, dstCwd, dstName, st.kind);
      }
      changed = true;
    } catch (err) {
      failMessage = failMessage || (err.code === 'ENOSPC' ? 'Not enough space to paste this item.' : err.message);
    }
  }
  if (cut) _expClipboard = null;
  if (failMessage) osAlert(failMessage, 'Paste Failed', 'icon:error');
  return changed;
}

function nextExplorerWinId() {
  do { _explorerWinSeq += 1; } while (wins['explorer-' + _explorerWinSeq]);
  return 'explorer-' + _explorerWinSeq;
}

// The seeded filesystem. vfsBootMount installs this as the initial tree when
// nothing is persisted, and re-applies the DOCS subtree on every boot.
// subdirs: Map<dirName, { files: Map, blobs: Map, dirs: Set }>
function vfsSeedTree() {
  const seed = {
  dirs:    new Set(['DOCS']),
  files:   new Map(),
  blobs:   new Map(),
  subdirs: new Map([['DOCS', {
    dirs: new Set(), blobs: new Map(), subdirs: new Map(),
    files: new Map([
      ['README.txt', [
        '== sleepOS v0.9β - README ==',
        '',
        'ROOT: C:\\sleepOS',
        '  DOCS\\      - documentation (this folder)',
        '  PROJECTS\\  - interactive apps (read-only)',
        '',
        'SYSTEM FILES (read-only):',
        '  WELCOME.README  NOTEPAD.exe  TERMINAL.exe',
        '  SYSMON.exe  BROWSER.exe  DEFRAG.exe',
        '  CALC.exe  REGEDIT.exe  EXPLORER.exe',
        '  void.tmp  daemon.core  ?????.exe',
        '',
        'USER FILES:',
        '  Create with TOUCH, NOTEPAD, or ECHO >.',
        '  Upload via right-click > Upload File.',
        '  New items go into your current folder.',
        '',
        'SHORTCUTS:',
        '  Space + Tab     switch windows',
        '  Ctrl + Alt + Q  session controls',
        '  Esc             close menus and overlays',
        '',
        'TERMINAL (quick ref):',
        '  DIR / LS          list files',
        '  CD <dir>          enter folder  |  CD ..  go up',
        '  CAT <file>        read file',
        '  TOUCH <file>      create file',
        '  MKDIR <dir>       create folder',
        '  DEL <file>        delete',
        '  GREP <pat> <file> search lines matching pattern',
        '  WC <file>         word/line/byte count',
        '  SET name=value    assign a shell variable',
        '  ENV               show the process environment',
        '  PATH [value]      show or set the program search path',
        '  WHERE <name>      locate a program on PATH',
        '  INPUT <var>       read a line into a shell variable',
        '  SLEEP <ms>        pause in milliseconds',
        '  LS *.txt          wildcard file listing',
        '  CAT f | GREP pat  pipe output between commands',
        '  DIR > out.txt     redirect output to a file',
        '  CAT f | NOTEPAD   pipe output into Notepad',
        '',
        'KEYBOARD SHORTCUTS:',
        '  Ctrl+Alt+Q      secure attention sequence',
        '  Space+Tab         switch windows',
        '  Escape            close menus / overlays',
        '',
        'Bonus: RUN DOCS\\REACTOR.script to play a terminal game.',
        '',
        'See COMMANDS.txt for full terminal reference.',
        'See SCRIPTING.txt for the .script language.',
      ].join('\n')],
      ['SCRIPTING.txt', [
        '== sleepOS Script Language (.script files) ==',
        '',
        'Scripts are plain text files with .script extension.',
        'Create one with: NOTEPAD myscript.script',
        'Run one with:    RUN myscript.script',
        'Spawn one as a real process with:  SPAWN myscript.script',
        'A spawned script gets a real PID, shows up in PS, and can be KILLed.',
        '',
        '── COMMANDS ─────────────────────────────────',
        '',
        '  print <text>       print text to terminal',
        '  echo <text>        same as print',
        '  wait <ms>          pause N milliseconds',
        '  set <var> <value>  assign a variable',
        '  input <var> [text]  read a line from the terminal',
        '  inc <var> [n]      increase a numeric variable',
        '  dec <var> [n]      decrease a numeric variable',
        '  add <var> <n>      add n to a numeric variable',
        '  sub <var> <n>      subtract n from a numeric variable',
        '  mul <var> <n>      multiply a numeric variable',
        '  div <var> <n>      divide a numeric variable',
        '  mod <var> <n>      modulo a numeric variable',
        '  clear              clear the terminal output',
        '  touch <file>       create an empty file',
        '  mkdir <dir>        create a directory',
        '  dir [path]         list a directory (path is root-relative, not',
        '                     relative to the running script)',
        '  del <file>         delete a file',
        '  rm <file>          same as del',
        '  open <file>        open file in viewer',
        '  start <program>    launch a program',
        '  notepad [file]     open Notepad',
        '  run <script> [..]  run another script in the same context',
        '  call <label> [..]  call a subroutine label',
        '  return [code]      return from a subroutine',
        '  exit [code]        stop the script with a status code',
        '  grep <pattern> <file>  print matching lines',
        '',
        '-- CONTROL FLOW --------------------------------------------',
        '',
        '  :label             declare a jump target',
        '  goto <label>       jump to a label',
        '  if a == b goto x   branch on a comparison',
        '  if not a == b goto x',
        '  if exists file goto x',
        '  if defined name goto x',
        '  if not exists file goto x',
        '  if not defined name goto x',
        '',
        '  Supported operators: ==  !=  >  >=  <  <=',
        '  == and != compare strings after $var expansion.',
        '  >, >=, <, <= require both sides to be numbers.',
        '',
        '── VARIABLES ────────────────────────────────',
        '',
        '  set name Visitor',
        '  print Hello, $name!',
        '  -> Hello, Visitor!',
        '  print Arg 1: $1  / argc=$argc',
        '  if $status != 0 goto failed',
        '',
        '  Child scripts launched with RUN share the same variables.',
        '  RUN and CALL provide positional args as $0, $1, $2, ...',
        '  $argc is the arg count. $status / $errorlevel is the last exit code.',
        '  INPUT only works when the script is launched from TERMINAL.',
        '',
        '-- THE ENVIRONMENT -----------------------------------------',
        '',
        '  A spawned script inherits the environment as ordinary',
        '  variables, so $USERNAME, $COMPUTERNAME and $PATH are',
        '  already set before its first line runs.',
        '',
        '    # whoami.script',
        '    print Running as $USERNAME on $COMPUTERNAME',
        '    print Search path: $PATH',
        '',
        '  SPAWN gives the script its OWN COPY. Changing a variable',
        '  inside a spawned script does not change the terminal\'s.',
        '  RUN is different: a script run with RUN shares the',
        '  caller\'s variables, as described above.',
        '',
        '── COLORS ───────────────────────────────────',
        '',
        '  print [red]    error text',
        '  print [green]  success text',
        '  print [yellow] warning text',
        '  print [cyan]   info text',
        '  print [blue]   note text',
        '',
        '── COMMENTS ─────────────────────────────────',
        '',
        '  # hash comment',
        '  // double-slash comment',
        '',
        '── EXAMPLE SCRIPT ───────────────────────────',
        '',
        '  # loop.script',
        '  input name "Operator name:"',
        '  set mode debug',
        '  set count 1',
        '  if not exists DOCS goto no_docs',
        '  if $mode == debug goto debug',
        '  print Normal mode for $name',
        '  goto start',
        '  :debug',
        '  print [cyan] Debug mode enabled for $name',
        '  call tick_loop $name',
        '  if $status != 0 goto failed',
        '  exit 0',
        '  :tick_loop',
        '  :start',
        '  print [yellow] Doubling counter...',
        '  :loop',
        '  print Tick $count',
        '  mul count 2',
        '  wait 250',
        '  if $count <= 4 goto loop',
        '  print [green] Done.',
        '  return 0',
        '  :no_docs',
        '  print [red] DOCS missing',
        '  exit 2',
        '  :failed',
        '  print [red] Subroutine failed',
        '  exit $status',
        '',
        '── PROGRAMS FOR start/open ──────────────────',
        '',
        '  notepad, terminal, sysmon, browser,',
        '  defrag, explorer, welcome,',
        '  calc, regedit',
      ].join('\n')],
      ['COMMANDS.txt', [
        '== Terminal Commands Reference ==',
        '',
        '── FILESYSTEM ───────────────────────────────',
        '  DIR, LS              list current directory',
        '  CD <path>            change directory',
        '  CD ..                go up one level',
        '  MKDIR <name>         create directory',
        '  TOUCH <name>         create empty file',
        '  DEL, RM <file>       delete file/directory',
        '  CAT, TYPE <file>     read file contents',
        '  COPY <src> <dst>     copy a file',
        '  MOVE, MV <src> <dst>  always fails - files are already home',
        '  TREE                 show directory tree',
        '  OPEN <file>          open in viewer/editor',
        '',
        '── SCRIPTING ────────────────────────────────',
        '  RUN <file.script> [args]  execute a script file',
        '  .script files support labels, subroutines, args,',
        '  shared variables, existence tests, and exit codes',
        '  ECHO text > file     write text to file',
        '  ECHO text >> file    append to file',
        '',
        '── PROGRAMS ─────────────────────────────────',
        '  NOTEPAD [file]       text editor',
        '  START <name>         start any program',
        '  EXIT                 close terminal',
        '  CALC                 open calculator',
        '  REGEDIT              open registry editor',
        '  EXPLORER             open file explorer',
        '',
        '── PATH AND THE ENVIRONMENT ─────────────────',
        '  Programs are looked up in the current folder',
        '  first, then in each PATH entry in order.',
        '',
        '  PATH                 print the search path',
        '  PATH C:\\sleepOS      set it',
        '  WHERE calc           C:\\sleepOS\\CALC.exe',
        '',
        '  SET PATH=            removes PATH entirely, so SET and ENV',
        '  stop listing it - PATH <value> recreates it. A script that',
        '  reads $PATH after that gets an empty string, even though',
        '  SCRIPTING.txt says PATH is already set when a script starts.',
        '',
        '  Because the current folder is searched first,',
        '  the programs in C:\\sleepOS always run from',
        '  C:\\sleepOS even with PATH emptied. From any',
        '  other folder they need C:\\sleepOS on PATH.',
        '',
        '  The same rule governs PROJECTS. START <project>',
        '  needs C:\\sleepOS\\PROJECTS on PATH, or you need',
        '  to be standing in it. Empty your PATH and the',
        '  projects are still there: CD PROJECTS, then',
        '  START works again.',
        '',
        '  The environment belongs to the terminal, and',
        '  the terminal is a process. Close it and that',
        '  process ends, so a new terminal starts from the',
        '  system defaults and forgets your PATH edits.',
        '',
        '── DISK ─────────────────────────────────────',
        '  The drive is a real block device now: 4 KB',
        '  blocks, a real allocator, and a fragmentation',
        '  figure measured from the allocation map rather',
        '  than guessed at.',
        '',
        '  DEFRAG.exe moves blocks for real now. It',
        '  needs at least one free block to work in,',
        '  and it stops cleanly if you ask it to.',
        '',
        '  Files you made before the upgrade were copied',
        '  across on first boot. The old copy is kept for',
        '  one release, so nothing is lost if the copy',
        '  went wrong.',
        '',
        '── SYSMON ───────────────────────────────────',
        '  SYSMON measures what it can and says so. CPU',
        '  is real. Memory is counted, not sampled from',
        '  the heap, which no browser will show us.',
        '  A dash means there is nothing to measure.',
        '',
        '── SYSTEM ───────────────────────────────────',
        '  VER                  OS version',
        '  WHO, WHOAMI          current user',
        '  DATE                 system date',
        '  PS                   running processes',
        '  TASKKILL <pid>       terminate process',
        '  SPAWN <script> [args]  run a script as a real process',
        '  KILL <pid> [/F]        signal a process (/F to force)',
        '  IPCONFIG             network config',
        '  SET [name[=value]]   show or assign shell variables',
        '  ENV                  show the process environment',
        '  PATH [value]         show or set the executable search path',
        '  WHERE <name>         which directory a program resolves from',
        '  INPUT <var> [prompt]  read a line into a shell variable',
        '  INC, DEC <var> [n]   adjust numeric shell variables',
        '  ADD, SUB, MUL, DIV, MOD  arithmetic on shell variables',
        '  PING [host]          ping a host',
        '  SLEEP <ms>           pause for milliseconds',
        '  ECHO <text>          print text',
        '  PRINT <text>         alias for ECHO',
        '  WAIT <ms>            alias for SLEEP',
        '  CLS                  clear screen',
        '  CLEAR                alias for CLS',
        '  HELP                 this help',
        '',
        '── SEARCH & PIPES ───────────────────────────',
        '  GREP <pattern> <file>  find matching lines',
        '  WC <file>              word/line/byte count',
        '  LS *.ext               wildcard glob listing',
        '  DEL *.tmp              wildcard delete',
        '  CAT f | GREP pattern   pipe output to command',
        '  cmd > file             write command output to a file',
        '  cmd >> file            append command output to a file',
        '  cmd | NOTEPAD          open piped output in Notepad',
        '  cmd | NOTEPAD file     save piped output and open it',
        '',
        '── KEYBOARD SHORTCUTS ───────────────────────',
        '  Ctrl+Alt+Q    secure attention sequence',
        '  Space+Tab       switch windows',
        '  Escape          close menus / overlays',
      ].join('\n')],
      ['REACTOR.script', [
        '# REACTOR.script',
        'clear',
        'print [cyan] REACTOR WATCH',
        'print You are alone in the control loop.',
        'print Survive 5 turns without melting down.',
        'print',
        'print 1) VENT  - lower heat, costs power',
        'print 2) BOOST - gain power, raises heat',
        'print 3) PATCH - repair integrity, costs power',
        'print',
        'input pilot "Operator name:"',
        'set heat 4',
        'set power 5',
        'set integrity 6',
        'set turn 1',
        'print [green] Good luck, $pilot.',
        'wait 300',
        ':loop',
        'call check_fail',
        'if $status != 0 goto game_over',
        'if $turn > 5 goto win',
        'call hud',
        'call event_brief',
        'call choose_action',
        'if $status != 0 goto loop',
        'call apply_event',
        'call check_fail',
        'if $status != 0 goto game_over',
        'inc turn 1',
        'wait 250',
        'goto loop',
        ':hud',
        'print',
        'print [blue] ------------------------------',
        'print [blue] TURN $turn / 5',
        'print Heat: $heat',
        'print Power: $power',
        'print Integrity: $integrity',
        'print [blue] ------------------------------',
        'return 0',
        ':event_brief',
        'if $turn == 1 goto brief_1',
        'if $turn == 2 goto brief_2',
        'if $turn == 3 goto brief_3',
        'if $turn == 4 goto brief_4',
        'goto brief_5',
        ':brief_1',
        'print [yellow] Alert: a solar flare is incoming.',
        'print [yellow] End of turn effect: heat +2',
        'return 0',
        ':brief_2',
        'print [yellow] Alert: coolant leak in the outer ring.',
        'print [yellow] End of turn effect: integrity -2',
        'return 0',
        ':brief_3',
        'print [yellow] Alert: ghost load in the battery banks.',
        'print [yellow] End of turn effect: power -2',
        'return 0',
        ':brief_4',
        'print [yellow] Alert: chamber tremor in progress.',
        'print [yellow] End of turn effect: heat +1, integrity -1',
        'return 0',
        ':brief_5',
        'print [yellow] Alert: cascade surge across all systems.',
        'print [yellow] End of turn effect: heat +2, power -1, integrity -1',
        'return 0',
        ':choose_action',
        'print 1) VENT',
        'print 2) BOOST',
        'print 3) PATCH',
        'input choice "Action:"',
        'if $choice == 1 goto act_vent',
        'if $choice == 2 goto act_boost',
        'if $choice == 3 goto act_patch',
        'print [red] Invalid action. Choose 1, 2, or 3.',
        'return 1',
        ':act_vent',
        'print [cyan] You vent plasma into the dark.',
        'dec heat 3',
        'dec power 1',
        'call clamp_heat',
        'return 0',
        ':act_boost',
        'print [cyan] You push fresh charge into the grid.',
        'add power 2',
        'add heat 2',
        'return 0',
        ':act_patch',
        'print [cyan] You patch fractures in the shell.',
        'add integrity 2',
        'dec power 2',
        'return 0',
        ':clamp_heat',
        'if $heat >= 0 goto clamp_done',
        'set heat 0',
        ':clamp_done',
        'return 0',
        ':apply_event',
        'if $turn == 1 goto event_1',
        'if $turn == 2 goto event_2',
        'if $turn == 3 goto event_3',
        'if $turn == 4 goto event_4',
        'goto event_5',
        ':event_1',
        'add heat 2',
        'print [yellow] The flare hits. Heat climbs.',
        'return 0',
        ':event_2',
        'sub integrity 2',
        'print [yellow] Coolant loss scars the outer casing.',
        'return 0',
        ':event_3',
        'sub power 2',
        'print [yellow] The ghost load drains your reserves.',
        'return 0',
        ':event_4',
        'add heat 1',
        'sub integrity 1',
        'print [yellow] The chamber shudders under strain.',
        'return 0',
        ':event_5',
        'add heat 2',
        'sub power 1',
        'sub integrity 1',
        'print [yellow] The final cascade tears through the stack.',
        'return 0',
        ':check_fail',
        'if $heat < 10 goto check_power',
        'print [red] MELTDOWN. Heat reached $heat.',
        'return 10',
        ':check_power',
        'if $power > 0 goto check_integrity',
        'print [red] BLACKOUT. Power collapsed.',
        'return 11',
        ':check_integrity',
        'if $integrity > 0 goto safe',
        'print [red] BREACH. Integrity failed.',
        'return 12',
        ':safe',
        'return 0',
        ':win',
        'print',
        'print [green] Reactor stable after 5 turns.',
        'print [green] Nice work, $pilot.',
        'exit 0',
        ':game_over',
        'print [red] The control loop goes silent.',
        'exit $status',
      ].join('\n')],
    ]),
  }]]),
  };
  seed.dirs.add('DESKTOP');
  if (!seed.subdirs.has('DESKTOP')) {
    seed.subdirs.set('DESKTOP', { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  }
  return seed;
}

// Several modules touch the filesystem while the bundle is still evaluating
// (registry defaults, recycle-bin setup, the seeded-DOCS snapshot taken at the
// top of os/fs-persist.js). Install the seed synchronously so those reads find
// a tree; vfsBootMount replaces it with persisted state before the desktop
// renders. The manifest order os/vfs.js -> os/fs-core.js -> os/fs-persist.js
// is what makes that work and must not change.
vfsSetTree(vfsSeedTree());

// Kept as thin wrappers rather than deleted: 47 call sites across nine files
// still use them, and until now they were byte-identical copies of the VFS
// versions, which is how the C:\sleepOS prefix bug came to exist in four
// places instead of two. Delegating kills the duplication permanently.
function fsNormalizeDir(name) { return vfsNormalizeDir(name); }
function fsSplitPath(path, fallbackDir) { return vfsSplitPath(path, fallbackDir); }

// ── Filesystem persistence ────────────────────────────────────────
const DRIVE_STATE_KEY = 'sleepOS-drive-state';
// Pre-phase-2. Read exactly once, by createDriveStateDefaults(true), and only
// when DRIVE_STATE_KEY is absent - so for any profile that has booted since,
// it can never be read again. It was also being rewritten on every defrag pass,
// a mirror with no reader, which is the same shape as the blob mirrors tasks 9e
// and 9f deleted. The write is gone; the read stays one more release so a
// returning visitor keeps their "Last defrag" time.
const LEGACY_DEFRAG_KEY = 'sleepOS-defrag-time';

function _serDir(d) {
  const out = { dirs: [...d.dirs], files: {}, subdirs: {} };
  d.files.forEach((v, k) => { out.files[k] = v; });
  if (d.subdirs) d.subdirs.forEach((v, k) => { out.subdirs[k] = _serDir(v); });
  return out;
}

function _desDir(o) {
  const d = { dirs: new Set(o.dirs || []), files: new Map(), blobs: new Map(), subdirs: new Map() };
  Object.entries(o.files || {}).forEach(([k, v]) => d.files.set(k, v));
  Object.entries(o.subdirs || {}).forEach(([k, v]) => d.subdirs.set(k, _desDir(v)));
  return d;
}

// Read at module top level, during bundle evaluation. This is only safe
// because the manifest loads os/vfs.js before os/fs-core.js before this file,
// and os/fs-core.js installs the seed tree synchronously with
// vfsSetTree(vfsSeedTree()) for exactly this reason. Do not reorder them.
const SEEDED_DOCS_DATA = _serDir(vfsGetTree().subdirs.get('DOCS'));

// Mutates the tree directly and deliberately queues no op. Unlike the legacy
// call sites this is not a persistence bug: vfsBootMount runs this from a
// constant on every boot, so its effect is regenerated rather than restored,
// and there is nothing here that needs a commit to survive. If a later real
// write is the first thing to ever target DOCS, the backend's inoForDir
// (os/storage-idb.js) creates the directory on demand rather than requiring
// a prior mkdir op to have reserved its ino - so skipping a commit here
// leaves nothing dangling for that write to find missing.
function refreshSeededDocs() {
  const root = vfsGetTree();
  root.dirs.add('DOCS');
  let docs = root.subdirs.get('DOCS');
  if (!docs) {
    docs = _desDir(SEEDED_DOCS_DATA);
    root.subdirs.set('DOCS', docs);
    return;
  }
  docs.dirs = docs.dirs || new Set();
  docs.files = docs.files || new Map();
  docs.blobs = docs.blobs || new Map();
  docs.subdirs = docs.subdirs || new Map();
  Object.entries(SEEDED_DOCS_DATA.files || {}).forEach(([name, value]) => {
    docs.files.set(name, value);
  });
  Object.entries(SEEDED_DOCS_DATA.subdirs || {}).forEach(([name, value]) => {
    docs.dirs.add(name);
    docs.subdirs.set(name, _desDir(value));
  });
}

function refreshSeededWallpaperLibrary() {
  const dir = ensureFsDir(SYSTEM_WALLPAPER_DIR);
  SEEDED_WALLPAPERS.forEach(item => {
    const { fileName } = fsSplitPath(item.path);
    if (!fileName) return;
    dir.blobs.set(fileName, {
      url: item.assetUrl,
      kind: 'image',
      size: 0,
      mime: item.mime,
      seeded: true,
    });
  });
}

function refreshSeededHomeMedia() {
  SEEDED_HOME_MEDIA.forEach(item => {
    const { dirName, fileName } = fsSplitPath(item.path);
    if (!fileName) return;
    const dir = ensureFsDir(dirName);
    dir.blobs.set(fileName, {
      url: item.assetUrl,
      kind: item.kind || inferBlobKindFromName(fileName),
      size: item.size || 0,
      mime: item.mime,
      author: item.author || '',
      seeded: true,
    });
  });
}

function saveFS() { return vfsFlush(); }

function createDriveStateDefaults(fromLegacy) {
  const legacyTs = fromLegacy ? parseInt(localStorage.getItem(LEGACY_DEFRAG_KEY) || '0', 10) || 0 : 0;
  return {
    lastDefragTs: legacyTs,
    changeCount: 0,
    lastMutationTs: 0,
  };
}

function normalizeDriveState(saved) {
  const next = Object.assign(createDriveStateDefaults(false), saved || {});
  next.lastDefragTs = Math.max(0, Math.trunc(Number(next.lastDefragTs) || 0));
  next.changeCount = Math.max(0, Math.trunc(Number(next.changeCount) || 0));
  next.lastMutationTs = Math.max(0, Math.trunc(Number(next.lastMutationTs) || 0));
  return next;
}

function loadDriveState() {
  try {
    const raw = localStorage.getItem(DRIVE_STATE_KEY);
    if (raw) return normalizeDriveState(JSON.parse(raw));
  } catch (e) {}
  return createDriveStateDefaults(true);
}

function saveDriveState() {
  try { localStorage.setItem(DRIVE_STATE_KEY, JSON.stringify(defragState)); } catch (e) {}
}

let defragState = loadDriveState();

// Fragmentation used to be a number nudged by hand-tuned deltas on every
// write, clamped to 0.02-0.92, and persisted to localStorage. Nothing measured
// anything: DEFRAG.exe animated against a fiction and the deltas existed only
// to make the fiction drift.
//
// It is now computed from the real allocation map: the number of extra block
// runs beyond the one run per file that is unavoidable, over the most extra
// runs those same blocks could have had. It is cached because reading it walks
// every inode and SYSMON asks often; fsRefreshFragmentation() is what
// recomputes.
var fsFragmentationLevel = 0;

function getDriveFragmentationLevel() {
  return fsFragmentationLevel;
}

function getDriveOptimizationPercent() {
  return Math.round((1 - getDriveFragmentationLevel()) * 100);
}

// Recompute from the allocation map. Only the IndexedDB backend has one; on
// the localStorage fallback there are no blocks to measure, so the honest
// answer is 0 rather than an invented number.
async function fsRefreshFragmentation() {
  if (fsGetActiveBackendKind() !== 'idb') { fsFragmentationLevel = 0; return 0; }
  try {
    const backend = vfsGetBackend();
    const inodes = backend && backend._readInodes ? await backend._readInodes() : [];
    fsFragmentationLevel = fsComputeFragmentation(inodes);
  } catch (e) {
    // Leave the last known value rather than reporting a drop that did not
    // happen. A transient read failure is not a defragmentation.
  }
  return fsFragmentationLevel;
}

// Walks a compaction plan, one transaction per move, deferring commits for the
// duration. This is what DEFRAG.exe drives.
//
// Never throws. DEFRAG is a UI with no useful way to handle an exception
// mid-animation, and an unhandled one would leave the defer flag set, which
// silently stops the filesystem persisting for the rest of the session. Every
// outcome comes back as a value, the same rule fsMigrateFromLocalStorage
// follows.
//
// The plan is deliberately not persisted. The target layout is a pure function
// of the current disk, so an interrupted run needs no saved state: the next
// run replans from wherever this one got to. Stop, crash recovery and resume
// are therefore one mechanism instead of three.
async function fsRunCompaction(options) {
  options = options || {};
  const result = {
    ran: false, reason: 'not-idb', moved: 0, total: 0,
    stopped: false, fragBefore: getDriveFragmentationLevel(), fragAfter: getDriveFragmentationLevel(),
  };
  if (fsGetActiveBackendKind() !== 'idb') return result;

  const backend = vfsGetBackend();
  if (!backend || typeof backend._moveBlock !== 'function') return result;

  vfsSetDefragActive(true);
  try {
    const entries = await backend._readInodeEntries();
    let plan;
    try {
      plan = fsPlanCompaction(entries, backend._superblock);
    } catch (err) {
      result.ran = true;
      result.reason = err && err.code === 'ENOSPC' ? 'no-space' : 'failed';
      return result;
    }

    result.ran = true;
    result.total = plan.length;
    if (!plan.length) { result.reason = 'nothing-to-do'; return result; }
    result.reason = 'ok';

    for (const move of plan) {
      if (options.shouldStop && options.shouldStop()) { result.stopped = true; break; }
      try {
        await backend._moveBlock(move);
      } catch (err) {
        // One failed move ends the run. The disk is still consistent - the
        // transaction rolled back - and the next run replans from here.
        result.reason = 'failed';
        break;
      }
      result.moved++;
      if (options.onProgress) options.onProgress(move, result.moved, result.total);
    }
    return result;
  } catch (err) {
    // `ran` means "the flag was set and work was attempted", which is true by
    // the time we are here - this catch is downstream of vfsSetDefragActive(true).
    // Leaving it false would make a real failure look like the early declines
    // above, where nothing was attempted at all.
    result.ran = true;
    result.reason = 'failed';
    return result;
  } finally {
    vfsSetDefragActive(false);
    defragState.lastDefragTs = Date.now();
    saveDriveState();
    result.fragAfter = await fsRefreshFragmentation();
    void vfsFlush();
  }
}

// Which backend actually mounted. SYSMON reports it, and Task 7's
// fragmentation reads the real bitmap only when it is 'idb'.
var fsActiveBackendKind = 'local';
function fsGetActiveBackendKind() { return fsActiveBackendKind; }

// Pick the filesystem backend, and migrate on the first boot that finds one.
//
// IndexedDB is not guaranteed: private browsing, disabled storage, and a
// database that simply refuses to open are all real. None of them may stop the
// desktop appearing, so every failure path here ends at the localStorage
// backend the OS shipped with. A visitor in that state keeps a working, if
// smaller, filesystem and loses nothing.
async function fsChooseBackend() {
  if (!fsIdbAvailable()) return { backend: createLocalStorageBackend(), kind: 'local' };
  try {
    const backend = createIdbBackend();
    // Force the connection open now rather than on the first write, so a
    // refusal is caught here where there is still a fallback to take.
    // (estimate() never touches the database - it only calls
    // navigator.storage.estimate() and swallows every error - so it cannot do
    // this on its own. _store() is what actually opens the connection via
    // ensure(), and is what can throw here.)
    await backend._store();
    const result = await fsMigrateFromLocalStorage(backend);
    if (result.reason === 'failed') {
      // Boot from localStorage exactly as before and try again next time.
      //
      // Migration's abort path tries to destroy the database, but it can fail
      // to - another tab holding a connection blocks the delete, and it fails
      // fast rather than hanging (result.databaseDeleted records which
      // happened). Deliberately not branching on that here: the import runs as
      // ONE transaction, so a failed import commits no content at all, and
      // whatever database survives holds nothing but the superblock ensure()
      // wrote when it opened. `migrated` stays false either way, so the next
      // boot re-imports over it and converges. The delete is defensive
      // cleanup, not a correctness requirement - which is exactly why a
      // blocked one is safe to ignore.
      return { backend: createLocalStorageBackend(), kind: 'local' };
    }
    return { backend, kind: 'idb' };
  } catch (e) {
    return { backend: createLocalStorageBackend(), kind: 'local' };
  }
}

// Async boot entry point. Called from the BIOS sequence before startDesktop.
async function vfsBootMount() {
  const chosen = await fsChooseBackend();
  fsActiveBackendKind = chosen.kind;
  await vfsMount(chosen.backend, {
    onChange: () => {
      document.dispatchEvent(new CustomEvent('fs-changed'));
    },
    // Recompute here, not from onChange. onChange fires the instant an op is
    // queued - up to 400ms before the debounced vfsFlush() actually commits
    // it - and fsRefreshFragmentation() reads backend._readInodes(), which
    // only ever sees durably committed IndexedDB state. Computing from
    // onChange reads that state before the write which triggered the
    // recompute has landed, so the cached number is stale by one commit and
    // nothing corrects it until an unrelated later write or a reload happens
    // to come along. onCommit fires only once the commit that produced `ops`
    // has actually landed, so the read is of the state it just produced.
    // Deliberately not awaited: vfsFlush never awaits onCommit, and a
    // rejected promise here must not surface as an unhandled rejection.
    onCommit: () => {
      void fsRefreshFragmentation();
    },
    onError: err => { reportVfsError(err); },
    seed: root => {
      if (!root.dirs.size && !root.files.size) {
        const seeded = vfsSeedTree();
        seeded.dirs.forEach(d => root.dirs.add(d));
        seeded.files.forEach((v, k) => root.files.set(k, v));
        seeded.subdirs.forEach((v, k) => root.subdirs.set(k, v));
      }
    },
  });
  refreshSeededDocs();
  refreshSeededWallpaperLibrary();
  refreshSeededHomeMedia();
  ensureFsDir(RECYCLE_STORAGE_DIR);
  void loadBlobsFromBlocks();
  // The load-time syncDaemonStory ran against the seed tree, which the mount
  // then replaced. Re-run it against the real tree so the story files and the
  // registry pointers agree. Same shape as the ensureFsDir call above.
  syncDaemonStory({ silent: true });
  await fsRefreshFragmentation();
}

// A late commit failure has no call stack to propagate into, so it surfaces
// here, on screen. Silently swallowing it is what phase 2 exists to stop.
function reportVfsError(err) {
  const code = (err && err.code) || '';
  let msg;
  if (code === 'ENOSPC') {
    msg = 'Disk full. Recent changes were not saved.';
  } else if (code === 'EACCES') {
    // Storage disabled or blocked by private-browsing settings. Telling this
    // user to free up space would be useless advice, which is why the
    // localStorage backend separates this from ENOSPC.
    msg = 'Storage is unavailable. sleepOS cannot save in this browser session.';
  } else {
    msg = 'Filesystem error: ' + ((err && err.message) || 'unknown');
  }
  if (typeof showOsToast === 'function') showOsToast(msg);
  else console.warn('sleepOS:', msg);
}

// Start the commit as the page goes away, rather than waiting out the rest of
// the 400ms debounce. IndexedDB cannot be written synchronously at all, so
// there is nothing to do from beforeunload on that path; visibilitychange is
// the earlier signal, and it fires while the page is still alive and
// scriptable, which beforeunload does not reliably do on mobile.
//
// This buys the commit more time. It does not make it durable: vfsFlush is
// async and the page can still be killed mid-commit, so this narrows the
// window rather than closing it.
//
// Deliberately not gated on backend kind - committing early is right for
// both. Firing on ordinary tab switches and minimises costs nothing either:
// vfsFlush early-returns when no ops are pending, and when ops ARE pending
// the commit was going to happen within 400ms regardless.
function fsFlushOnHidden() {
  if (document.visibilityState !== 'hidden') return;
  void vfsFlush();
}
document.addEventListener('visibilitychange', fsFlushOnHidden);

// The localStorage backend's last-ditch save. beforeunload cannot await, and a
// pending commit sits behind a 400ms debounce, so `void vfsFlush()` here would
// silently drop up to 400ms of the user's work on close. localStorage.setItem
// is synchronous and does land, so write the snapshot directly. This
// deliberately reaches past the backend interface: it is the only place that
// does, and it is correct only for the backend whose storage this actually is.
//
// Hence the backend-kind gate. Under IndexedDB this write is not merely
// useless, it is destructive: LOCAL_FS_KEY (os/storage-local.js) and
// FS_MIGRATE_SOURCE_KEY (os/fs-migrate.js) are the same string, 'sleepOS-fs'.
// Migration leaves that key in place for one release on purpose, as the
// recovery path if the database is ever lost - `migrated` lives in the IDB
// superblock, not in localStorage, so the next boot really does re-import from
// it. Writing here would overwrite that frozen pre-migration snapshot on every
// tab close with a vfsSerializeTree copy, which is text-only and therefore has
// every image and sound stripped out - and it would still not save the pending
// IndexedDB writes. fsFlushOnHidden above is what covers those instead.
function fsSnapshotOnUnload() {
  if (fsGetActiveBackendKind() !== 'local') return;
  // vfsIsMounted() is the load-bearing half of this guard. vfsMount publishes
  // _vfsBackend only after _vfsRoot holds real data, so this is what stops us
  // serializing the seed tree over a returning visitor's filesystem if they
  // close the tab during the BIOS sequence.
  if (!vfsIsMounted() || !vfsHasPendingWrites()) return;
  try {
    localStorage.setItem(LOCAL_FS_KEY, JSON.stringify(vfsSerializeTree()));
  } catch (e) { /* unload is too late to report anything useful */ }
}
window.addEventListener('beforeunload', fsSnapshotOnUnload);

function normalizeRecycleEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = String(entry.id || '').trim();
  const name = String(entry.name || '').trim();
  const storedDir = fsNormalizeDir(entry.storedDir || '');
  if (!id || !name || !storedDir) return null;
  return {
    id,
    name,
    kind: String(entry.kind || 'file').toLowerCase(),
    originalDir: fsNormalizeDir(entry.originalDir || ''),
    storedDir,
    deletedAt: Number(entry.deletedAt) || Date.now(),
  };
}

function loadRecycleBin() {
  try {
    return (JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]') || [])
      .map(normalizeRecycleEntry)
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function saveRecycleBin() {
  try { localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(recycleBinEntries)); } catch (e) {}
}

function recycleEntryOriginalPath(entry) {
  if (!entry) return '';
  return entry.originalDir ? entry.originalDir + '\\' + entry.name : entry.name;
}

function recycleEntryStoredPath(entry) {
  if (!entry) return '';
  return entry.storedDir ? entry.storedDir + '\\' + entry.name : entry.name;
}

let recycleBinEntries = loadRecycleBin();
ensureFsDir(RECYCLE_STORAGE_DIR);
// Daemon story state and sync
const DAEMON_STORY_KEY = 'sleepOS-daemon-story';
const ROOT_SYSTEM_FILE_META = [
  { name: 'TERMINAL.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'SYSMON.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'NOTEPAD.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'BROWSER.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'DEFRAG.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'CALC.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'REGEDIT.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'EXPLORER.exe', size: '8,192', date: '11/13/2024  10:31' },
];
const ROOT_PROTECTED_DIRS = new Set(['DOCS', 'PROJECTS', 'SYS', 'CACHE', 'DESKTOP']);
const STORY_FILE_PATHS = {
  notice: 'DOCS\\NOTICE_13.txt',
  incident: 'DOCS\\INCIDENT_A.txt',
  lostContact: 'DOCS\\LOST_CONTACT.txt',
  lastOperator: 'DOCS\\LAST_OPERATOR.txt',
  mirrorProtocol: 'DOCS\\MIRROR_PROTOCOL.txt',
  watchPid: 'SYS\\watch.pid',
  anchorSeed: 'SYS\\anchor.seed',
  quarantineSig: 'SYS\\quarantine.sig',
  mirrorDat: 'CACHE\\mirror.dat',
};
// The story's processes exist; their numbers never did. Phase 5b deleted the
// authored cpu/mem, because a process with no window and no interpreter has no
// measurable execution context and a dash says exactly that. The rows stay:
// TASKKILL 512 is a real story beat, the protected pids answer Access Denied,
// and DAEMON_COUNT spawns phantoms for a player who goes looking.
const BUILTIN_PROCESS_SEED = [
  { pid: 4, name: 'System', protected: true },
  { pid: 52, name: 'csrss.exe', protected: true },
  { pid: 116, name: 'services.exe', protected: true },
  { pid: 124, name: 'lsass.exe', protected: true },
  { pid: 280, name: 'svchost.exe', protected: true },
  { pid: 312, name: 'svchost.exe', protected: true },
  { pid: 440, name: 'dream_kernel.exe', protected: true },
  { pid: 666, name: 'daemon.core', protected: true },
  { pid: 999, name: 'void_monitor.exe', protected: true },
];
const VOID_ACTION_ORDER = ['observe', 'measure', 'listen', 'trace', 'sample', 'stabilize', 'pulse'];
const VOID_ACTION_LABELS = {
  observe: 'Observe',
  measure: 'Measure',
  listen: 'Listen',
  trace: 'Trace',
  sample: 'Sample',
  stabilize: 'Stabilize',
  pulse: 'Pulse',
};

function normalizeVoidActions(actions) {
  const seen = new Set(
    (Array.isArray(actions) ? actions : [])
      .map(action => String(action || '').toLowerCase())
      .filter(action => Object.prototype.hasOwnProperty.call(VOID_ACTION_LABELS, action))
  );
  return VOID_ACTION_ORDER.filter(action => seen.has(action));
}

function createDaemonStoryDefaults() {
  return {
    version: 1,
    stage: 0,
    openedDaemon: false,
    falseContainmentSeen: false,
    killedSoulDaemon: false,
    respawnDisabledKill: false,
    daemonStopped: false,
    wrongVictory: false,
    anchorDeleted: false,
    voidObserved: false,
    voidActions: [],
    mirrorInspected: false,
    protocolInspected: false,
    mirrorLockRestored: false,
    quarantineSigned: false,
    endingReached: false,
    lastEventText: 'none',
  };
}

function daemonNormalizeStory(story) {
  if (!story) return;
  if (story.openedDaemon) story.stage = Math.max(story.stage, 1);
  if (story.falseContainmentSeen) story.stage = Math.max(story.stage, 2);
  if (story.respawnDisabledKill) story.stage = Math.max(story.stage, 3);
  if (story.daemonStopped || story.wrongVictory) story.stage = Math.max(story.stage, 4);
  if (story.anchorDeleted) story.stage = Math.max(story.stage, 5);
  if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
    story.mirrorLockRestored = true;
  }
  if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected)) story.stage = Math.max(story.stage, 6);
  if (story.mirrorLockRestored || story.quarantineSigned) story.stage = Math.max(story.stage, 7);
  if (story.endingReached) story.stage = Math.max(story.stage, 8);
}

function normalizeDaemonStory(saved) {
  const next = Object.assign(createDaemonStoryDefaults(), saved || {});
  next.stage = Math.max(0, Math.min(8, Math.trunc(Number(next.stage) || 0)));
  [
    'openedDaemon',
    'falseContainmentSeen',
    'killedSoulDaemon',
    'respawnDisabledKill',
    'daemonStopped',
    'wrongVictory',
    'anchorDeleted',
    'voidObserved',
    'mirrorInspected',
    'protocolInspected',
    'mirrorLockRestored',
    'quarantineSigned',
    'endingReached',
  ].forEach(key => { next[key] = !!next[key]; });
  next.voidActions = normalizeVoidActions(next.voidActions);
  next.lastEventText = String(next.lastEventText || 'none');
  daemonNormalizeStory(next);
  if (next.stage >= 6 && !next.voidActions.length) next.voidActions = ['trace'];
  return next;
}

function loadDaemonStory() {
  try {
    return normalizeDaemonStory(JSON.parse(localStorage.getItem(DAEMON_STORY_KEY) || 'null'));
  } catch (e) {
    return createDaemonStoryDefaults();
  }
}

function saveDaemonStory() {
  try { localStorage.setItem(DAEMON_STORY_KEY, JSON.stringify(daemonStory)); } catch (e) {}
}

let daemonStory = loadDaemonStory();
let daemonVoidFeed = '';
let daemonVoidFeedMode = '';
let daemonPulseTimer = null;

function daemonStageLabel(stage) {
  if (stage >= 8) return 'Contained';
  if (stage >= 7) return 'Seal Ready';
  if (stage >= 6) return 'Observed';
  if (stage >= 5) return 'Contact';
  if (stage >= 4) return 'Containment Lost';
  if (stage >= 1) return 'Observed';
  return 'Dormant';
}

function getVoidActions(story) {
  return normalizeVoidActions((story || daemonStory)?.voidActions);
}

function isVoidProfiled(story) {
  const target = story || daemonStory;
  if (!target) return false;
  if (target.stage >= 6 || target.quarantineSigned || target.endingReached) return true;
  return getVoidActions(target).some(action => action !== 'observe');
}

function getVoidProfileLabel(story) {
  const target = story || daemonStory;
  const analyticalCount = getVoidActions(target).filter(action => action !== 'observe').length;
  if (target?.endingReached) return 'sealed';
  if (target?.quarantineSigned) return 'bound';
  if (analyticalCount >= 3) return 'deep';
  if (analyticalCount >= 1) return 'active';
  if (getVoidActions(target).length) return 'surface';
  return 'none';
}

function getVoidObjectiveLine(story) {
  const target = story || daemonStory;
  if (!target) return 'No stable directive.';
  if (target.endingReached) return 'Containment complete. Archive only.';
  if (target.stage < 4) return 'The relay is still taking the load. Watch the file.';
  if (!target.anchorDeleted) {
    return target.daemonStopped
      ? 'Lower MIRROR_LOCK and remove SYS\\anchor.seed when you are ready to expose the channel.'
      : 'Silence the relay before you trust what the file looks like.';
  }
  if (!isVoidProfiled(target)) return 'Use Measure, Listen, Trace, Sample, or Pulse here to profile the breach.';
  if (!(target.mirrorInspected || target.protocolInspected)) return 'Compare this file with CACHE\\mirror.dat or DOCS\\MIRROR_PROTOCOL.txt.';
  if (Number(getContainmentValue('MIRROR_LOCK')) !== 1) return 'Restore MIRROR_LOCK before containment can hold.';
  if (!target.quarantineSigned) return 'Run ?????.exe to write SYS\\quarantine.sig.';
  return 'Delete void.tmp. The seal is ready.';
}

function getContainmentTelemetry() {
  const mirrorLockActive = Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const respawnLockActive = Number(getContainmentValue('RESPAWN_LOCK')) === 1;
  const voidPressureBase = Math.max(0, Math.min(99, parseInt(registryData['HKEY_SLEEPBOX_MACHINE']?.['VOID']?.VOID_PRESSURE_BASE?.value) || 12));
  const pressureBase = daemonStory.endingReached
    ? 0
    : daemonStory.quarantineSigned
      ? 18
      : daemonStory.stage >= 7
        ? 24
        : daemonStory.stage >= 5
          ? 79
          : daemonStory.stage >= 4
            ? 46
            : daemonStory.stage >= 2
              ? 23
              : 12;
  const pressure = daemonStory.endingReached ? 0 : Math.min(99, pressureBase + Math.max(0, voidPressureBase - 12));
  const lattice = daemonStory.endingReached
    ? 100
    : mirrorLockActive
      ? daemonStory.quarantineSigned
        ? 92
        : daemonStory.stage >= 7
          ? 76
          : daemonStory.stage >= 5
            ? 61
            : daemonStory.stage >= 4
              ? 74
              : 96
      : daemonStory.stage >= 5
        ? 21
        : daemonStory.stage >= 4
          ? 38
          : 57;
  const signalDepth = daemonStory.endingReached
    ? 0
    : daemonStory.stage >= 7
      ? 88
      : daemonStory.stage >= 5
        ? 73
        : daemonStory.stage >= 4
          ? 51
          : daemonStory.stage >= 2
            ? 26
          : 11;
  const bias = daemonStory.endingReached ? 'sealed' : mirrorLockActive ? 'deflected' : 'user-facing';
  const deleteAuthorized = !daemonStory.endingReached && daemonStory.quarantineSigned && mirrorLockActive;
  const sealReady = !daemonStory.endingReached && !daemonStory.quarantineSigned && daemonStory.anchorDeleted && daemonStory.voidObserved && isVoidProfiled(daemonStory) && (daemonStory.mirrorInspected || daemonStory.protocolInspected) && mirrorLockActive;
  let rating = { code: 'CT-0', label: 'STABLE', color: '#004b61' };
  if (daemonStory.endingReached) rating = { code: 'CT-8', label: 'SEALED', color: '#0a7a2a' };
  else if (deleteAuthorized) rating = { code: 'CT-7', label: 'DELETE AUTHORIZED', color: '#0a5a9c' };
  else if (sealReady) rating = { code: 'CT-6', label: 'SEAL READY', color: '#005f73' };
  else if (daemonStory.anchorDeleted && !mirrorLockActive) rating = { code: 'CT-5', label: 'OPEN BREACH', color: '#8a0036' };
  else if (daemonStory.anchorDeleted) rating = { code: 'CT-4', label: 'CHANNEL EXPOSED', color: '#7a2e00' };
  else if (daemonStory.daemonStopped) rating = { code: 'CT-3', label: 'UNMONITORED', color: '#8a1a00' };
  else if (daemonStory.falseContainmentSeen) rating = { code: 'CT-2', label: 'STRAINED', color: '#8a5a00' };
  else if (daemonStory.openedDaemon) rating = { code: 'CT-1', label: 'OBSERVED', color: '#003f7a' };
  return {
    mirrorLockActive,
    respawnLockActive,
    pressure,
    lattice,
    signalDepth,
    bias,
    sealReady,
    deleteAuthorized,
    rating,
  };
}

function getContainmentChecklist() {
  return [
    { label: 'RESPAWN_LOCK cleared', done: Number(getContainmentValue('RESPAWN_LOCK')) === 0 },
    { label: 'PID 512 offline', done: daemonStory.daemonStopped },
    { label: 'void channel observed', done: daemonStory.voidObserved },
    { label: 'void channel profiled', done: isVoidProfiled(daemonStory) },
    { label: 'mirror evidence inspected', done: daemonStory.mirrorInspected || daemonStory.protocolInspected },
    { label: 'anchor released', done: daemonStory.anchorDeleted },
    { label: 'MIRROR_LOCK restored', done: daemonStory.anchorDeleted && Number(getContainmentValue('MIRROR_LOCK')) === 1 },
    { label: 'quarantine signature present', done: daemonStory.quarantineSigned },
    { label: 'final delete authorized', done: !daemonStory.endingReached && daemonStory.quarantineSigned && Number(getContainmentValue('MIRROR_LOCK')) === 1 },
  ];
}

function daemonStoryChanged(before) {
  try {
    return JSON.stringify(before) !== JSON.stringify(daemonStory);
  } catch (e) {
    return true;
  }
}

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

function ensureStoryTextFile(path, value) {
  const { dirName, fileName } = fsSplitPath(path);
  const dir = ensureFsDir(dirName);
  const prev = dir.files.has(fileName) ? dir.files.get(fileName) : null;
  dir.files.set(fileName, value);
  vfsQueueDirectWrite(dirName, fileName, prev);
}

function daemonNoticeContent() {
  return [
    '== NOTICE 13 ==',
    '',
    'If soul_daemon.exe is terminated while RESPAWN_LOCK remains active,',
    'the watch layer will simply seed a replacement.',
    '',
    'Killing the process does not remove what it is holding back.',
    '',
    'Required path:',
    '  HKEY_SLEEPBOX_MACHINE\\Containment\\RESPAWN_LOCK',
    '',
    'Only proceed if you mean to test containment.',
  ].join('\n');
}

function daemonIncidentContent() {
  return [
    '== INCIDENT A ==',
    '',
    'Termination succeeded.',
    'Symptoms worsened immediately.',
    '',
    'The daemon was holding something back. It is no longer holding it.',
    '',
    'Read DOCS\\LOST_CONTACT.txt.',
  ].join('\n');
}

function daemonLostContactContent() {
  return [
    '== LOST CONTACT ==',
    '',
    'The operator who left this note killed the daemon.',
    'They thought that would be the end of it.',
    '',
    'It was not.',
    '',
    'The anchor file - SYS\\anchor.seed - was keeping the mirror',
    'pointed away from the user. When the daemon went quiet,',
    'the anchor was still holding.',
    '',
    'If you are reading this after killing it:',
    '  - The anchor may still be in place. Check SYS\\anchor.seed.',
    '  - Do not delete it without understanding what it does.',
    '  - Read SYS\\anchor.seed before you touch it.',
    '',
    'When the anchor is removed, contact begins.',
    'Have a plan before you do that.',
  ].join('\n');
}

function daemonLastOperatorContent() {
  const lines = ['== LAST OPERATOR ==', ''];

  if (daemonStory.daemonStopped && !daemonStory.anchorDeleted) {
    // Killed daemon first, anchor still present
    lines.push(
      'If you killed it and the room went quiet, you did what I did.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The anchor file keeps the mirror pointed away from the user.',
      'The current anchor is SYS\\anchor.seed.',
      'Lower MIRROR_LOCK and delete it when you are ready to inspect the breach.',
      '',
      'If you intend to seal the breach again, restore MIRROR_LOCK before you run the quarantine launcher.',
    );
  } else if (daemonStory.anchorDeleted && !daemonStory.daemonStopped) {
    // Deleted anchor first, daemon still running
    lines.push(
      'You removed the anchor before the daemon relay went offline.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The anchor is gone. The channel is open.',
      'The daemon is still running - it can no longer deflect what is coming through.',
      '',
      'Inspect void.tmp. Read MIRROR_PROTOCOL.txt.',
      'If you intend to seal the breach, restore MIRROR_LOCK before running the quarantine launcher.',
    );
  } else {
    // Both done, or generic fallback
    lines.push(
      'The daemon is offline. The anchor is gone.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The channel is open. Inspect void.tmp.',
      'Read DOCS\\MIRROR_PROTOCOL.txt.',
      '',
      'Restore MIRROR_LOCK before you run the quarantine launcher.',
    );
  }

  return lines.join('\n');
}

function daemonMirrorProtocolContent() {
  const lines = [
    '== MIRROR PROTOCOL ==',
    '',
    'Status:',
    `  MIRROR_LOCK   = ${Number(getContainmentValue('MIRROR_LOCK')) ? 1 : 0}`,
    `  RESPAWN_LOCK  = ${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    `  QUARANTINE    = ${daemonStory.quarantineSigned ? 'SIGNED' : 'UNSIGNED'}`,
    '',
    'Procedure:',
    daemonStory.daemonStopped
      ? '  1. daemon relay is offline - respawn risk is low if RESPAWN_LOCK=0'
      : '  1. daemon is still running - it cannot deflect void.tmp anymore',
    Number(getContainmentValue('MIRROR_LOCK')) === 0
      ? '  2. MIRROR_LOCK is 0 - the breach is open, inspect freely'
      : '  2. MIRROR_LOCK is restored - lattice is deflecting again',
    '  3. profile void.tmp directly - Measure, Listen, Trace, Sample, or Pulse',
    '  4. compare CACHE\\mirror.dat with void.tmp - see NOTE below',
    '  5. restore MIRROR_LOCK before launching ?????.exe',
    '  6. delete void.tmp only after SYS\\quarantine.sig is signed',
    '',
    'NOTE - mirror.dat vs void.tmp:',
    '  CACHE\\mirror.dat  : written by daemon.core, clean, internal',
    '  void.tmp          : external origin, should not exist here',
    '',
    '  void.tmp came through the channel the anchor was suppressing.',
    '  It did not originate here.',
    '',
    '  DO NOT open void.tmp from an uncontrolled state.',
    '  Quarantine and delete it - do not try to read it as data.',
  ];
  if (daemonStory.stage >= 5) {
    lines.push('', 'Note from daemon.core:', '  I was keeping the channel off-axis so it could not reach you.');
  }
  return lines.join('\n');
}

function daemonMirrorDatContent() {
  return [
    'mirror.dat',
    '',
    '[reflection offset] 0.17',
    '[signal age]        before current boot',
    '[voice match]       negative',
    '[source]            internal - daemon-managed lattice reflection',
    '[anomaly]           none',
    '',
    'This file is a stable read. The lattice reflection is clean.',
    'daemon.core wrote this as part of normal mirror management.',
    '',
    'Compare with void.tmp. They are not the same kind of file.',
  ].join('\n');
}

function daemonAnchorSeedContent() {
  return [
    'anchor.seed',
    '',
    'anchor-class: mirror-lattice',
    'deletion-policy: requires MIRROR_LOCK=0',
    'owner: HKEY_SLEEPBOX_MACHINE\\Containment',
    '',
    'Removing this file widens the channel.',
  ].join('\n');
}

function daemonWatchPidContent() {
  return [
    'watch.pid',
    '',
    'pid=512',
    'name=soul_daemon.exe',
    'policy=restart_on_exit',
    `respawn_lock=${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    '',
    'This is the watch layer. It restarts pid 512. It is not pid 512.',
  ].join('\n');
}

function daemonQuarantineSigContent() {
  return [
    'quarantine.sig',
    '',
    `launcher=${getExeDisplayName()}`,
    'state=armed',
    'target=void.tmp',
    'mirror_lock=1',
    'seal_phrase=CONTAINMENT_COMPLETE',
  ].join('\n');
}

function daemonQuarantinePendingContent() {
  return [
    'quarantine.sig',
    '',
    'launcher=?????.exe',
    'state=unsigned',
    'target=void.tmp',
    '',
    'This signature file exists but has not been written.',
    'Run ?????.exe after the mirror lattice is restored to sign it.',
    'A valid signature is required before void.tmp can be deleted.',
  ].join('\n');
}

function buildDaemonCoreRawContent() {
  const telemetry = getContainmentTelemetry();
  const mirrorLockActive = Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const liveStatus = daemonStory.endingReached
    ? 'Contained'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? 'Seal Interrupted'
      : daemonStageLabel(daemonStory.stage);
  const lines = [
    'daemon.core',
    '',
    `[stage] ${daemonStory.stage} / ${daemonStageLabel(daemonStory.stage)}`,
    `[status] ${liveStatus}`,
    `[containment] ${telemetry.rating.code} / ${telemetry.rating.label}`,
    `[owner] SYSTEM\\???`,
    `[mirror_lock] ${mirrorLockActive ? 1 : 0}`,
    `[respawn_lock] ${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    `[void_pressure] ${telemetry.pressure}`,
    `[lattice_stability] ${telemetry.lattice}`,
    `[signal_depth] ${telemetry.signalDepth}`,
    `[aperture_bias] ${telemetry.bias}`,
    `[temporal_drift] ${registryData['HKEY_SLEEPBOX_MACHINE']?.['SOUL\\Metrics']?.TEMPORAL_DRIFT?.value ?? '+/-2.3yr'}`,
    `[observer_count] ${registryData['HKEY_SLEEPBOX_MACHINE']?.['VOID']?.OBSERVER_COUNT?.value ?? '[classified]'}`,
    '',
  ];
  if (daemonStory.endingReached) {
    lines.push(
      'CONTAINMENT COMPLETE.',
      'The breach is closed.',
      'I will stay archived here in case it opens again.',
    );
  } else if (daemonStory.anchorDeleted) {
    lines.push(
      'You removed the anchor.',
      'I was keeping the mirror off your face.',
      '',
      'Restore MIRROR_LOCK before you run the quarantine launcher.',
      'Delete void.tmp only after the signature exists.',
    );
  } else if (daemonStory.daemonStopped) {
    lines.push(
      'The latch is open.',
      'Killing the process did not delete anything.',
      'Open void.tmp.',
    );
  } else if (daemonStory.falseContainmentSeen) {
    lines.push(
      'You tested the watch layer.',
      'It answered you with another process.',
      '',
      'If you want silence, clear RESPAWN_LOCK first.',
    );
  } else if (daemonStory.openedDaemon) {
    lines.push(
      'This file is what is holding it shut.',
      '',
      'NOTICE_13 has been copied into DOCS.',
    );
  } else {
    lines.push(
      'metadata unreadable',
      'modified: always',
      'access: observe only',
    );
  }
  return lines.join('\n');
}

function buildVoidProbeNotes() {
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const notes = [];
  if (daemonStory.stage >= 4) {
    notes.push(`offset 0x0008: reported size = 0 bytes / observed depth = ${telemetry.signalDepth}`);
    notes.push(`offset 0x0012: origin classification = external / aperture bias = ${telemetry.bias}`);
  }
  if (daemonStory.daemonStopped) notes.push('offset 0x0021: PID 512 silence increased readability');
  if (daemonStory.anchorDeleted) notes.push('offset 0x0034: anchor.seed removal exposed the user-facing side');
  if (actions.includes('observe')) {
    notes.push(
      daemonStory.stage >= 5
        ? 'offset 0x0100: surface is the breach itself, not daemon.core residue'
        : 'offset 0x0100: active window edges repeat on the inside of the file'
    );
  }
  if (actions.includes('measure')) {
    notes.push(`offset 0x0118: locality check failed / disk distance behaves like ${telemetry.signalDepth} units of depth`);
    notes.push('offset 0x0124: zero-byte report is false on contact');
  }
  if (actions.includes('listen')) {
    notes.push('offset 0x0140: room-tone match positive / human voice match negative');
    notes.push('offset 0x014e: response is pressure change, no linguistic content');
  }
  if (actions.includes('trace')) {
    notes.push(
      daemonStory.stage >= 5
        ? 'offset 0x0180: return path = user-facing aperture <- mirror offset <- unresolved source'
        : 'offset 0x0180: return path = monitor gap <- reflected surface'
    );
    if (daemonStory.anchorDeleted) notes.push('offset 0x018f: no anchor remains to push the angle away from the user');
  }
  if (actions.includes('sample')) {
    notes.push('offset 0x01c0: daemon-authored signature = false');
    notes.push('offset 0x01d2: CACHE\\mirror.dat mismatch confirmed');
  }
  if (actions.includes('stabilize')) {
    notes.push(
      telemetry.mirrorLockActive
        ? 'offset 0x0210: MIRROR_LOCK bends the read angle but does not internalize the object'
        : 'offset 0x0210: stabilization failed / aperture remains user-facing'
    );
  }
  if (actions.includes('pulse')) {
    notes.push(
      daemonStory.quarantineSigned
        ? 'offset 0x0240: quarantine signature binds to target id = void.tmp'
        : 'offset 0x0240: echo returns before current boot'
    );
  }
  if ((daemonStory.mirrorInspected || daemonStory.protocolInspected) && daemonStory.stage >= 5) {
    notes.push('cross-check: mirror.dat clean, internal, daemon-managed / void.tmp foreign, external, non-local');
  }
  return notes;
}

function buildVoidTmpRawContent() {
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const lines = [
    'void.tmp',
    '',
    `[containment] ${telemetry.rating.code} / ${telemetry.rating.label}`,
    `[pressure] ${telemetry.pressure}`,
    `[mirror_lock] ${telemetry.mirrorLockActive ? 1 : 0}`,
    `[signature] ${daemonStory.quarantineSigned ? 'present' : 'missing'}`,
    `[lattice_stability] ${telemetry.lattice}`,
    `[signal_depth] ${telemetry.signalDepth}`,
    `[aperture_bias] ${telemetry.bias}`,
    '[origin] external / unresolved',
    `[probe_record] ${actions.length}/${VOID_ACTION_ORDER.length}`,
    `[profile] ${getVoidProfileLabel()}`,
    `[probes] ${actions.length ? actions.map(action => VOID_ACTION_LABELS[action]).join(', ') : 'none recorded'}`,
    '',
  ];
  if (daemonStory.endingReached) {
    lines.push('No active signal remains.', '', 'Archive note:', '  The breach surface is gone. The record remains.');
  } else if (daemonStory.stage >= 5) {
    lines.push(
      'The aperture is open.',
      'Something is pressing against the reflected side of the file.',
    );
  } else if (daemonStory.stage >= 4) {
    lines.push(
      'Pressure rose when PID 512 stayed dead.',
      'The monitor was keeping this file quiet, not keeping it alive.',
    );
  } else {
    lines.push(
      '[content redacted]',
      'The file is present but does not yet answer.',
    );
  }
  if (!daemonStory.endingReached && daemonStory.stage >= 4) {
    const notes = buildVoidProbeNotes();
    if (notes.length) {
      lines.push('', 'Recovered fragments:');
      notes.forEach(note => lines.push('  ' + note));
    }
    lines.push('', 'Containment path:', '  ' + getVoidObjectiveLine());
    if (!isVoidProfiled()) lines.push('  Direct probes make the file more legible.');
  }
  return lines.join('\n');
}

function getContainmentValue(name) {
  return registryData['HKEY_SLEEPBOX_MACHINE']['Containment'][name].value;
}

function getDaemonRegistryNode() {
  return registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS\\Daemon'];
}

function getRootSystemFiles(options) {
  const opts = options || {};
  const names = ROOT_SYSTEM_FILE_META.map(entry => entry.name);
  const explorerIndex = names.indexOf('EXPLORER.exe');
  if (opts.includeExplorer === false && explorerIndex !== -1) names.splice(explorerIndex, 1);
  if (!daemonStory.endingReached) names.push('void.tmp');
  names.push('daemon.core', '?????.exe');
  return names;
}

function isVisibleRootSystemFile(name, options) {
  const target = String(name || '').toUpperCase();
  return getRootSystemFiles(options).some(item => item.toUpperCase() === target);
}

function isVisibleSystemPath(path, options) {
  const { dirName, fileName } = fsSplitPath(path);
  return !dirName && isVisibleRootSystemFile(fileName, options);
}

function getTerminalRootSystemEntries(options) {
  const opts = options || {};
  const entries = ROOT_SYSTEM_FILE_META
    .filter(entry => opts.includeExplorer !== false || entry.name !== 'EXPLORER.exe')
    .map(entry => ({ ...entry }));
  if (!daemonStory.endingReached) entries.push({ name: 'void.tmp', size: '0', date: '11/13/2024  03:17' });
  entries.push({ name: 'daemon.core', size: '??', date: '11/13/2024  ??:??' });
  entries.push({ name: '?????.exe', size: '??', date: '11/13/2024  ??:??' });
  return entries;
}

function getBuiltInProcesses() {
  const base = BUILTIN_PROCESS_SEED.map(proc => ({ ...proc }));
  if (!daemonStory.daemonStopped && !daemonStory.endingReached) {
    base.push({
      pid: 512,
      name: daemonStory.stage >= 1 ? 'soul_daemon.exe' : 'soul_svc.exe',
      protected: daemonStory.stage < 1,
    });
  }
  if (daemonStory.stage >= 4 && !daemonStory.endingReached) {
    base.push({ pid: 1008, name: 'mirror_watch.exe', protected: true });
  }
  if (daemonStory.stage >= 5 && !daemonStory.endingReached) {
    base.push({ pid: 1333, name: 'signal_window.exe', protected: true });
  }
  // DAEMON_COUNT registry key: extra phantom processes when count > 7
  const daemonCount = parseInt(registryData['HKEY_SLEEPBOX_MACHINE']?.['SOUL\\Metrics']?.DAEMON_COUNT?.value) || 7;
  for (let i = 8; i <= Math.min(daemonCount, 20); i++) {
    base.push({ pid: 500 + i * 13, name: 'soul_svc_' + String(i).padStart(2, '0') + '.exe', protected: true });
  }
  return base.sort((a, b) => a.pid - b.pid);
}

function findBuiltInProcess(pid) {
  return getBuiltInProcesses().find(proc => proc.pid === pid) || null;
}

function syncDaemonStoryRegistry() {
  const daemonReg = getDaemonRegistryNode();
  daemonReg.STATUS.value = daemonStageLabel(daemonStory.stage);
  daemonReg.LAST_EVENT.value = daemonStory.lastEventText || 'none';
  daemonReg.OBSERVED.value = daemonStory.openedDaemon ? 1 : 0;
  registryData['HKEY_SLEEPBOX_MACHINE']['Containment'].ANCHOR_FILE.value = 'SYS\\anchor.seed';
  saveRegistry();
}

// Stays synchronous, and every removeFsPath below is deliberately floated.
// syncDaemonStory calls this from updateDaemonStory, which runs from dozens of
// story beats and from boot, none of which can await; and the tree mutation
// inside vfsUnlink is itself synchronous, so the file is gone from the tree by
// the time the promise is handed back. Only the commit is deferred, and that
// was already debounced before this migration.
function syncDaemonStoryFiles() {
  ensureFsDir('DOCS');
  ensureFsDir('SYS');
  ensureFsDir('CACHE');
  if (daemonStory.openedDaemon) ensureStoryTextFile(STORY_FILE_PATHS.notice, daemonNoticeContent());
  else void removeFsPath(STORY_FILE_PATHS.notice);
  if (daemonStory.daemonStopped) ensureStoryTextFile(STORY_FILE_PATHS.incident, daemonIncidentContent());
  else void removeFsPath(STORY_FILE_PATHS.incident);
  if (daemonStory.daemonStopped) ensureStoryTextFile(STORY_FILE_PATHS.lostContact, daemonLostContactContent());
  else void removeFsPath(STORY_FILE_PATHS.lostContact);
  if (daemonStory.stage >= 4) {
    ensureStoryTextFile(STORY_FILE_PATHS.lastOperator, daemonLastOperatorContent());
    if (!daemonStory.endingReached) ensureStoryTextFile(STORY_FILE_PATHS.mirrorDat, daemonMirrorDatContent());
  } else {
    void removeFsPath(STORY_FILE_PATHS.lastOperator);
    void removeFsPath(STORY_FILE_PATHS.mirrorDat);
  }
  if (daemonStory.anchorDeleted) ensureStoryTextFile(STORY_FILE_PATHS.mirrorProtocol, daemonMirrorProtocolContent());
  else void removeFsPath(STORY_FILE_PATHS.mirrorProtocol);
  if (!daemonStory.anchorDeleted) ensureStoryTextFile(STORY_FILE_PATHS.anchorSeed, daemonAnchorSeedContent());
  else void removeFsPath(STORY_FILE_PATHS.anchorSeed);
  if (daemonStory.falseContainmentSeen && !daemonStory.daemonStopped && !daemonStory.endingReached) ensureStoryTextFile(STORY_FILE_PATHS.watchPid, daemonWatchPidContent());
  else void removeFsPath(STORY_FILE_PATHS.watchPid);
  if (daemonStory.quarantineSigned) ensureStoryTextFile(STORY_FILE_PATHS.quarantineSig, daemonQuarantineSigContent());
  else if (daemonStory.stage >= 4) ensureStoryTextFile(STORY_FILE_PATHS.quarantineSig, daemonQuarantinePendingContent());
  else void removeFsPath(STORY_FILE_PATHS.quarantineSig);
  if (daemonStory.endingReached) {
    void removeFsPath(STORY_FILE_PATHS.mirrorDat);
    void removeFsPath(STORY_FILE_PATHS.watchPid);
  }
}

function refreshDaemonStoryViews() {
  document.dispatchEvent(new CustomEvent('fs-changed'));
  applyDaemonVisualState();
  applyDaemonWindowState();
  if (typeof renderDaemonPanel === 'function' && document.getElementById('wb-daemon')) renderDaemonPanel();
  if (typeof renderVoid === 'function' && document.getElementById('wb-void')) renderVoid();
  // Reveal quarantine.exe name on desktop icon when signed
  const exeIconLabel = document.querySelector('[data-icon-key="?????.exe"] .di-name');
  if (exeIconLabel) exeIconLabel.textContent = iconLabel(getExeDisplayName());
}

function getDaemonVisualStage() {
  if (daemonStory.endingReached) return 0;
  if (daemonStory.stage >= 7) return 7;
  if (daemonStory.stage >= 5) return 5;
  if (daemonStory.stage >= 4) return 4;
  return 0;
}

// The daemon's own corruption dial, in [0,1]. Derived from the story stage,
// not stored - there is nothing here that a reload could not recompute, and a
// persisted copy would be one more field able to disagree with the stage.
//
// These two visual consumers used to read getDriveFragmentationLevel(). That
// worked only because the old fragmentation number was fake and idled near
// 0.68 - it was a mood dial wearing a disk metric's name. Phase 4 made
// fragmentation a real measurement, and a real filesystem on a fresh install
// scores near 0, which would have driven the visual level to 0 and stopped the
// glitches appearing at all for most players. No test would have caught it.
//
// So the story owns its own number now. The stage mapping reproduces the
// visual levels the old fake value produced at each stage: stage 4 crosses the
// old 0.22 threshold, stage 5 crosses 0.42, and stage 7 crosses 0.62.
function getDaemonCorruption() {
  if (daemonStory.endingReached) return 0;
  const stage = getDaemonVisualStage();
  if (stage >= 7) return 0.72;
  if (stage >= 5) return 0.5;
  if (stage >= 4) return 0.3;
  return 0.05;
}

function getDriveFragmentationVisualLevel() {
  if (daemonStory.endingReached) return 0;
  const visualStage = getDaemonVisualStage();
  if (visualStage < 4) return 0;
  const fragLevel = getDaemonCorruption();
  if (fragLevel < 0.22) return 0;
  if (visualStage >= 7 && fragLevel >= 0.62) return 3;
  if (visualStage >= 5 && fragLevel >= 0.42) return 2;
  return 1;
}

function scheduleDaemonPulse() {
  clearTimeout(daemonPulseTimer);
  daemonPulseTimer = null;
  const visualStage = getDaemonVisualStage();
  if (!visualStage) return;
  const fragLevel = getDaemonCorruption();
  const fragFactor = Math.max(0, Math.min(1, (fragLevel - 0.02) / 0.9));
  const delayScale = 1.7 - fragFactor * 0.7;
  const baseMinDelay = visualStage >= 7 ? 3800 : visualStage >= 5 ? 6200 : 9800;
  const baseMaxDelay = visualStage >= 7 ? 7200 : visualStage >= 5 ? 10800 : 14800;
  const minDelay = Math.round(baseMinDelay * delayScale);
  const maxDelay = Math.round(baseMaxDelay * delayScale);
  const pulseIntensity = Math.max(1, Math.round(visualStage * (0.55 + fragFactor * 0.45)));
  const nextDelay = minDelay + Math.random() * (maxDelay - minDelay);
  daemonPulseTimer = setTimeout(() => {
    triggerGlitch({ intensity: pulseIntensity, subtle: true });
    scheduleDaemonPulse();
  }, nextDelay);
}

function applyDaemonVisualState() {
  const body = document.body;
  if (!body) return;
  body.classList.remove('daemon-visual-4', 'daemon-visual-5', 'daemon-visual-7', 'frag-visual-1', 'frag-visual-2', 'frag-visual-3');
  const visualStage = getDaemonVisualStage();
  const fragVisualLevel = getDriveFragmentationVisualLevel();
  if (visualStage) body.classList.add(`daemon-visual-${visualStage}`);
  if (fragVisualLevel) body.classList.add(`frag-visual-${fragVisualLevel}`);
  scheduleDaemonPulse();
}

function applyDaemonWindowState() {
  const daemonWin = wins['daemon']?.el;
  const voidWin = wins['void']?.el;
  if (daemonWin) daemonWin.classList.add('daemon-surface');
  if (voidWin) voidWin.classList.add('void-surface');
}

function pulseDaemonWindows(intensity, options) {
  const subtle = !!options?.subtle;
  ['daemon', 'void'].forEach(id => {
    const el = wins[id]?.el;
    if (!el) return;
    const x = subtle
      ? (Math.random() < 0.5 ? -0.75 : 0.75)
      : intensity >= 7
        ? (Math.random() < 0.5 ? -2 : 2)
        : (Math.random() < 0.5 ? -1 : 1);
    const y = subtle
      ? 0
      : intensity >= 7
        ? (Math.random() < 0.5 ? -1 : 1)
        : 0;
    el.style.setProperty('--pulse-x', x + 'px');
    el.style.setProperty('--pulse-y', y + 'px');
    el.classList.add('window-afterimage');
    setTimeout(() => {
      const current = wins[id]?.el;
      if (!current || current !== el) return;
      el.classList.remove('window-afterimage');
      el.style.removeProperty('--pulse-x');
      el.style.removeProperty('--pulse-y');
    }, subtle ? 150 : intensity >= 7 ? 260 : 180);
  });
}

function syncDaemonStory(options) {
  const opts = options || {};
  daemonNormalizeStory(daemonStory);
  saveDaemonStory();
  syncDaemonStoryRegistry();
  syncDaemonStoryFiles();
  if (!opts.silent) refreshDaemonStoryViews();
}

function updateDaemonStory(mutator, options) {
  const before = normalizeDaemonStory(daemonStory);
  mutator(daemonStory);
  daemonNormalizeStory(daemonStory);
  if (!daemonStoryChanged(before) && !options?.forceSync) return false;
  syncDaemonStory(options);
  if (options?.glitch) triggerGlitch();
  if (options?.notice) {
    const info = typeof options.notice === 'string'
      ? { message: options.notice, title: 'Containment Notice', icon: 'icon:daemon' }
      : options.notice;
    osAlert(info.message, info.title || 'Containment Notice', info.icon || 'icon:daemon');
  }
  return true;
}

function daemonActivate(trigger) {
  return updateDaemonStory(story => {
    if (!story.openedDaemon) {
      story.openedDaemon = true;
      story.lastEventText = 'daemon.core observed';
    } else if (trigger === 'raw' && story.lastEventText === 'none') {
      story.lastEventText = 'daemon.core observed';
    }
  }, { forceSync: true });
}

function daemonRecordInvestigation(kind) {
  return updateDaemonStory(story => {
    if (kind === 'void') story.voidObserved = true;
    if (kind === 'mirror') story.mirrorInspected = true;
    if (kind === 'protocol') story.protocolInspected = true;
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
      story.mirrorLockRestored = true;
      story.lastEventText = 'mirror lattice restored';
      return;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && story.stage < 6) {
      story.lastEventText = 'void channel profiled';
    }
  });
}

function daemonRecordVoidAction(mode) {
  return updateDaemonStory(story => {
    story.voidObserved = true;
    story.voidActions = normalizeVoidActions([...(Array.isArray(story.voidActions) ? story.voidActions : []), mode]);
    if (mode === 'observe') {
      if (story.lastEventText === 'none') story.lastEventText = 'void surface observed';
    } else if (story.stage < 6 || story.lastEventText === 'none') {
      story.lastEventText = `void probe recorded: ${mode}`;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
      story.mirrorLockRestored = true;
      story.lastEventText = 'mirror lattice restored';
      return;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && story.stage < 6) {
      story.lastEventText = 'void channel profiled';
    }
  }, { forceSync: true });
}

function getVoidMeasureEntries(telemetry) {
  return [
    ['Containment', `${telemetry.rating.code} / ${telemetry.rating.label}`],
    ['Void Pressure', String(telemetry.pressure)],
    ['Lattice Stability', String(telemetry.lattice)],
    ['Signal Depth', String(telemetry.signalDepth)],
    ['Aperture Bias', telemetry.bias],
    ['Disk Locality', 'negative'],
  ];
}

function renderVoidReadout(out, content, telemetry) {
  if (!out) return;
  if (daemonVoidFeedMode === 'measure') {
    const cards = getVoidMeasureEntries(telemetry).map(([label, value]) => `
      <div style="border:1px solid #123512;background:#061006;padding:6px;min-width:0;">
        <div style="color:#8db98d;text-transform:uppercase;font-size:9px;letter-spacing:0.03em;margin-bottom:3px;">${escHtml(label)}</div>
        <div style="color:#b8efb8;font-size:11px;line-height:1.35;word-break:break-word;">${escHtml(value)}</div>
      </div>
    `).join('');
    out.style.whiteSpace = 'normal';
    out.style.padding = '8px';
    out.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-content:start;">${cards}</div>`;
    return;
  }
  out.style.whiteSpace = 'pre-wrap';
  out.style.padding = '10px';
  out.textContent = content;
}

function canDeleteAnchorSeed() {
  return Number(getContainmentValue('MIRROR_LOCK')) === 0;
}

function canAttemptDeleteItem(path, fallbackDir, meta) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
  if (upperPath === 'VOID.TMP') return true;
  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) return false;
  if (meta?.sysfile) return false;
  return true;
}

async function deleteVirtualPath(path, fallbackDir) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
  const fileLabel = fileName || path;
  if (!fileName) return { ok: false, message: 'Usage: DEL <file>' };

  if (upperPath === 'VOID.TMP') {
    if (daemonStory.endingReached) return { ok: false, message: 'File not found: void.tmp' };
    if (!daemonStory.quarantineSigned) {
      return {
        ok: false,
        message: 'void.tmp refuses to go quietly.',
        details: ['A quarantine signature is required before deletion will hold.'],
      };
    }
    if (Number(getContainmentValue('MIRROR_LOCK')) !== 1) {
      return {
        ok: false,
        message: 'void.tmp remains unstable.',
        details: ['Restore HKEY_SLEEPBOX_MACHINE\\Containment\\MIRROR_LOCK to 1 before the final delete.'],
      };
    }
    updateDaemonStory(story => {
      story.endingReached = true;
      story.lastEventText = 'containment complete';
    });
    if (wins['void']) closeWin('void');
    if (typeof setupIcons === 'function') setupIcons();
    setTimeout(playContainmentEndingReboot, 140);
    return {
      ok: true,
      deleted: true,
      details: ['Deleted: void.tmp', 'SYS\\quarantine.sig holds.', 'Containment complete.'],
    };
  }

  if (upperPath === 'DAEMON.CORE') {
    return {
      ok: false,
      message: 'Access denied.',
      details: ['daemon.core is not removable.', 'It remains in archive even when it is no longer active.'],
    };
  }

  if (upperPath === '?????.EXE') {
    return {
      ok: false,
      message: 'The launcher refuses deletion.',
      details: ['If you need it quiet, leave it unopened.'],
    };
  }

  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['Core directories are protected.'],
    };
  }

  if (upperPath === STORY_FILE_PATHS.anchorSeed.toUpperCase()) {
    if (!canDeleteAnchorSeed()) {
      return {
        ok: false,
        message: 'anchor.seed will not release.',
        details: ['Lower HKEY_SLEEPBOX_MACHINE\\Containment\\MIRROR_LOCK to 0 first.'],
      };
    }
    // Must be awaited. `if (!promise)` is always false, which would kill this
    // not-found branch outright and fire the story beat below unconditionally.
    if (!await removeFsPath(STORY_FILE_PATHS.anchorSeed)) {
      return { ok: false, message: 'File not found: ' + fileLabel };
    }
    updateDaemonStory(story => {
      story.anchorDeleted = true;
      story.lastEventText = 'anchor released';
      daemonVoidFeed = 'The aperture widens. Something on the reflected side notices the room.';
      daemonVoidFeedMode = '';
    }, {
      glitch: true,
      notice: {
        title: 'Anchor Lost',
        icon: 'icon:void',
        message: 'The mirror anchor is gone.\n\nKeep daemon.core and void.tmp isolated from your active work while you inspect the breach.',
      },
    });
    return {
      ok: true,
      deleted: true,
      details: ['Deleted: anchor.seed', 'Mirror anchor released.', 'The channel is no longer deflected.'],
    };
  }

  if (isVisibleSystemPath(path, { includeExplorer: true })) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['System files are protected.'],
    };
  }

  const deleted = await recycleVirtualPath(path, fallbackDir);
  if (!deleted.ok) return deleted;
  syncDaemonStory({ silent: false });
  return deleted;
}

// Testing helper: prime the endgame state, then run the real final delete.
async function forceDeleteVoidTmp() {
  if (daemonStory.endingReached) {
    return { ok: false, message: 'void.tmp is no longer present.' };
  }
  const containment = registryData['HKEY_SLEEPBOX_MACHINE']?.['Containment'];
  if (containment?.MIRROR_LOCK) containment.MIRROR_LOCK.value = 1;
  saveRegistry();
  updateDaemonStory(story => {
    story.openedDaemon = true;
    story.falseContainmentSeen = true;
    story.daemonStopped = true;
    story.anchorDeleted = true;
    story.voidObserved = true;
    story.voidActions = VOID_ACTION_ORDER.slice();
    story.mirrorInspected = true;
    story.protocolInspected = true;
    story.mirrorLockRestored = true;
    story.quarantineSigned = true;
    story.lastEventText = 'debug skip armed';
  }, { forceSync: true });
  return await deleteVirtualPath('void.tmp');
}
window.forceDeleteVoidTmp = forceDeleteVoidTmp;

function killSoulDaemonProcess() {
  if (daemonStory.stage < 1) {
    return {
      ok: false,
      message: 'ERROR: Access is denied. (PID 512)',
      details: ['soul_svc.exe is still registered as a protected service.'],
    };
  }
  if (daemonStory.daemonStopped || daemonStory.endingReached) {
    return { ok: false, message: 'ERROR: The process with PID 512 was not found.' };
  }
  if (Number(getContainmentValue('RESPAWN_LOCK')) !== 0) {
    updateDaemonStory(story => {
      story.killedSoulDaemon = true;
      story.falseContainmentSeen = true;
      story.lastEventText = 'respawn loop observed';
    }, { glitch: true });
    return {
      ok: false,
      respawned: true,
      message: 'soul_daemon.exe terminated.',
      details: [
        'watch.pid restored the process before the table settled.',
        'RESPAWN_LOCK is still active.',
      ],
    };
  }
  updateDaemonStory(story => {
    story.killedSoulDaemon = true;
    story.falseContainmentSeen = true;
    story.respawnDisabledKill = true;
    story.daemonStopped = true;
    story.wrongVictory = true;
    story.lastEventText = 'daemon relay offline';
    daemonVoidFeed = 'The monitor goes missing. The pressure does not.';
    daemonVoidFeedMode = '';
  }, {
    glitch: true,
    notice: {
      title: 'Monitor Link Lost',
      icon: 'icon:warning',
      message: 'PID 512 stayed dead.\n\nvoid.tmp and CACHE\\mirror.dat should now be treated as active evidence.',
    },
  });
  return {
    ok: true,
    stopped: true,
    message: 'SUCCESS: soul_daemon.exe terminated.',
    details: [
      'The process does not respawn.',
      'Void pressure begins to climb in its absence.',
    ],
  };
}

syncDaemonStory({ silent: true });

// The one place that answers "what processes exist" - and, since this phase,
// the one place that decides what happens when a process row's End Task /
// TASKKILL-equivalent action is triggered. Both `ps` (apps/terminal.js) and
// SYSMON (apps/sysmon.js) read buildProcessRows, so they cannot disagree
// about what processes exist; both also route their "end this process"
// action through endProcessAction below, so they cannot disagree about what
// happens when the user tries to end one either. endProcessAction lives here
// rather than in apps/sysmon.js's closure because it is unit-testable here
// and is not there (see test/sysmon-end-process.test.cjs); that is also why
// closeWin and kernelSignal are dependencies of this module now, alongside
// the kernel/window-manager reads buildProcessRows already needed. The next
// person adding a UI action for a process row belongs here too, for the
// same reason - not back in apps/sysmon.js's untestable closure.
//
// The daemon story's processes are MERGED here rather than registered into the
// kernel table, because getBuiltInProcesses() is a live projection of story
// state: pid 512 disappears when the daemon is stopped, mirror_watch.exe
// appears at stage 4, and the soul_svc_NN phantoms are generated from a
// registry key the player can edit. Registering them would put narrative state
// inside the kernel and turn a pure function into a cache needing invalidation
// on every story beat.
//
// The naive concatenate-then-sort in buildProcessRows below is safe only
// because the two pid ranges never collide: real allocation starts at
// KERNEL_FIRST_USER_PID = 2000 (os/kernel.js), while the daemon story's pids
// stay at or below 1333 (os/kernel.js, os/daemon.js). Neither range may move
// without checking the other.
function processDisplayName(title, fallbackId) {
  // Window titles use two separators: an em dash (notepad, explorer) and a
  // plain hyphen (terminal, sysmon, defrag, browser, daemon). Splitting on
  // only the em dash is why `ps` used to report the process name of the
  // terminal as "TERMINAL.exe - Command Prompt".
  const raw = String(title || fallbackId || '').split(/\s\u2014|\s-\s/)[0].trim();
  if (!raw) return String(fallbackId || '').trim() + '.exe';
  return raw.includes('.') ? raw : raw + '.exe';
}

// Indirected so the tests can stub it without loading os/kernel.js, matching
// how kernelListProcesses and getBuiltInProcesses are already stubbed here.
function _pvMetrics(pid) {
  if (typeof kernelMetricsFor !== 'function') return { cpu: null, mem: null, memUnit: null };
  return kernelMetricsFor(pid);
}

function buildProcessRows() {
  const rows = kernelListProcesses().map(proc => ({
    pid: proc.pid,
    // Derived live: the kernel captured a name at registration, and windows
    // retitle themselves afterwards.
    name: proc.winId && wins[proc.winId]
      ? processDisplayName(wins[proc.winId].title, proc.winId)
      : proc.name,
    kind: proc.kind,
    state: proc.state,
    // Measured, or null. Never zero: zero claims a measurement that was never
    // taken, and telling those apart is the whole point of this phase.
    cpu: _pvMetrics(proc.pid).cpu,
    mem: _pvMetrics(proc.pid).mem,
    memUnit: _pvMetrics(proc.pid).memUnit,
    winId: proc.winId || null,
    isStory: false,
  }));
  // getBuiltInProcesses returns { pid, name, protected } and carries no kind,
  // state, cpu, or mem, so they are synthesized to match what ps already
  // prints. A story process has no window and no interpreter - no measurable
  // execution context - so it reports null, not an invented number.
  getBuiltInProcesses().forEach(p => rows.push({
    pid: p.pid, name: p.name, kind: 'system', state: 'running',
    cpu: null, mem: null, memUnit: null, winId: null, isStory: true,
  }));
  return rows.sort((a, b) => a.pid - b.pid);
}

// SYSMON's End Process used to call closeWin(row.winId) for everything. A
// spawned process has no winId, so that was a button that silently did
// nothing. A story row is not routed to a refusal here: SYSMON's own story
// branch has two distinct outcomes (the pid-512 branch mutates story state,
// every other story pid shows Access Denied), so this router hands story
// rows straight back and touches neither the kernel nor the window manager.
// Returns what it did so the caller can decide what to show.
//
// kernelSignal's return value is not discarded: it is false for the kernel
// itself (pid 1, a system-kind process with no winId - os/kernel.js refuses
// rather than pretend to close a window that does not exist) and for any
// process that already exited between the row being rendered and the click
// landing. Both are real refusals, not successes, so both come back here as
// 'refused' rather than the caller silently doing nothing. The terminal's
// KILL command hits the identical kernelSignal-returns-false case and prints
// "Access denied: PID N cannot be terminated." - SYSMON must say the same
// thing for the same outcome, or the two surfaces disagree about the result
// of the same operation, which is the one thing this whole module exists to
// prevent.
function endProcessAction(row) {
  if (row.isStory) return 'story';
  if (row.winId && wins[row.winId]) { closeWin(row.winId); return 'closed'; }
  return kernelSignal(row.pid, 'SIGTERM') ? 'signalled' : 'refused';
}
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
// ── Wallpaper persistence ─────────────────────────────────────────
const WP_KEY = 'sleepOS-wallpaper';

// ── Settings helpers ──────────────────────────────────────────────
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(osSettings)); } catch(e) {}
}

function applySettings() {
  const crt = document.getElementById('crt');
  if (crt) crt.style.display = osSettings.crtScanlines ? '' : 'none';
  document.querySelectorAll('.vp-dither').forEach(d => d.style.display = osSettings.videoDither ? '' : 'none');
  updateClock();
  // Keep registry in sync with settings
  if (typeof registryData !== 'undefined') {
    const cc = registryData['HKEY_SLEEPBOX_MACHINE']['SYSTEM\\CurrentConfig'];
    const cu = registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS'];
    if (cc) {
      cc.CRT_SCANLINES.value = osSettings.crtScanlines ? 1 : 0;
      cc.VIDEO_DITHER.value  = osSettings.videoDither  ? 1 : 0;
      cc.CLOCK_FORMAT.value  = osSettings.clock12h ? '12h' : '24h';
    }
    if (cu) {
      cu.SkipBoot.value = osSettings.skipBoot ? 1 : 0;
      cu.IdleSleepMinutes.value = getIdleSleepMinutes();
      cu.SoundEnabled.value = osSettings.sounds ? 1 : 0;
      cu.SoundVolume.value = Math.round(getSystemVolume() * 100);
    }
    saveRegistry();
  }
  applySystemAudioSettings();
}

document.addEventListener('fs-changed', refreshAppearanceWindow);

// Parked time for the current realm.
//
// A process is "parked" when it is waiting on something rather than occupying
// its thread. Worker CPU is computed as wall time minus parked time, which is
// both cheaper and more accurate than bracketing every interpreter
// instruction: two clock reads per instruction is real overhead on a loop that
// runs to SCRIPT_MAX_STEPS, and it would still miss interpreter work happening
// between instructions.
//
// This file is in BOTH bundles. os/script/interp.js is too, and its
// scriptSleep parks; a worker-only accumulator would leave the main-thread
// copy referencing an undefined function.
var _parkTotalMs = 0;
var _parkDepth = 0;
var _parkStartedAt = 0;

// Depth-counted rather than a plain begin/end pair, because syscalls can be in
// flight concurrently. Two overlapping parks mean the process was parked ONCE
// across the union of their intervals - counting each separately would
// subtract the overlap twice and report a busy process as idle.
function parkBegin() {
  if (_parkDepth === 0) _parkStartedAt = performance.now();
  _parkDepth++;
}

function parkEnd() {
  // A stray end (a reply arriving after parkReset, say) must not open a
  // negative depth that swallows the next real interval.
  if (_parkDepth === 0) return;
  _parkDepth--;
  if (_parkDepth === 0) _parkTotalMs += performance.now() - _parkStartedAt;
}

function parkTotalMs() { return _parkTotalMs; }

function parkReset() {
  _parkTotalMs = 0;
  _parkDepth = 0;
  _parkStartedAt = 0;
}
// ── Script executor ──────────────────────────────────────────────
const SCRIPT_COLORS = { red:'#ff4444', green:'#44dd44', yellow:'#dddd00', cyan:'#44dddd', blue:'#6699ff', white:'#ffffff' };
const SCRIPT_MAX_STEPS = 10000;
const SCRIPT_MAX_DEPTH = 16;
const SCRIPT_LABEL_RE = /^:([A-Za-z_][\w.-]*)$/;

// Interpreter-tracked memory: bytes held in variables, string allocations,
// call stack depth and loaded source size.
//
// This is NOT heap, and SYSMON never calls it heap. Per-worker heap is not
// exposed to JS, and the one API that could attribute it
// (performance.measureUserAgentSpecificMemory) needs cross-origin isolation,
// whose COEP would break every image sleepOS loads from
// raw.githubusercontent.com. This figure is real data about the process and
// responsive to allocation, which is the honest thing available.
var SCRIPT_FRAME_BYTES = 64;

function scriptStateBytes(state) {
  if (!state || typeof state !== 'object') return 0;
  let bytes = 0;
  const vars = state.vars;
  if (vars && typeof vars === 'object') {
    Object.keys(vars).forEach(function (key) {
      // UTF-16 code units, which is what a JS string actually costs.
      bytes += key.length * 2;
      const v = vars[key];
      bytes += typeof v === 'string' ? v.length * 2 : 8;
    });
  }
  if (Array.isArray(state.frames)) bytes += state.frames.length * SCRIPT_FRAME_BYTES;
  if (Array.isArray(state.callStack)) bytes += state.callStack.length * SCRIPT_FRAME_BYTES;
  if (typeof state.sourceText === 'string') bytes += state.sourceText.length * 2;
  return bytes;
}

// The state of the script currently executing in this realm, or null. The
// worker heartbeat reads this; nothing else may hold onto it, because it is a
// live object that execScript mutates in place.
var _scriptLiveState = null;

function scriptLiveStateBytes() {
  return _scriptLiveState ? scriptStateBytes(_scriptLiveState) : 0;
}

function makeScriptError(message, lineNo, sourceName) {
  const err = new Error(message);
  err.lineNo = lineNo || 0;
  err.sourceName = sourceName || '';
  return err;
}

function makeAbortError(message) {
  const err = new Error(message || 'Command interrupted.');
  err.name = 'AbortError';
  err.isCommandAbort = true;
  return err;
}

function isAbortError(err) {
  return !!(err && (err.isCommandAbort || err.name === 'AbortError'));
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    throw signal.reason && isAbortError(signal.reason) ? signal.reason : makeAbortError();
  }
}

function scriptResolveText(text, vars) {
  return String(text ?? '').replace(/\$(\w+)/g, (_, key) => vars[key] ?? '');
}

function scriptBuildArgFrame(targetName, args) {
  const values = Object.create(null);
  const items = Array.isArray(args) ? args.map(arg => String(arg ?? '')) : [];
  values['0'] = String(targetName || '');
  values.argc = String(items.length);
  items.forEach((value, index) => { values[String(index + 1)] = value; });
  return { targetName: String(targetName || ''), values };
}

function scriptLookupVar(state, key) {
  const name = String(key || '');
  if (name === 'status' || name === 'errorlevel') return String(state.status ?? 0);
  const frame = state.frames?.[state.frames.length - 1];
  if (frame && Object.prototype.hasOwnProperty.call(frame.values, name)) return frame.values[name];
  return state.vars[name] ?? '';
}

function scriptHasVar(state, key) {
  const name = String(key || '');
  if (name === 'status' || name === 'errorlevel') return true;
  const frame = state.frames?.[state.frames.length - 1];
  if (frame && Object.prototype.hasOwnProperty.call(frame.values, name)) return true;
  return Object.prototype.hasOwnProperty.call(state.vars, name);
}

function scriptResolveStateText(text, state) {
  return String(text ?? '').replace(/\$(\w+)/g, (_, key) => scriptLookupVar(state, key));
}

function scriptUnescape(text) {
  return String(text ?? '')
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function scriptStripOuterQuotes(text) {
  const trimmed = String(text ?? '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return scriptUnescape(trimmed.slice(1, -1));
  }
  return trimmed;
}

function scriptNormalizeLabel(name) {
  return String(name || '').trim().toLowerCase();
}

function scriptParseNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function scriptParseStatusCode(value, lineNo, fallback) {
  const text = String(value ?? '').trim();
  if (!text) return Math.trunc(scriptParseNumber(fallback ?? 0) ?? 0);
  const num = scriptParseNumber(text);
  if (num === null) throw makeScriptError('Status code must be numeric.', lineNo);
  return Math.trunc(num);
}

function scriptTokenize(text, lineNo) {
  const source = String(text ?? '');
  const tokens = [];
  let token = '';
  let quote = null;
  let started = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      started = true;
      if (ch === '\\' && i + 1 < source.length) {
        token += source[i + 1];
        i++;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      token += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started) {
        tokens.push(token);
        token = '';
        started = false;
      }
      continue;
    }
    started = true;
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    token += ch;
  }
  if (quote) throw makeScriptError('Unterminated quoted string.', lineNo);
  if (started) tokens.push(token);
  return tokens;
}

function scriptIsReservedVarName(name) {
  return /^(?:status|errorlevel|argc|\d+)$/i.test(String(name || ''));
}

async function scriptPathExists(path, state) {
  const target = String(path || '').trim();
  if (!target) return false;
  if (target === '.' || target === '..' || target === '\\' || /^C:\\sleepOS\\?$/i.test(target)) return true;
  if (await state.fs.isSystemPath(target)) return true;
  if (await state.fs.exists(target, state.dirName)) return true;
  return await state.fs.dirExists(target);
}

async function scriptEvaluateCondition(text, state, lineNo) {
  const tokens = scriptTokenize(text, lineNo);
  let negate = false;
  if (tokens[0] && tokens[0].toLowerCase() === 'not') {
    negate = true;
    tokens.shift();
  }
  if (tokens[0] && tokens[0].toLowerCase() === 'exists') {
    if (tokens.length !== 4 || tokens[2].toLowerCase() !== 'goto') {
      throw makeScriptError('Usage: if [not] exists <path> goto <label>', lineNo);
    }
    const rawPassed = await scriptPathExists(tokens[1], state);
    return { passed: negate ? !rawPassed : rawPassed, label: tokens[3] };
  }
  if (tokens[0] && tokens[0].toLowerCase() === 'defined') {
    if (tokens.length !== 4 || tokens[2].toLowerCase() !== 'goto') {
      throw makeScriptError('Usage: if [not] defined <var> goto <label>', lineNo);
    }
    const rawPassed = scriptHasVar(state, tokens[1]);
    return { passed: negate ? !rawPassed : rawPassed, label: tokens[3] };
  }
  if (tokens.length !== 5 || tokens[3].toLowerCase() !== 'goto') {
    throw makeScriptError('Usage: if <left> <op> <right> goto <label>', lineNo);
  }
  const rawPassed = scriptCompare(tokens[0], tokens[1], tokens[2], lineNo);
  return { passed: negate ? !rawPassed : rawPassed, label: tokens[4] };
}

function scriptMutateNumericVar(vars, key, op, amountRaw, lineNo) {
  const current = Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '0';
  const currentNum = scriptParseNumber(current);
  if (currentNum === null) throw makeScriptError('Variable is not numeric: ' + key, lineNo);
  const needsAmount = op === 'mul' || op === 'div' || op === 'mod';
  if (needsAmount && (amountRaw === undefined || amountRaw === null || String(amountRaw).trim() === '')) {
    throw makeScriptError('Usage: ' + op + ' <var> <amount>', lineNo);
  }
  const amount = amountRaw === undefined || amountRaw === null || String(amountRaw).trim() === '' ? 1 : scriptParseNumber(amountRaw);
  if (amount === null) throw makeScriptError('Arithmetic operand must be numeric.', lineNo);
  if ((op === 'div' || op === 'mod') && amount === 0) throw makeScriptError('Division by zero.', lineNo);
  let nextValue = currentNum;
  if (op === 'inc' || op === 'add') nextValue = currentNum + amount;
  else if (op === 'dec' || op === 'sub') nextValue = currentNum - amount;
  else if (op === 'mul') nextValue = currentNum * amount;
  else if (op === 'div') nextValue = currentNum / amount;
  else if (op === 'mod') nextValue = currentNum % amount;
  else throw makeScriptError('Unsupported arithmetic operation: ' + op, lineNo);
  vars[key] = String(nextValue);
  return vars[key];
}

function scriptEmitError(printFn, sourceName, lineNo, message) {
  const prefix = sourceName ? sourceName + ': ' : 'Script error: ';
  const where = lineNo ? 'line ' + lineNo + ': ' : '';
  printFn(prefix + where + message, '#ff4444');
}

function scriptFail(err, printFn, sourceName, bubbleErrors) {
  const scriptErr = err instanceof Error ? err : makeScriptError(String(err), 0, sourceName);
  if (!scriptErr.sourceName) scriptErr.sourceName = sourceName || '';
  if (bubbleErrors) throw scriptErr;
  scriptEmitError(printFn, scriptErr.sourceName || sourceName, scriptErr.lineNo || 0, scriptErr.message || String(scriptErr));
  return Math.trunc(scriptErr.statusCode ?? 1);
}

function parseScript(source) {
  const instructions = [];
  const labels = Object.create(null);
  String(source ?? '').replace(/\r/g, '').split('\n').forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    if (line.startsWith(':')) {
      const match = line.match(SCRIPT_LABEL_RE);
      if (!match) throw makeScriptError('Invalid label syntax.', lineNo);
      const label = scriptNormalizeLabel(match[1]);
      if (Object.prototype.hasOwnProperty.call(labels, label)) {
        throw makeScriptError('Duplicate label: ' + match[1], lineNo);
      }
      labels[label] = instructions.length;
      return;
    }
    const spaceIdx = line.search(/\s/);
    instructions.push({
      lineNo,
      raw: line,
      cmd: (spaceIdx === -1 ? line : line.slice(0, spaceIdx)).toLowerCase(),
      arg: spaceIdx === -1 ? '' : line.slice(spaceIdx + 1).trim(),
    });
  });
  return { instructions, labels };
}

async function scriptSleep(ms, signal) {
  // Checked BEFORE parking: a pre-aborted sleep never waits, so recording it
  // as parked time would credit the process with idleness it never had.
  throwIfAborted(signal);
  parkBegin();
  try {
    await new Promise((resolve, reject) => {
      const tid = setTimeout(done, ms);
      function cleanup() {
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
      function done() {
        cleanup();
        resolve();
      }
      function onAbort() {
        cleanup();
        reject(signal.reason && isAbortError(signal.reason) ? signal.reason : makeAbortError());
      }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  } finally {
    // finally, not after the await: a SIGTERM rejects this promise, and a park
    // left open by that path would make every later sample report the process
    // as permanently idle.
    parkEnd();
  }
}

function scriptJumpIndex(labels, labelName, lineNo) {
  const key = scriptNormalizeLabel(labelName);
  if (!Object.prototype.hasOwnProperty.call(labels, key)) {
    throw makeScriptError('Unknown label: ' + labelName, lineNo);
  }
  return labels[key];
}

function scriptCompare(left, op, right, lineNo) {
  if (op === '==') return left === right;
  if (op === '!=') return left !== right;
  const leftNum = scriptParseNumber(left);
  const rightNum = scriptParseNumber(right);
  if (leftNum === null || rightNum === null) {
    throw makeScriptError('Numeric comparison requires numeric operands.', lineNo);
  }
  if (op === '>') return leftNum > rightNum;
  if (op === '>=') return leftNum >= rightNum;
  if (op === '<') return leftNum < rightNum;
  if (op === '<=') return leftNum <= rightNum;
  throw makeScriptError('Unsupported comparison operator: ' + op, lineNo);
}

async function execScriptInstruction(inst, labels, state) {
  throwIfAborted(state.signal);
  const resolvedArg = scriptResolveStateText(inst.arg, state).trim();
  switch (inst.cmd) {
    case 'print':
    case 'echo': {
      const colorMatch = resolvedArg.match(/^\[(\w+)\]\s*/);
      if (colorMatch && SCRIPT_COLORS[colorMatch[1]]) {
        state.printFn(resolvedArg.slice(colorMatch[0].length), SCRIPT_COLORS[colorMatch[1]]);
      } else {
        state.printFn(resolvedArg);
      }
      state.status = 0;
      return null;
    }
    case 'set': {
      const match = resolvedArg.match(/^(\w+)(?:\s+(.*))?$/);
      if (!match) throw makeScriptError('Usage: set <var> <value>', inst.lineNo);
      if (scriptIsReservedVarName(match[1])) throw makeScriptError('Cannot assign reserved variable: ' + match[1], inst.lineNo);
      state.vars[match[1]] = match[2] ?? '';
      state.status = 0;
      return null;
    }
    case 'inc':
    case 'dec':
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'mod': {
      const match = resolvedArg.match(/^(\w+)(?:\s+(.+))?$/);
      if (!match) {
        const usage = inst.cmd === 'mul' || inst.cmd === 'div' || inst.cmd === 'mod'
          ? 'Usage: ' + inst.cmd + ' <var> <amount>'
          : 'Usage: ' + inst.cmd + ' <var> [amount]';
        throw makeScriptError(usage, inst.lineNo);
      }
      if (scriptIsReservedVarName(match[1])) throw makeScriptError('Cannot assign reserved variable: ' + match[1], inst.lineNo);
      scriptMutateNumericVar(state.vars, match[1], inst.cmd, match[2], inst.lineNo);
      state.status = 0;
      return null;
    }
    case 'wait': {
      const ms = scriptParseNumber(resolvedArg);
      if (ms === null) throw makeScriptError('Usage: wait <ms>', inst.lineNo);
      await scriptSleep(Math.min(Math.max(Math.floor(ms), 0), 30000), state.signal);
      state.status = 0;
      return null;
    }
    case 'input': {
      throwIfAborted(state.signal);
      if (!state.readLine) throw makeScriptError('INPUT requires an interactive terminal.', inst.lineNo);
      const match = resolvedArg.match(/^(\w+)(?:\s+(.+))?$/);
      if (!match) throw makeScriptError('Usage: input <var> [prompt]', inst.lineNo);
      if (scriptIsReservedVarName(match[1])) throw makeScriptError('Cannot assign reserved variable: ' + match[1], inst.lineNo);
      const key = match[1];
      const prompt = match[2] ? scriptStripOuterQuotes(match[2]) : key + ':';
      state.vars[key] = await state.readLine(prompt);
      state.status = 0;
      return null;
    }
    case 'goto':
      if (!resolvedArg) throw makeScriptError('Usage: goto <label>', inst.lineNo);
      state.status = 0;
      return { type: 'jump', pc: scriptJumpIndex(labels, resolvedArg, inst.lineNo) };
    case 'call': {
      const tokens = scriptTokenize(resolvedArg, inst.lineNo);
      if (!tokens.length) throw makeScriptError('Usage: call <label> [args...]', inst.lineNo);
      state.status = 0;
      return {
        type: 'call',
        pc: scriptJumpIndex(labels, tokens[0], inst.lineNo),
        frame: scriptBuildArgFrame(tokens[0], tokens.slice(1)),
      };
    }
    case 'return':
      return { type: 'return', code: scriptParseStatusCode(resolvedArg, inst.lineNo, state.status) };
    case 'exit':
      return { type: 'exit', code: scriptParseStatusCode(resolvedArg, inst.lineNo, state.status) };
    case 'if': {
      const result = await scriptEvaluateCondition(resolvedArg, state, inst.lineNo);
      state.status = result.passed ? 0 : 1;
      if (result.passed) return { type: 'jump', pc: scriptJumpIndex(labels, result.label, inst.lineNo) };
      return null;
    }
    case 'clear':
      (state.clearFn || (() => state.fs.clearScreen()))();
      state.status = 0;
      return null;
    case 'touch': {
      if (!resolvedArg) throw makeScriptError('Usage: touch <file>', inst.lineNo);
      // DELIBERATE BEHAVIOR CHANGE. fsGetEntry returned null for directories,
      // so `touch DOCS` used to write an empty file that permanently shadowed
      // the directory. vfsStatSync reports the directory, so touch now no-ops
      // on it, which is what touch is supposed to do.
      const existing = await state.fs.stat(resolvedArg, state.dirName);
      if (!existing) {
        // The legacy accessors returned falsy on failure and the interpreter
        // used that to attach the script line number. The VFS throws instead,
        // so every converted site re-wraps or the error reaches the user with
        // no line number and no source name.
        try {
          await state.fs.writeFile(resolvedArg, '', state.dirName);
        } catch (err) {
          throw makeScriptError('Cannot create file: ' + resolvedArg + ' (' + err.message + ')', inst.lineNo);
        }
        await state.fs.notifyChanged();
      }
      state.status = 0;
      return null;
    }
    case 'mkdir': {
      if (!resolvedArg) throw makeScriptError('Usage: mkdir <dir>', inst.lineNo);
      let created;
      try {
        created = await state.fs.mkdir(resolvedArg, state.dirName);
      } catch (err) {
        throw makeScriptError('Cannot create directory: ' + resolvedArg + ' (' + err.message + ')', inst.lineNo);
      }
      if (created.created) {
        await state.fs.notifyChanged();
      }
      state.status = 0;
      return null;
    }
    case 'dir': {
      const target = resolvedArg || state.dirName;
      // vfsListSync returns [] for a missing directory, so list alone cannot
      // tell "empty" from "does not exist". dirExists is the only way to
      // distinguish them, and both are syscalls in a worker.
      if (!await state.fs.dirExists(target)) {
        throw makeScriptError('Directory not found: ' + target, inst.lineNo);
      }
      const entries = await state.fs.list(target);
      (entries || []).forEach(entry => {
        state.printFn(entry.type === 'dir' ? entry.name + '\\' : entry.name);
      });
      state.status = 0;
      return null;
    }
    case 'del':
    case 'rm': {
      if (!resolvedArg) throw makeScriptError('Usage: del <file>', inst.lineNo);
      const deletion = await state.fs.unlink(resolvedArg, state.dirName);
      if (!deletion.ok) throw makeScriptError(deletion.message || ('Cannot delete: ' + resolvedArg), inst.lineNo);
      state.status = 0;
      return null;
    }
    case 'open': {
      if (!resolvedArg) throw makeScriptError('Usage: open <file>', inst.lineNo);
      if (await state.fs.isSystemPath(resolvedArg)) {
        if (!await state.fs.openSystem(fsSplitPath(resolvedArg, state.dirName).fileName, state.dirName)) {
          throw makeScriptError('File not found: ' + resolvedArg, inst.lineNo);
        }
        state.status = 0;
        return null;
      }
      // `!st || st.type === 'dir'` reproduces fsGetEntry's null-for-directories
      // exactly. Without the second half `open DOCS` would fall through to the
      // else branch and load a directory into Notepad.
      const st = await state.fs.stat(resolvedArg, state.dirName);
      if (!st || st.type === 'dir') throw makeScriptError('File not found: ' + resolvedArg, inst.lineNo);
      await state.fs.openUi(st.name, st.dirName);
      state.status = 0;
      return null;
    }
    case 'notepad':
      await state.fs.openSystem('notepad', state.dirName, resolvedArg);
      state.status = 0;
      return null;
    case 'start': {
      const key = resolvedArg.toLowerCase();
      if (!await state.fs.openSystem(key, state.dirName)) {
        throw makeScriptError('Program not found: ' + resolvedArg, inst.lineNo);
      }
      state.status = 0;
      return null;
    }
    case 'run': {
      const tokens = scriptTokenize(resolvedArg, inst.lineNo);
      if (!tokens.length) throw makeScriptError('Usage: run <script> [args...]', inst.lineNo);
      const st = await state.fs.stat(tokens[0], state.dirName);
      if (!st || st.kind !== 'text') throw makeScriptError('Script not found: ' + tokens[0], inst.lineNo);
      // Content is async now; the stat above carries no `value`.
      const source = await state.fs.readFile(st.name, st.dirName);
      if (source === null) throw makeScriptError('Script not found: ' + tokens[0], inst.lineNo);
      state.status = await execScript(source, state.printFn, {
        fs: state.fs,
        vars: state.vars,
        depth: state.depth + 1,
        dirName: st.dirName,
        sourceName: st.name,
        clearFn: state.clearFn,
        readLine: state.readLine,
        signal: state.signal,
        args: tokens.slice(1),
      });
      return null;
    }
    case 'grep': {
      const match = resolvedArg.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)\s+(.+)$/);
      if (!match) throw makeScriptError('Usage: grep <pattern> <file>', inst.lineNo);
      const patternToken = match[1];
      const pattern = scriptUnescape(patternToken.replace(/^['"]|['"]$/g, ''));
      const fileName = match[2].replace(/^['"]|['"]$/g, '');
      const st = await state.fs.stat(fileName, state.dirName);
      if (!st || st.kind !== 'text') throw makeScriptError('File not found: ' + fileName, inst.lineNo);
      let re;
      try { re = new RegExp(pattern, 'i'); }
      catch (e) { throw makeScriptError('Invalid regex: ' + pattern, inst.lineNo); }
      const contents = await state.fs.readFile(st.name, st.dirName);
      if (contents === null) throw makeScriptError('File not found: ' + fileName, inst.lineNo);
      const lines = contents.split('\n');
      let matches = 0;
      lines.forEach((line, index) => {
        if (re.test(line)) {
          state.printFn((index + 1) + ':' + line);
          matches++;
        }
      });
      if (matches === 0) state.printFn('(no matches)');
      else state.printFn(matches + ' match' + (matches === 1 ? '' : 'es') + ' found');
      state.status = matches === 0 ? 1 : 0;
      return null;
    }
    default:
      throw makeScriptError('Unknown command: ' + inst.cmd, inst.lineNo);
  }
}

async function execScript(source, printFn, options) {
  options = options || {};
  const sourceName = options.sourceName || 'script';
  const depth = options.depth || 0;
  if (depth >= SCRIPT_MAX_DEPTH) {
    return scriptFail(makeScriptError('Maximum script recursion depth exceeded.', 0, sourceName), printFn, sourceName, options.bubbleErrors);
  }
  let parsed;
  try {
    parsed = parseScript(source);
  } catch (err) {
    return scriptFail(err, printFn, sourceName, options.bubbleErrors);
  }
  const state = {
    fs: options.fs,
    vars: options.vars || Object.create(null),
    depth,
    dirName: fsNormalizeDir(options.dirName),
    printFn,
    clearFn: options.clearFn || null,
    readLine: options.readLine || null,
    signal: options.signal || null,
    status: Math.trunc(options.initialStatus ?? 0),
    frames: [scriptBuildArgFrame(options.targetName || sourceName, options.args || [])],
    callStack: [],
  };
  _scriptLiveState = state;
  let pc = 0;
  let steps = 0;
  try {
    while (pc < parsed.instructions.length) {
      const inst = parsed.instructions[pc];
      steps++;
      try {
        throwIfAborted(state.signal);
      } catch (err) {
        if (isAbortError(err)) throw err;
        return scriptFail(err, printFn, sourceName, options.bubbleErrors);
      }
      if (steps > SCRIPT_MAX_STEPS) {
        return scriptFail(makeScriptError('Instruction limit exceeded (possible infinite loop).', inst.lineNo, sourceName), printFn, sourceName, options.bubbleErrors);
      }
      try {
        const action = await execScriptInstruction(inst, parsed.labels, state);
        if (action && action.type === 'jump') {
          pc = action.pc;
          continue;
        }
        if (action && action.type === 'call') {
          state.callStack.push({ returnPc: pc + 1 });
          state.frames.push(action.frame);
          pc = action.pc;
          continue;
        }
        if (action && action.type === 'return') {
          if (!state.callStack.length || state.frames.length <= 1) {
            throw makeScriptError('RETURN without CALL.', inst.lineNo);
          }
          const frame = state.callStack.pop();
          state.frames.pop();
          state.status = action.code;
          pc = frame.returnPc;
          continue;
        }
        if (action && action.type === 'exit') {
          state.status = action.code;
          return state.status;
        }
        if (typeof action === 'number') {
          pc = action;
          continue;
        }
      } catch (err) {
        if (isAbortError(err)) throw err;
        return scriptFail(err, printFn, sourceName, options.bubbleErrors);
      }
      pc++;
    }
    return Math.trunc(state.status ?? 0);
  } finally {
    _scriptLiveState = null;
  }
}

// Shared by makeVfsScriptFs's `openUi` and the kernel's `ui.open` syscall
// handler (os/kernel.js's _kernelUiOpen). Both callers run on the main
// thread - a worker only ever reaches this indirectly, through the ui.open
// syscall the kernel answers here - so referencing openMediaFile/openNotepad
// directly is safe. Matches the shape the main-thread adapter always
// returned (undefined), so the kernel and the terminal do not diverge.
async function scriptOpenUiTarget(path, cwd) {
  const st = vfsStatSync(path, cwd);
  if (!st) return;
  if (st.kind === 'blob') openMediaFile(st.name, st.dirName);
  else openNotepad(st.name, st.dirName);
}

// Shared by makeVfsScriptFs's `openSystem` and the kernel's `ui.openSystem`
// syscall handler (os/kernel.js's _kernelUiOpenSystem) - one map, one seam,
// so a spawned script's `START` reaches the same 19 programs the terminal
// does. Absorbs the `start` command's program map and the `notepad`
// command's blank-document case. Those map entries used to be bare
// identifier references (`sysmon: openSysmon`), evaluated the moment the
// object literal was built - in a Worker, just reaching the `start` case
// threw a ReferenceError before any lookup happened, regardless of which
// program was requested. Living here means the map is only ever built on
// the main thread, where the globals it references are legitimately in
// scope (a worker reaches it only via the ui.openSystem syscall, answered
// here). `openSystemFile` stays as the fallback for names the map does not
// recognize (WELCOME.README, void.tmp, daemon.core, etc.).
async function scriptOpenSystemProgram(name, cwd, arg) {
  const lower = String(name || '').toLowerCase();
  const map = {
    notepad: () => openNotepad(arg || undefined, cwd),
    'notepad.exe': () => openNotepad(arg || undefined, cwd),
    terminal: () => openTerminal(cwd),
    'terminal.exe': () => openTerminal(cwd),
    sysmon: openSysmon,
    'sysmon.exe': openSysmon,
    browser: openBrowser,
    'browser.exe': openBrowser,
    defrag: openDefrag,
    'defrag.exe': openDefrag,
    explorer: openExplorer,
    'explorer.exe': openExplorer,
    welcome: openWelcome,
    'welcome.readme': openWelcome,
    files: openFiles,
    calc: openCalculator,
    'calc.exe': openCalculator,
    regedit: openRegedit,
    'regedit.exe': openRegedit,
  };
  if (map[lower]) { map[lower](); return true; }
  return !!openSystemFile(name);
}

// The main thread's adapter. The worker builds its own in os/worker/syscalls.js
// against the same shape, so the interpreter cannot tell them apart.
function makeVfsScriptFs() {
  return {
    async stat(path, cwd) { return vfsStatSync(path, cwd); },
    async exists(path, cwd) { return vfsExistsSync(path, cwd); },
    async dirExists(path) { return vfsDirExistsSync(path); },
    async list(path) { return vfsListSync(path); },
    async readFile(path, cwd) { return await vfsReadFile(path, cwd); },
    async writeFile(path, text, cwd) { return await vfsWriteFile(path, text, cwd); },
    async mkdir(path, cwd) { return await vfsMkdir(path, cwd); },
    // deleteVirtualPath, not vfsUnlink: it enforces the Recycle Bin and the
    // story's undeletable files. Deleting straight from the VFS would bypass both.
    async unlink(path, cwd) { return await deleteVirtualPath(path, cwd); },
    async openUi(path, cwd) { return scriptOpenUiTarget(path, cwd); },
    async openSystem(name, cwd, arg) { return scriptOpenSystemProgram(name, cwd, arg); },
    async isSystemPath(path) { return isVisibleSystemPath(path, { includeExplorer: true }); },
    async notifyChanged() { document.dispatchEvent(new CustomEvent('fs-changed')); },
    async clearScreen() { const out = document.getElementById('to'); if (out) out.innerHTML = ''; },
  };
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function inferBlobKindFromName(name) {
  const lower = String(name || '').toLowerCase();
  if (/\.(gif|png|jpe?g|webp|bmp|svg|avif|ico)$/.test(lower)) return 'image';
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac|aac)$/.test(lower)) return 'audio';
  if (/\.(script|txt|md|csv|json|xml|html|css|js|log|ini|cfg|sh|bat)$/.test(lower)) return 'text';
  return 'binary';
}

function inferBlobMimeFromName(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.png')) return 'image/png';
  if (/\.(jpg|jpeg)$/.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.ogv')) return 'video/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (/\.(txt|log|ini|cfg)$/.test(lower)) return 'text/plain';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.xml')) return 'application/xml';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.js')) return 'text/javascript';
  return '';
}

let _uploadCwd = '';
function triggerUpload(dir) {
  _uploadCwd = dir || '';
  document.getElementById('file-upload-input').click();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(String(e.target?.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

async function handleFileUpload(fileList) {
  const dirPath = fsNormalizeDir(_uploadCwd || '');
  if (dirPath === 'DESKTOP') ensureFsDir('DESKTOP');
  if (dirPath && !vfsDirExistsSync(dirPath)) {
    osAlert('Upload target not found:\nC:\\sleepOS\\' + dirPath, 'Upload Failed', 'icon:error');
    return;
  }
  const dirLabel = dirPath ? `C:\\sleepOS\\${dirPath}\\` : 'C:\\sleepOS';
  const results = await Promise.all([...fileList].map(async file => {
    const TEXT_EXTS = /\.(script|txt|md|csv|json|xml|html|css|js|log|ini|cfg|sh|bat)$/i;
    const mime = file.type || inferBlobMimeFromName(file.name);
    const inferredKind = inferBlobKindFromName(file.name);
    const isText = mime.startsWith('text/') || inferredKind === 'text' || (file.type === '' && TEXT_EXTS.test(file.name));
    const kind = mime.startsWith('image/') ? 'image'
               : mime.startsWith('video/') ? 'video'
               : mime.startsWith('audio/') ? 'audio'
               : isText ? 'text'
               : inferredKind;
    try {
      // The VFS throws where the old accessors returned null, and the enclosing
      // catch already turns a failure into { ok: false }, which is what raises
      // the "could not be uploaded" alert. So a full disk now reports the file
      // as failed instead of claiming a successful upload.
      if (kind === 'text') {
        const content = await readFileAsText(file);
        await vfsWriteFile(file.name, content, dirPath);
        return { ok: true, name: file.name };
      }
      const url = URL.createObjectURL(file);
      try {
        // The write is queued here; its actual durability (the block-layer
        // commit, up to 400ms later) is reported separately, through
        // reportVfsError's toast if it fails - the same channel every other
        // write in this OS already relies on, and the only one that can be
        // honest about a failure this far in the future. Reporting {ok:false}
        // here for that would be reporting a failure that has not happened
        // (or might never happen) yet: before Task 9e/9f this branch instead
        // waited on a synchronous mirror write to know a real answer early,
        // but that mirror is gone and blocks give no synchronous answer at all.
        await vfsWriteBlob(file.name, { url, kind, size: file.size, mime }, dirPath);
      } catch (err) {
        // Nothing else holds this URL once the tree entry was refused, so
        // release it rather than leaking it for the rest of the session.
        URL.revokeObjectURL(url);
        throw err;
      }
      return { ok: true, name: file.name };
    } catch (e) {
      return { ok: false, name: file.name };
    }
  }));
  const added = results.filter(result => result.ok).map(result => result.name);
  const failed = results.filter(result => !result.ok).map(result => result.name);
  if (added.length) {
    // No explicit 'fs-changed' dispatch: every vfsWriteFile/vfsWriteBlob above
    // already queued an op, and the VFS onChange handler dispatches the event.
    showUploadConfirm(added, dirLabel);
  }
  if (failed.length) {
    const msg = failed.length === 1
      ? `"${failed[0]}" could not be uploaded to ${dirLabel}`
      : `${failed.length} files could not be uploaded to ${dirLabel}`;
    osAlert(msg, 'Upload Failed', 'icon:error');
  }
}

function showUploadConfirm(names, dirLabel) {
  dirLabel = dirLabel || 'C:\\sleepOS';
  const msg = names.length === 1
    ? `"${names[0]}" uploaded to ${dirLabel}`
    : `${names.length} files uploaded to ${dirLabel}`;
  const id = 'upload-confirm-' + Date.now();
  if (!mkWin({ id, title: 'Upload Complete', icon: 'icon:success', w: 300, h: 140, popup: true, menubar: false, statusbar: false })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:14px;font-family: var(--sleep-font);font-size:12px;';
  body.innerHTML = `<div style="margin-bottom:12px;">${msg}</div>
    <div style="margin-bottom:8px;color:#555;">Use OPEN &lt;filename&gt; in terminal, or type the filename to view.</div>
    <div style="text-align:center;"><button class="dlg-btn" onclick="closeWin('${id}')">OK</button></div>`;
}

// Decode a binary file's bytes the way Windows Notepad does: straight through
// the ANSI codepage (CP-1252), one byte to one character. That is what produces
// the classic mojibake -- readable ASCII fragments like "ftypisom" floating in
// a sea of symbols -- rather than a blank page or a polite error.
//
// Capped because a multi-megabyte file decodes to as many characters, and a
// textarea that large janks badly. Most sleepOS blobs land under the cap whole.
const BINARY_VIEW_BYTE_LIMIT = 512 * 1024;

// Returns { text } on success or { error } with a reason short enough for a
// status bar. The reason is distinguished rather than generic: the preloaded
// media are served from an r2.dev URL, which cannot send CORS headers, so those
// bytes are genuinely unreadable and saying so beats a silent blank document.
async function readBlobAsAnsiText(blobValue) {
  if (!blobValue?.url) return { error: 'no data' };
  const sameOrigin = blobValue.url.startsWith('blob:') || blobValue.url.startsWith(location.origin);
  try {
    const res = await fetch(blobValue.url);
    if (!res.ok) return { error: 'unreadable (HTTP ' + res.status + ')' };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, BINARY_VIEW_BYTE_LIMIT));
    return { text: new TextDecoder('windows-1252').decode(bytes) };
  } catch (e) {
    return { error: sameOrigin ? 'unreadable (data unavailable)' : 'unreadable (cross-origin asset)' };
  }
}

// Every read in this file is blob METADATA - the bytes already live behind an
// object URL, so vfsStatSync's `.blob` record carries everything the players
// need. Nothing here becomes async.
function openMediaFile(filename, dirName) {
  const st = vfsStatSync(filename, dirName);
  const blob = st && st.kind === 'blob' ? st.blob : null;
  if (!blob) { return; }
  if (blob.kind === 'image') openImageViewer(st.name, st.dirName);
  else if (blob.kind === 'video') openVideoPlayer(st.name, st.dirName);
  else if (blob.kind === 'audio') openAudioPlayer(st.name, st.dirName);
  else osAlert('Cannot open binary file:\n' + st.name, 'Cannot Open', 'icon:error');
}

function openImageViewer(filename, dirName) {
  const st = vfsStatSync(filename, dirName);
  const blob = st && st.kind === 'blob' ? st.blob : null; if (!blob) return;
  const pathKey = (st.dirName ? st.dirName + '\\' : '') + st.name;
  const id = 'img-' + pathKey.replace(/\W/g,'_');
  if (!mkWin({ id, title: filename + ' \u2014 Image Viewer', icon: 'icon:image', w: 520, h: 400 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;';
  const wrap = document.createElement('div'); wrap.className = 'media-body';
  const img  = document.createElement('img'); img.src = blob.url;
  wrap.appendChild(img); body.appendChild(wrap);
  if (ws) ws.textContent = st.name + '  \u2014  ' + fmtSize(blob.size);
  if (mb) {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = 'File';
    span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, [
      { label: 'Close', action: () => closeWin(id) },
    ]); });
    mb.appendChild(span);
    const viewSpan = document.createElement('span');
    viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
    viewSpan.addEventListener('click', e => { e.stopPropagation(); showDropdown(viewSpan, [
      { label: 'Actual Size',  action: () => { img.style.maxWidth='none'; img.style.maxHeight='none'; } },
      { label: 'Fit to Window', action: () => { img.style.maxWidth='100%'; img.style.maxHeight='100%'; } },
    ]); });
    mb.appendChild(viewSpan);
  }
}

function openVideoPlayer(filename, dirName) {
  const st = vfsStatSync(filename, dirName);
  const blob = st && st.kind === 'blob' ? st.blob : null; if (!blob) return;
  const pathKey = (st.dirName ? st.dirName + '\\' : '') + st.name;
  const id = 'vid-' + pathKey.replace(/\W/g,'_');
  if (!mkWin({ id, title: iconLabel(st.name) + ' \u2014 Media Player', icon: 'icon:video', w: 500, h: 390 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  const shell  = document.createElement('div'); shell.className = 'vp-shell';

  // ── Screen ────────────────────────────────────────────────────
  const screen  = document.createElement('div'); screen.className = 'vp-screen';
  const video   = document.createElement('video'); video.src = blob.url;
  const dither  = document.createElement('div'); dither.className = 'vp-dither';
  dither.style.display = osSettings.videoDither ? '' : 'none';
  const overlay = document.createElement('div'); overlay.className = 'vp-screen-overlay';
  overlay.textContent = '▶'; overlay.style.opacity = '1';
  screen.appendChild(video); screen.appendChild(dither); screen.appendChild(overlay);
  screen.addEventListener('click', () => video.paused ? video.play() : video.pause());

  // ── Bottom bar ────────────────────────────────────────────────
  const bar = document.createElement('div'); bar.className = 'vp-bar';

  // Seek row
  const seekRow = document.createElement('div'); seekRow.className = 'vp-seek-row';
  const timeEl  = document.createElement('div'); timeEl.className = 'vp-time'; timeEl.textContent = '0:00';
  const durEl   = document.createElement('div'); durEl.className = 'vp-time vp-dur'; durEl.textContent = '0:00';
  const seek    = document.createElement('input'); seek.type = 'range'; seek.className = 'vp-seek';
  seek.min = 0; seek.max = 1000; seek.value = 0;
  seekRow.appendChild(timeEl); seekRow.appendChild(seek); seekRow.appendChild(durEl);

  // Button row
  const btnRow = document.createElement('div'); btnRow.className = 'vp-btn-row';
  const mkBtn = (txt, title, cls, fn) => {
    const b = document.createElement('div');
    b.className = 'vp-btn' + (cls ? ' ' + cls : '');
    b.textContent = txt; b.title = title;
    b.addEventListener('click', fn); return b;
  };
  const div = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };

  const btnRew  = mkBtn('\u23EE', 'Back 10s',    '', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
  const btnPlay = mkBtn('\u25B6', 'Play/Pause', 'vp-btn-play', () => video.paused ? video.play() : video.pause());
  const btnStop = mkBtn('\u25A0', 'Stop',        '', () => { video.pause(); video.currentTime = 0; });
  const btnFwd  = mkBtn('\u23ED', 'Forward 10s', '', () => { video.currentTime = Math.min(video.duration||0, video.currentTime + 10); });

  const muteBtn = mkBtn('\u{1F50A}', 'Mute', '', () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? '\u{1F507}' : '\u{1F50A}';
    renderVol();
  });

  // Unicode block volume slider (10 blocks)
  const volEl = document.createElement('div'); volEl.className = 'vp-vol-blocks'; volEl.title = 'Volume';
  const VOL_BLOCKS = 10;
  function renderVol() {
    const v = video.muted ? 0 : video.volume;
    const filled = Math.round(v * VOL_BLOCKS);
    const on = Array(filled + 1).join('&#9632;');
    const off = Array(VOL_BLOCKS - filled + 1).join('&#9643;');
    volEl.innerHTML =
      `<span style="color:#000080">${on}</span>` +
      `<span style="color:#6a6a6a">${off}</span>`;
  }
  function setVolFromX(clientX) {
    const r = volEl.getBoundingClientRect();
    video.volume = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    video.muted = false;
    muteBtn.textContent = '\u{1F50A}';
    renderVol();
  }
  let _volDrag = false;
  volEl.addEventListener('mousedown', e => { _volDrag = true; setVolFromX(e.clientX); });
  document.addEventListener('mousemove', e => { if (_volDrag) setVolFromX(e.clientX); });
  document.addEventListener('mouseup', () => { _volDrag = false; });
  renderVol();

  const metaEl = document.createElement('div'); metaEl.className = 'vp-meta';
  metaEl.textContent = iconLabel(st.name) + '  \u00b7  ' + fmtSize(blob.size);

  btnRow.appendChild(btnRew); btnRow.appendChild(btnPlay); btnRow.appendChild(btnStop);
  btnRow.appendChild(btnFwd); btnRow.appendChild(div('vp-divider'));
  btnRow.appendChild(muteBtn); btnRow.appendChild(volEl);
  btnRow.appendChild(div('vp-spacer')); btnRow.appendChild(metaEl);

  bar.appendChild(seekRow); bar.appendChild(btnRow);
  shell.appendChild(screen); shell.appendChild(bar);
  body.appendChild(shell);

  // ── Helpers ───────────────────────────────────────────────────
  function fmtT(s) {
    if (!isFinite(s)) return '0:00';
    return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0');
  }
  function updateSeekGradient() {
    const pct = seek.max > 0 ? (seek.value / seek.max * 100).toFixed(1) + '%' : '0%';
    seek.style.setProperty('--pct', pct);
  }

  // ── Events ────────────────────────────────────────────────────
  video.addEventListener('loadedmetadata', () => { durEl.textContent = fmtT(video.duration); });
  video.addEventListener('timeupdate', () => {
    timeEl.textContent = fmtT(video.currentTime);
    if (!seek._dragging && video.duration) { seek.value = (video.currentTime / video.duration) * 1000; updateSeekGradient(); }
  });
  video.addEventListener('play',         () => { btnPlay.textContent = '❚❚'; overlay.style.opacity = '0'; });
  video.addEventListener('pause',        () => { btnPlay.textContent = '\u25B6'; overlay.style.opacity = '0.35'; });
  video.addEventListener('ended',        () => { btnPlay.textContent = '\u25B6'; overlay.style.opacity = '1'; });
  video.addEventListener('volumechange', renderVol);

  seek.addEventListener('mousedown', () => { seek._dragging = true; });
  seek.addEventListener('input', () => { if (video.duration) { video.currentTime = (seek.value/1000)*video.duration; updateSeekGradient(); } });
  seek.addEventListener('mouseup', () => { seek._dragging = false; });

  // ── Menu bar ──────────────────────────────────────────────────
  if (ws) ws.textContent = iconLabel(st.name) + '  \u2014  ' + fmtSize(blob.size);
  if (mb) {
    [
      { label: 'File', items: [{ label: 'Close', action: () => { video.pause(); closeWin(id); } }] },
      { label: 'Playback', items: [
        { label: 'Play / Pause', action: () => video.paused ? video.play() : video.pause() },
        { label: 'Stop',         action: () => { video.pause(); video.currentTime = 0; } },
        '-',
        { label: '\u21E6 Back 10s',    action: () => { video.currentTime = Math.max(0, video.currentTime - 10); } },
        { label: '\u21E8 Forward 10s', action: () => { video.currentTime = Math.min(video.duration||0, video.currentTime + 10); } },
      ]},
    ].forEach(({ label, items }) => {
      const span = document.createElement('span');
      span.className = 'menu-item'; span.textContent = label;
      span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items); });
      mb.appendChild(span);
    });
  }
}

function openAudioPlayer(filename, dirName) {
  const st = vfsStatSync(filename, dirName);
  const blob = st && st.kind === 'blob' ? st.blob : null; if (!blob) return;
  const pathKey = (st.dirName ? st.dirName + '\\' : '') + st.name;
  const id = 'aud-' + pathKey.replace(/\W/g,'_');
  if (!mkWin({ id, title: iconLabel(st.name) + ' - Media Player', icon: 'icon:audio', w: 420, h: 240 })) return;

  const body = document.getElementById('wb-' + id);
  const ws = document.getElementById('ws-' + id);
  const mb = document.getElementById('mb-' + id);
  const author = String(blob.author || '').trim();

  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  const shell = document.createElement('div'); shell.className = 'vp-shell';
  const screen = document.createElement('div'); screen.className = 'vp-screen ap-screen';
  const screenHead = document.createElement('div'); screenHead.className = 'ap-screen-head';
  const iconEl = document.createElement('div'); iconEl.className = 'ap-screen-icon'; iconEl.textContent = '♫';
  const metaWrap = document.createElement('div'); metaWrap.className = 'ap-screen-meta';
  const labelEl = document.createElement('div'); labelEl.className = 'ap-screen-label'; labelEl.textContent = 'SleepOS Audio Deck';
  const titleEl = document.createElement('div'); titleEl.className = 'ap-screen-title'; titleEl.textContent = iconLabel(st.name);
  const pathEl = document.createElement('div'); pathEl.className = 'ap-screen-path'; pathEl.textContent = (st.dirName ? st.dirName + '\\' : '') + st.name;
  metaWrap.appendChild(labelEl);
  metaWrap.appendChild(titleEl);
  if (author) {
    const authorEl = document.createElement('div');
    authorEl.className = 'ap-screen-path';
    authorEl.textContent = 'Author: ' + author;
    metaWrap.appendChild(authorEl);
  }
  metaWrap.appendChild(pathEl);
  const loopIndicator = document.createElement('div'); loopIndicator.className = 'ap-loop-indicator'; loopIndicator.textContent = '↻';
  screenHead.appendChild(iconEl);
  screenHead.appendChild(metaWrap);
  screenHead.appendChild(loopIndicator);
  screen.appendChild(screenHead);

  const bar = document.createElement('div'); bar.className = 'vp-bar';
  const seekRow = document.createElement('div'); seekRow.className = 'vp-seek-row';
  const timeEl = document.createElement('div'); timeEl.className = 'vp-time'; timeEl.textContent = '0:00';
  const durEl = document.createElement('div'); durEl.className = 'vp-time vp-dur'; durEl.textContent = '0:00';
  const seek = document.createElement('input'); seek.type = 'range'; seek.className = 'vp-seek';
  seek.min = 0; seek.max = 1000; seek.value = 0;
  seekRow.appendChild(timeEl);
  seekRow.appendChild(seek);
  seekRow.appendChild(durEl);

  const btnRow = document.createElement('div'); btnRow.className = 'vp-btn-row';
  const mkBtn = (txt, title, cls, fn) => {
    const b = document.createElement('div');
    b.className = 'vp-btn' + (cls ? ' ' + cls : '');
    b.textContent = txt;
    b.title = title;
    b.addEventListener('click', fn);
    return b;
  };
  const div = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };

  const audio = document.createElement('audio');
  audio.src = blob.url;
  audio.preload = 'metadata';
  audio.style.display = 'none';

  const btnRew = mkBtn('⏮', 'Back 10s', '', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  const btnPlay = mkBtn('▶', 'Play/Pause', 'vp-btn-play', () => audio.paused ? audio.play() : audio.pause());
  const btnStop = mkBtn('\u25A0', 'Stop', '', () => { audio.pause(); audio.currentTime = 0; });
  const btnFwd = mkBtn('⏭', 'Forward 10s', '', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
  const btnLoop = mkBtn('↻', 'Toggle Loop', '', () => {
    audio.loop = !audio.loop;
    renderLoop();
  });
  const muteBtn = mkBtn('🔊', 'Mute', '', () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    renderVol();
  });
  const volEl = document.createElement('div'); volEl.className = 'vp-vol-blocks'; volEl.title = 'Volume';
  const metaEl = document.createElement('div'); metaEl.className = 'vp-meta';
  metaEl.textContent = iconLabel(st.name) + '  ·  ' + fmtSize(blob.size) + (author ? '  ·  ' + author : '');

  btnRow.appendChild(btnRew);
  btnRow.appendChild(btnPlay);
  btnRow.appendChild(btnStop);
  btnRow.appendChild(btnFwd);
  btnRow.appendChild(div('vp-divider'));
  btnRow.appendChild(btnLoop);
  btnRow.appendChild(div('vp-divider'));
  btnRow.appendChild(muteBtn);
  btnRow.appendChild(volEl);
  btnRow.appendChild(div('vp-spacer'));
  btnRow.appendChild(metaEl);

  bar.appendChild(seekRow);
  bar.appendChild(btnRow);
  shell.appendChild(screen);
  shell.appendChild(bar);
  shell.appendChild(audio);
  body.appendChild(shell);

  function fmtT(s) {
    if (!isFinite(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }
  function updateSeekGradient() {
    const pct = seek.max > 0 ? (seek.value / seek.max * 100).toFixed(1) + '%' : '0%';
    seek.style.setProperty('--pct', pct);
  }
  function renderVol() {
    const v = audio.muted ? 0 : audio.volume;
    const filled = Math.round(v * 10);
    const on = Array(filled + 1).join('&#9632;');
    const off = Array(10 - filled + 1).join('&#9643;');
    volEl.innerHTML = `<span style="color:#000080">${on}</span><span style="color:#6a6a6a">${off}</span>`;
  }
  function renderLoop() {
    btnLoop.classList.toggle('active', audio.loop);
    loopIndicator.classList.toggle('active', audio.loop);
  }
  function setVolFromX(clientX) {
    const r = volEl.getBoundingClientRect();
    audio.volume = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    audio.muted = false;
    muteBtn.textContent = '🔊';
    renderVol();
  }

  let volDrag = false;
  function syncPlayingState() {
    btnPlay.textContent = audio.paused ? '▶' : '❚❚';
  }

  renderVol();
  renderLoop();
  updateSeekGradient();

  audio.addEventListener('loadedmetadata', () => { durEl.textContent = fmtT(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    timeEl.textContent = fmtT(audio.currentTime);
    if (!seek._dragging && audio.duration) {
      seek.value = (audio.currentTime / audio.duration) * 1000;
      updateSeekGradient();
    }
  });
  audio.addEventListener('play', syncPlayingState);
  audio.addEventListener('pause', syncPlayingState);
  audio.addEventListener('ended', syncPlayingState);
  audio.addEventListener('volumechange', renderVol);

  seek.addEventListener('mousedown', () => { seek._dragging = true; });
  seek.addEventListener('input', () => {
    if (audio.duration) {
      audio.currentTime = (seek.value / 1000) * audio.duration;
      updateSeekGradient();
    }
  });
  seek.addEventListener('mouseup', () => { seek._dragging = false; });

  volEl.addEventListener('mousedown', e => { volDrag = true; setVolFromX(e.clientX); });
  document.addEventListener('mousemove', e => { if (volDrag) setVolFromX(e.clientX); });
  document.addEventListener('mouseup', () => { volDrag = false; });

  if (ws) ws.textContent = iconLabel(st.name) + '  -  ' + fmtSize(blob.size) + (author ? '  -  ' + author : '');
  if (mb) {
    [
      { label: 'File', items: [{ label: 'Close', action: () => { audio.pause(); closeWin(id); } }] },
      { label: 'Playback', items: [
        { label: 'Play / Pause', action: () => audio.paused ? audio.play() : audio.pause() },
        { label: 'Stop', action: () => { audio.pause(); audio.currentTime = 0; } },
        '-',
        { label: '⇦ Back 10s', action: () => { audio.currentTime = Math.max(0, audio.currentTime - 10); } },
        { label: '⇨ Forward 10s', action: () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); } },
        '-',
        { label: () => (audio.loop ? 'Disable Loop' : 'Enable Loop'), action: () => { audio.loop = !audio.loop; renderLoop(); } },
      ]},
    ].forEach(({ label, items }) => {
      const span = document.createElement('span');
      span.className = 'menu-item';
      span.textContent = label;
      span.addEventListener('click', e => {
        e.stopPropagation();
        showDropdown(span, items.map(item => {
          if (typeof item === 'string') return item;
          if (typeof item.label === 'function') return { ...item, label: item.label() };
          return item;
        }));
      });
      mb.appendChild(span);
    });
  }
}

// Drag-and-drop onto the desktop
let _dragCount = 0;
document.addEventListener('dragenter', e => {
  if (getShellDragPayload()) return;
  if ([...e.dataTransfer.types].includes('Files') && !e.target.closest?.('.os-window')) {
    _dragCount++;
    document.getElementById('drop-overlay').classList.add('active');
  }
});
document.addEventListener('dragleave', () => {
  _dragCount = Math.max(0, _dragCount - 1);
  if (_dragCount === 0) document.getElementById('drop-overlay').classList.remove('active');
});
document.addEventListener('dragover', e => {
  if (getShellDragPayload()) return;
  if (![...e.dataTransfer.types].includes('Files')) return;
  if (e.target.closest?.('.os-window')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('drop', e => {
  if (e.defaultPrevented || getShellDragPayload()) return;
  if (!e.dataTransfer.files.length) return;
  if (e.target.closest?.('.os-window')) return;
  e.preventDefault();
  _dragCount = 0;
  document.getElementById('drop-overlay').classList.remove('active');
  _uploadCwd = 'DESKTOP';
  handleFileUpload(e.dataTransfer.files);
});
document.getElementById('file-upload-input').addEventListener('change', function() {
  if (this.files.length) handleFileUpload(this.files);
  this.value = '';
});

// Shared dropdown menu helpers
function closeDropdown() {
  const old = document.getElementById('active-dropdown');
  if (old) old.remove();
}
// A menu item may carry an `icon`. Items are laid out with a fixed 16px gutter
// so their labels line up whether or not each one has art - but only if some
// item in THIS menu has an icon, so the File/Edit/View menubar dropdowns, which
// never do, stay as tight as they were.
function buildMenuItemEl(item, gutter) {
  const el = document.createElement('div');
  el.className = 'menu-dd-item' + (item.disabled ? ' disabled' : '') + (gutter ? ' has-gutter' : '');
  if (gutter) {
    const ic = document.createElement('span');
    ic.className = 'menu-dd-icon';
    ic.innerHTML = iconMarkup(item.icon || '');
    el.appendChild(ic);
  }
  const label = document.createElement('span');
  label.textContent = item.label;
  el.appendChild(label);
  return el;
}
function menuNeedsGutter(items) {
  return items.some(item => item !== '-' && item.icon);
}
function showDropdown(anchor, items) {
  closeDropdown();
  const rect = anchor.getBoundingClientRect();
  const dd = document.createElement('div');
  dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
  dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
  const gutter = menuNeedsGutter(items);
  items.forEach(item => {
    if (item === '-') {
      const sep = document.createElement('div'); sep.className = 'menu-dd-sep'; dd.appendChild(sep);
    } else {
      const el = buildMenuItemEl(item, gutter);
      if (!item.disabled) el.addEventListener('mousedown', e => { e.stopPropagation(); closeDropdown(); item.action(); });
      dd.appendChild(el);
    }
  });
  document.body.appendChild(dd);
  setTimeout(() => document.addEventListener('mousedown', closeDropdown, { once: true }), 0);
}
// Long-press to context menu on touch - dispatches synthetic contextmenu event
let _longPressActive = false;
function addLongPress(el) {
  let timer, startX, startY;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    startX = e.clientX; startY = e.clientY;
    timer = setTimeout(() => {
      timer = null;
      _longPressActive = true;
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: startX, clientY: startY }));
    }, 500);
  }, { passive: true });
  el.addEventListener('pointermove', e => {
    if (!timer) return;
    if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) { clearTimeout(timer); timer = null; }
  }, { passive: true });
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerup', cancel, { passive: true });
  el.addEventListener('pointercancel', cancel, { passive: true });
}

function showCtxMenu(x, y, items) {
  closeDropdown();
  const dd = document.createElement('div');
  dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
  // Keep menu on screen
  dd.style.left = x + 'px'; dd.style.top = y + 'px';
  const gutter = menuNeedsGutter(items);
  items.forEach(item => {
    if (item === '-') {
      const sep = document.createElement('div'); sep.className = 'menu-dd-sep'; dd.appendChild(sep);
    } else {
      const el = buildMenuItemEl(item, gutter);
      if (!item.disabled) el.addEventListener('pointerdown', e => { e.stopPropagation(); closeDropdown(); item.action(); });
      dd.appendChild(el);
    }
  });
  document.body.appendChild(dd);
  // Clamp to viewport
  const r = dd.getBoundingClientRect();
  if (r.right  > window.innerWidth)  dd.style.left = (x - r.width)  + 'px';
  if (r.bottom > window.innerHeight) dd.style.top  = (y - r.height) + 'px';
  setTimeout(() => {
    document.addEventListener('mousedown', closeDropdown, { once: true });
    document.addEventListener('touchstart', closeDropdown, { once: true, passive: true });
  }, 0);
}

// ── System toast ──────────────────────────────────────────────────
// A disk-full notice is useless if anything can cover it, so the toast sits at
// 99993: above every window, the 28px taskbar (9000), the start menu (9001)
// and the alt-tab / CAD / sleep overlays (99990-99992), and below the
// daemon-fx, glitch, CRT and context-menu layers. A low z-index fails twice
// over - the bar renders underneath the taskbar it is anchored to, and zTop
// starts at 100 and increments on every window FOCUS, not just creation, so
// windows climb past a three-digit value during an ordinary session.
var _osToastHideTimer = null;
var _osToastClearTimer = null;

function showOsToast(message) {
  let el = document.getElementById('os-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'os-toast';
    // pointer-events:none, following #crt: the bar must never swallow a click
    // aimed at the desktop, and it is anchored 8px above the taskbar so the
    // start button stays reachable while it is showing.
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'transform:translateX(-50%)',
      'bottom:36px',
      'z-index:99993',
      'max-width:min(520px, calc(100vw - 32px))',
      'padding:12px',
      'background:rgba(20,14,20,0.94)',
      'border:1px solid rgba(154,179,147,0.18)',
      'box-shadow:0 2px 14px rgba(0,0,0,0.55)',
      'font-family:var(--sleep-font)',
      'font-size:12px',
      'line-height:1.5',
      'color:rgba(255,255,255,0.8)',
      'text-align:center',
      'pointer-events:none',
      'opacity:0',
      'display:none',
    ].join(';') + ';';
    document.body.appendChild(el);
  }
  // One element, reused. A full disk fails its commit again on every retry and
  // a column of identical toasts would bury the screen it is trying to warn
  // about; the newest message replaces the old one and restarts the clock.
  el.textContent = String(message == null ? '' : message);
  // The toast only ever reports a failure (a commit that could not be saved),
  // so unlike osAlert it needs no test for what kind of message this is.
  playSound('error');
  clearTimeout(_osToastHideTimer);
  clearTimeout(_osToastClearTimer);
  // Appearing is SYNCHRONOUS and deliberately has no transition. A fade-in out
  // of display:none does not start in the tick the element becomes displayed -
  // there is no before-change style to interpolate from - so the declared
  // transition pinned the computed opacity at 0 and the toast never appeared:
  // display:block, correctly positioned, inline opacity 1, nothing on screen.
  // Deferring to requestAnimationFrame fixes that only where frames are
  // running; it was still invisible after four seconds on a frame-starved
  // renderer. This is the one message that tells the user their work was not
  // saved, so its visibility must not depend on the frame clock at all.
  el.style.transition = 'none';
  el.style.display = 'block';
  el.style.opacity = '1';
  _osToastHideTimer = setTimeout(() => {
    // Fading OUT can safely use a transition: if it never runs, the toast
    // simply disappears when display flips instead of dissolving.
    el.style.transition = 'opacity 320ms ease';
    el.style.opacity = '0';
    _osToastClearTimer = setTimeout(() => { el.style.display = 'none'; }, 400);
  }, 6000);
}

// ── OS-native dialog replacements (no browser prompt/alert/confirm) ──
function _osDlgPos(w, h) {
  return { x: Math.max(20, Math.floor(window.innerWidth/2)  - Math.floor(w/2)),
           y: Math.max(20, Math.floor(window.innerHeight/2) - Math.floor(h/2)) };
}
// osAlert is also the About and Help dialog, so an unconditional buzz would
// fire on "About DEFRAG.exe". Only failures get the sound, recognised from the
// two arguments every call site already passes.
//
// 'icon:error' leads the list because it is what this codebase actually uses
// for a failure - Paste Failed, Upload Failed, Cannot Open, Cannot Create,
// Cannot Save, Disk Full, Rename Failed, Missing Shortcut all pass it, and
// nothing informational does. 'icon:warning' covers the softer refusals
// (blocked delete, access denied, drive not found).
//
// The bare emoji are kept alongside the tokens. Nothing in the OS passes them
// any more, but they cost one Set entry each and they are what a stale window
// or an old persisted shortcut would still carry.
//
// Deliberately NOT matched against the message body, only the title and icon.
// The body is where the tempting words are, and also where they lie: Help
// Topics for DEFRAG.exe contains "some system files cannot be moved", which a
// body scan would hear as an error.
const ALERT_ERROR_ICONS = new Set(['icon:error', 'icon:warning', 'X', '⚠', '⚠️', '❌', '\u{1F6AB}', '⛔', '\u{1F4A5}']);
const ALERT_ERROR_TITLE = /\b(error|fail(ed|ure|s)?|denied|invalid|refused|corrupt|unavailable|not found|no such|cannot|can't)\b/i;
function isErrorAlert(title, icon) {
  return ALERT_ERROR_ICONS.has(String(icon == null ? '' : icon).trim())
      || ALERT_ERROR_TITLE.test(String(title == null ? '' : title));
}

function osAlert(msg, title, icon) {
  title = title || 'sleepOS'; icon = icon || 'icon:tip';
  const id = 'os-alert-' + Date.now();
  const p = _osDlgPos(320, 175);
  if (!mkWin({ id, title, icon, w:320, h:175, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  if (isErrorAlert(title, icon)) playSound('error');
  const b = document.getElementById('wb-' + id);
  b.innerHTML = `<div class="dlg-body"><div class="dlg-icon">${iconMarkup(icon)}</div><div class="dlg-text" style="white-space:pre-wrap;">${(msg+'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div><div class="dlg-btns"><button class="dlg-btn primary" id="${id}-ok">OK</button></div>`;
  const ok = document.getElementById(id + '-ok');
  ok.onclick = () => closeWin(id);
  ok.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') closeWin(id); });
  setTimeout(() => ok.focus(), 40);
}
function osConfirm(msg, title, cb, icon) {
  title = title || 'Confirm'; icon = icon || '❓';
  const id = 'os-confirm-' + Date.now();
  const p = _osDlgPos(320, 175);
  if (!mkWin({ id, title, icon, w:320, h:175, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  const b = document.getElementById('wb-' + id);
  b.innerHTML = `<div class="dlg-body"><div class="dlg-icon">${iconMarkup(icon)}</div><div class="dlg-text" style="white-space:pre-wrap;">${(msg+'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div><div class="dlg-btns" id="${id}-btns"></div>`;
  const row = document.getElementById(id + '-btns');
  const ok  = document.createElement('button'); ok.className  = 'dlg-btn primary'; ok.textContent = 'OK';
  const can = document.createElement('button'); can.className = 'dlg-btn';         can.textContent = 'Cancel';
  ok.onclick  = () => { closeWin(id); cb(true);  };
  can.onclick = () => { closeWin(id); cb(false); };
  [ok, can].forEach(btn => btn.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
    if (e.key === 'Escape') can.click();
  }));
  row.appendChild(ok); row.appendChild(can);
  setTimeout(() => ok.focus(), 40);
}
function osPrompt(msg, def, title, cb, icon) {
  title = title || 'Input'; icon = icon || '✏️'; def = def ?? '';
  const id = 'os-prompt-' + Date.now();
  const p = _osDlgPos(340, 185);
  if (!mkWin({ id, title, icon, w:340, h:185, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  const b = document.getElementById('wb-' + id);
  b.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:8px;font-size:11px;';
  const msgDiv = document.createElement('div');
  msgDiv.style.whiteSpace = 'pre-wrap'; msgDiv.textContent = msg;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = def;
  inp.style.cssText = 'border:2px solid;border-color:#808080 #fff #fff #808080;padding:2px 4px;font-family: var(--sleep-font);font-size:11px;background:#fff;width:100%;box-sizing:border-box;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;';
  const ok  = document.createElement('button'); ok.className  = 'dlg-btn primary'; ok.textContent = 'OK';
  const can = document.createElement('button'); can.className = 'dlg-btn';         can.textContent = 'Cancel';
  ok.onclick  = () => { const v = inp.value; closeWin(id); cb(v.trim() || null); };
  can.onclick = () => { closeWin(id); cb(null); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') can.click(); });
  row.appendChild(ok); row.appendChild(can);
  b.appendChild(msgDiv); b.appendChild(inp); b.appendChild(row);
  setTimeout(() => { inp.focus(); inp.select(); }, 40);
}

// Per-pid CPU accounting over a sample window.
//
// Pure arithmetic: every entry point takes the current time rather than
// reading a clock, so the whole thing is testable in node without faking
// performance.now(). The callers that DO read a clock are the probe in
// os/wm.js and the tick in apps/sysmon.js.
//
// "CPU %" means busy milliseconds attributed to a process divided by
// wall-clock milliseconds in the window - share of one core over the window.
// The same definition covers main-thread apps and worker scripts, which is
// what makes the two comparable in one column.
var _instBusyMs = new Map();
var _instWindowOpenedAt = null;

function instBusyAdd(pid, ms) {
  // A window event on a chrome element with no owning process, or a
  // zero-length dispatch, carries no information and must not create a row.
  if (!pid || !(ms > 0)) return;
  _instBusyMs.set(pid, (_instBusyMs.get(pid) || 0) + ms);
}

function instBusyMsFor(pid) { return _instBusyMs.get(pid) || 0; }

function instWindowOpen(nowMs) {
  _instWindowOpenedAt = nowMs;
  _instBusyMs.clear();
}

function instWindowSample(nowMs) {
  const out = new Map();
  const elapsed = _instWindowOpenedAt === null ? 0 : nowMs - _instWindowOpenedAt;
  if (elapsed > 0) {
    _instBusyMs.forEach(function (ms, pid) {
      // Capped at 100: a single worker cannot occupy more than one core's
      // worth of a window, and main-thread apps share one thread by
      // definition. A figure above 100 would mean the measurement is wrong,
      // and printing it would be worse than clamping it.
      out.set(pid, Math.min(100, (ms / elapsed) * 100));
    });
  }
  // Always reopen, including on a zero-length window. Leaving the old totals
  // in place would report the same work again next tick and keep an idle
  // process looking busy.
  instWindowOpen(nowMs);
  return out;
}

// ---- Main-thread attribution -------------------------------------------
//
// Timers first, because they are the simple half: a timer never touches the
// DOM, so the capture probe below cannot see it. The owning window is captured
// at registration and the callback is bracketed on invocation.
function _instRunFor(winId, fn) {
  const pid = typeof kernelPidForWin === 'function' ? kernelPidForWin(winId) : null;
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    // finally, so a throwing callback still reports the time it burned. A
    // handler that throws on every tick is exactly the one worth seeing.
    instBusyAdd(pid, performance.now() - t0);
  }
}

function procSetTimeout(winId, fn, ms) {
  return setTimeout(function () { _instRunFor(winId, fn); }, ms);
}

function procSetInterval(winId, fn, ms) {
  return setInterval(function () { _instRunFor(winId, fn); }, ms);
}

// The probe. One capture-phase listener on the window root, per event type.
//
// Capture runs root-to-target, so this fires before any handler registered
// inside the subtree no matter what order they were added in. The measurement
// is closed on a microtask rather than by a bubble-phase listener on the same
// root, and that is not a stylistic choice: apps/ contains 25
// stopPropagation() calls, every one of which would stop a bubble listener
// firing and silently under-report exactly the paths doing the most work.
// Microtasks drain once the JS stack empties - after the whole synchronous
// dispatch - so neither stopPropagation nor a throwing handler can prevent the
// close.
var INST_PROBE_EVENTS = ['click', 'mousedown', 'mouseup', 'keydown', 'keyup',
                         'input', 'change', 'contextmenu', 'wheel', 'dblclick'];

function instInstallProbe(rootEl, winId) {
  if (!rootEl || !rootEl.addEventListener) return function () {};
  const onEvent = function () {
    const pid = typeof kernelPidForWin === 'function' ? kernelPidForWin(winId) : null;
    if (!pid) return;
    const t0 = performance.now();
    queueMicrotask(function () { instBusyAdd(pid, performance.now() - t0); });
  };
  INST_PROBE_EVENTS.forEach(function (type) {
    rootEl.addEventListener(type, onEvent, true);
  });
  return function instRemoveProbe() {
    INST_PROBE_EVENTS.forEach(function (type) {
      rootEl.removeEventListener(type, onEvent, true);
    });
  };
}
// ─────────────────────────────────────────────────────────────────
// WINDOW GEOMETRY CLAMPING
// ─────────────────────────────────────────────────────────────────
// A window whose titlebar leaves the desktop is unrecoverable: the drag handle
// and the close button go with it, so it can be neither moved back nor closed.
// Every path that writes a window's left/top/width/height ends in
// clampWinGeometry so that state is unreachable - cascade spawns, resize
// handles, unmaximize, and viewport resizes all funnel through here.
const WIN_MIN_W = 180, WIN_MIN_H = 80;   // must match .os-window min-width/min-height

function desktopBounds() {
  const d = document.getElementById('desktop');
  // #desktop is display:none until boot finishes, so a window created during
  // startup would otherwise be clamped into a 0x0 box. Fall back to the
  // viewport minus the taskbar, matching the CSS.
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  const taskbarH = isMobile ? 56 : 28;
  return {
    w: d && d.offsetWidth  ? d.offsetWidth  : window.innerWidth,
    h: d && d.offsetHeight ? d.offsetHeight : Math.max(WIN_MIN_H, window.innerHeight - taskbarH),
  };
}

// Shrinks an oversized window and pulls a stray one back inside the desktop.
// Minimized windows are display:none, so their offset* are all 0 - clamping one
// would slam it to the top-left and lose its position. They get clamped when
// they are restored instead (see unminWin).
function clampWinGeometry(el) {
  if (!el || el.style.display === 'none' || !el.offsetWidth) return;
  const { w: dw, h: dh } = desktopBounds();
  let W = el.offsetWidth, H = el.offsetHeight;
  if (W > dw) { W = Math.max(WIN_MIN_W, dw); el.style.width  = W + 'px'; }
  if (H > dh) { H = Math.max(WIN_MIN_H, dh); el.style.height = H + 'px'; }
  el.style.left = Math.max(0, Math.min(Math.max(0, dw - W), el.offsetLeft)) + 'px';
  el.style.top  = Math.max(0, Math.min(Math.max(0, dh - H), el.offsetTop))  + 'px';
}

function mkWin({ id, title, icon = 'icon:text', x, y, w = 500, h = 380,
                 menubar = true, statusbar = true, popup = false }) {
  if (wins[id]) { focusWin(id); unminWin(id); return null; }

  // Default position: slightly random cascade; on mobile fill viewport (except small popups)
  const count = Object.keys(wins).length;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  const bounds = desktopBounds();
  if (isMobile && !popup) {
    x = 0; y = 0;
    w = bounds.w;
    h = bounds.h;
  } else {
    // Cascade wraps back to the origin instead of marching off the bottom-right
    // corner once enough windows are open.
    if (x === undefined || y === undefined) {
      const room = Math.min(bounds.w - w - 80, bounds.h - h - 44);
      const slots = Math.max(1, Math.floor(room / 22) + 1);
      const step = (count % slots) * 22;
      if (x === undefined) x = 80 + step;
      if (y === undefined) y = 44 + step;
    }
    // Center popups on mobile
    if (isMobile && popup) {
      x = Math.max(4, Math.floor((bounds.w - w) / 2));
      y = Math.max(4, Math.floor((bounds.h - h) / 3));
    }
  }

  const el = document.createElement('div');
  el.className = 'os-window inactive';
  el.id = 'win-' + id;
  el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++zTop}`;

  el.innerHTML = `
    <div class="win-rz win-rz-n"></div><div class="win-rz win-rz-s"></div>
    <div class="win-rz win-rz-e"></div><div class="win-rz win-rz-w"></div>
    <div class="win-rz win-rz-nw"></div><div class="win-rz win-rz-ne"></div>
    <div class="win-rz win-rz-sw"></div><div class="win-rz win-rz-se"></div>
    <div class="win-titlebar" id="tb-${id}">
      <div class="win-title-text">
        <span class="win-icon">${iconMarkup(icon)}</span>
        <span id="wtitle-${id}">${escHtml(title == null ? '' : String(title))}</span>
      </div>
      <div class="win-controls">
        <button class="win-btn" title="Minimize" onclick="minWin('${id}')">─</button>
        <button class="win-btn" title="Maximize" onclick="maxWin('${id}')">□</button>
        <button class="win-btn" title="Close"    onclick="closeWin('${id}')">✕</button>
      </div>
    </div>
    ${menubar ? `<div class="win-menubar" id="mb-${id}"></div>` : ''}
    <div class="win-body" id="wb-${id}"></div>
    ${statusbar ? `<div class="win-statusbar"><div class="statusbar-panel" id="ws-${id}">Ready</div></div>` : ''}
  `;

  document.getElementById('windows-layer').appendChild(el);
  clampWinGeometry(el);   // callers pass explicit x/y/w/h that may not fit this viewport
  wins[id] = { el, title, icon, minimized: false, maximized: false, origStyle: null };

  // Built-in apps are real processes with real lifetimes. Registering here rather
  // than in each app means an app cannot forget to appear in ps.
  wins[id].pid = kernelRegisterSystem(id, processDisplayName(title, id));

  // Every app reaches the OS through mkWin, so the probe goes here rather than
  // into eight app files. A future app is instrumented the moment it opens a
  // window, with nothing to remember.
  wins[id].removeProbe = instInstallProbe(el, id);

  makeDraggable(el, document.getElementById('tb-' + id));
  makeResizable(el, id);
  addTbBtn(id, title, icon);
  el.addEventListener('mousedown', () => focusWin(id));
  el.addEventListener('touchstart', () => focusWin(id), { passive: true });

  focusWin(id);
  return el;
}

function focusWin(id) {
  const w = wins[id]; if (!w) return;
  w.el.style.zIndex = ++zTop;
  Object.values(wins).forEach(v => v.el.classList.add('inactive'));
  w.el.classList.remove('inactive');
  document.querySelectorAll('.taskbar-btn').forEach(b => b.classList.remove('focused'));
  const btn = document.getElementById('tbtn-' + id);
  if (btn) btn.classList.add('focused');
}

function minWin(id) {
  const w = wins[id]; if (!w) return;
  w.minimized = true; w.el.style.display = 'none';
  const btn = document.getElementById('tbtn-' + id);
  if (btn) btn.classList.remove('focused');
}

function unminWin(id) {
  const w = wins[id]; if (!w) return;
  w.minimized = false; w.el.style.display = 'flex';
  // Minimized windows are skipped by the resize clamp (they have no layout box),
  // so a window minimized on a large viewport and restored on a small one gets
  // pulled back inside here.
  if (w.maximized) fitMaximized(w); else clampWinGeometry(w.el);
  focusWin(id);
}

function fitMaximized(w) {
  const { w: dw, h: dh } = desktopBounds();
  w.el.style.left   = '0';
  w.el.style.top    = '0';
  w.el.style.width  = dw + 'px';
  w.el.style.height = dh + 'px';
}

function maxWin(id) {
  const w = wins[id]; if (!w) return;
  if (w.maximized) {
    w.el.style.cssText = w.origStyle;
    w.maximized = false;
    // origStyle was captured against whatever the desktop measured at the time;
    // it can be stale by now.
    clampWinGeometry(w.el);
  } else {
    w.origStyle = w.el.style.cssText;
    fitMaximized(w);
    w.el.style.zIndex = ++zTop;
    w.maximized = true;
  }
}

function restoreMaximizedForDrag(id, clientX, clientY) {
  const w = wins[id];
  if (!w || !w.maximized || !w.origStyle) return;
  const fullRect = w.el.getBoundingClientRect();
  const pointerRatio = fullRect.width ? Math.min(0.9, Math.max(0.1, (clientX - fullRect.left) / fullRect.width)) : 0.5;
  w.el.style.cssText = w.origStyle;
  w.maximized = false;
  w.el.style.zIndex = ++zTop;
  clampWinGeometry(w.el);   // the restored size may not fit the current desktop
  const { w: dw, h: dh } = desktopBounds();
  const maxLeft = Math.max(0, dw - w.el.offsetWidth);
  const maxTop = Math.max(0, dh - w.el.offsetHeight);
  w.el.style.left = Math.max(0, Math.min(maxLeft, clientX - w.el.offsetWidth * pointerRatio)) + 'px';
  w.el.style.top = Math.max(0, Math.min(maxTop, clientY - 14)) + 'px';
}

function closeWin(id) {
  const w = wins[id]; if (!w) return;
  if (w._interval) clearInterval(w._interval);
  // Apps that own something outside their DOM subtree - an observer, a running
  // sound, a subscription - hang a teardown here. DEFRAG.exe has set _onclose
  // since it was written and nothing ever called it, so its ResizeObserver
  // outlived every window it was created for. Wrapped because a throwing
  // teardown must not leave a closed window in `wins` and on the taskbar.
  if (typeof w._onclose === 'function') {
    try { w._onclose(); } catch (e) {}
  }
  if (wins[id] && typeof wins[id].removeProbe === 'function') wins[id].removeProbe();
  w.el.remove(); delete wins[id];
  kernelDeregisterSystem(id);
  const btn = document.getElementById('tbtn-' + id); if (btn) btn.remove();
}

function makeDraggable(win, handle) {
  let sx, sy, sl, st;
  const id = win.id.replace('win-', '');

  function startDrag(cx, cy) {
    sx = cx; sy = cy;
    sl = win.offsetLeft; st = win.offsetTop;
  }
  function moveDrag(cx, cy) {
    const { w: dw, h: dh } = desktopBounds();
    const maxLeft = Math.max(0, dw - win.offsetWidth);
    const maxTop = Math.max(0, dh - win.offsetHeight);
    win.style.left = Math.max(0, Math.min(maxLeft, sl + cx - sx)) + 'px';
    win.style.top  = Math.max(0, Math.min(maxTop, st + cy - sy)) + 'px';
  }

  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    focusWin(id);
    restoreMaximizedForDrag(id, e.clientX, e.clientY);
    startDrag(e.clientX, e.clientY);
    const onMove = (e) => moveDrag(e.clientX, e.clientY);
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  handle.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    focusWin(id);
    const t = e.touches[0];
    restoreMaximizedForDrag(id, t.clientX, t.clientY);
    startDrag(t.clientX, t.clientY);
    const onMove = (e) => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY); };
    const onEnd = () => { handle.removeEventListener('touchmove', onMove); handle.removeEventListener('touchend', onEnd); };
    handle.addEventListener('touchmove', onMove, { passive: false });
    handle.addEventListener('touchend', onEnd);
  }, { passive: false });
}

function makeResizable(win, id) {
  const MIN_W = WIN_MIN_W, MIN_H = WIN_MIN_H;
  win.querySelectorAll('.win-rz').forEach(handle => {
    const a = [...handle.classList].find(c => c.startsWith('win-rz-') && c !== 'win-rz').replace('win-rz-','');
    handle.addEventListener('mousedown', e => {
      const w = wins[id]; if (w && w.maximized) return; // don't resize while maximized
      e.preventDefault(); e.stopPropagation();
      focusWin(id);
      const x0 = e.clientX, y0 = e.clientY;
      const W0 = win.offsetWidth, H0 = win.offsetHeight;
      const L0 = win.offsetLeft,  T0 = win.offsetTop;
      const onMove = e => {
        const dx = e.clientX - x0, dy = e.clientY - y0;
        const { w: dw, h: dh } = desktopBounds();
        let W = W0, H = H0, L = L0, T = T0;
        // Each edge is capped at the desktop edge it is heading for. Without
        // this, an east drag pushes the titlebar's close/maximize buttons past
        // the right edge, and a west drag puts the window's origin at a
        // negative left - in both cases the window is stuck there, since the
        // drag clamp can only move it within the desktop.
        if (a.includes('e')) W = Math.max(MIN_W, Math.min(W0 + dx, dw - L0));
        if (a.includes('s')) H = Math.max(MIN_H, Math.min(H0 + dy, dh - T0));
        if (a.includes('w')) { W = Math.max(MIN_W, Math.min(W0 - dx, L0 + W0)); L = L0 + W0 - W; }
        if (a.includes('n')) { H = Math.max(MIN_H, Math.min(H0 - dy, T0 + H0)); T = T0 + H0 - H; }
        win.style.width = W+'px'; win.style.height = H+'px';
        win.style.left  = L+'px'; win.style.top    = T+'px';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// Shrinking the browser window used to strand every window that sat past the
// new edge: nothing re-measured them, and the drag clamp could not pull back a
// titlebar that was already outside the desktop. Re-clamp on every viewport
// change, and re-fit maximized windows to the new desktop while at it.
// rAF-coalesced because resize fires continuously during a drag.
let _wmReflowPending = false;
function reflowWindows() {
  Object.values(wins).forEach(w => {
    if (w.minimized) return;   // clamped on restore instead - see unminWin
    if (w.maximized) fitMaximized(w); else clampWinGeometry(w.el);
  });
}
window.addEventListener('resize', () => {
  if (_wmReflowPending) return;
  _wmReflowPending = true;
  requestAnimationFrame(() => { _wmReflowPending = false; reflowWindows(); });
});

// Rename a live window. A window's title is shown in four places and they used
// to be updated one at a time by whoever remembered: the titlebar span, the
// taskbar button, and - through wins[id].title - the Alt+Tab overlay, SYSMON's
// process list and the terminal's task list. Callers that only touched the
// span left the other three showing the old name.
function setWinTitle(id, title) {
  const w = wins[id];
  if (!w) return;
  w.title = title;
  const span = document.getElementById('wtitle-' + id);
  if (span) span.textContent = title;
  const btn = document.getElementById('tbtn-' + id);
  // The button is `<span>icon</span><span>title</span>`; only the label moves.
  if (btn && btn.lastElementChild) btn.lastElementChild.textContent = title;
}

function addTbBtn(id, title, icon) {
  const btn = document.createElement('button');
  btn.className = 'taskbar-btn focused';
  btn.id = 'tbtn-' + id;
  btn.innerHTML = `<span class="tb-icon">${iconMarkup(icon)}</span><span></span>`;
  btn.lastElementChild.textContent = title;
  btn.addEventListener('click', () => {
    const w = wins[id]; if (!w) return;
    if (w.minimized) { unminWin(id); }
    else if (w.maximized) { maxWin(id); }   // restore to pre-maximize size
    else if (w.el.classList.contains('inactive')) { focusWin(id); }
    else { minWin(id); }
  });
  document.getElementById('taskbar-programs').appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────────────────────────
function formatClockDisplay(now, allowCorruption = true) {
  if (allowCorruption && window._clockCorrupted && Math.random() < 0.75) return '??:??';
  let h = allowCorruption && Math.random() < 0.004 ? Math.floor(Math.random() * 24) : now.getHours();
  const m = allowCorruption && Math.random() < 0.004 ? Math.floor(Math.random() * 60) : now.getMinutes();
  let suffix = '';
  if (osSettings.clock12h) {
    suffix = h >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;
  }
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + suffix;
}
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = formatClockDisplay(now, true);
  const sleepClock = document.getElementById('sleep-clock');
  if (sleepClock) sleepClock.textContent = formatClockDisplay(now, false);
}
setInterval(updateClock, 1000); updateClock();

// idle sleep
const IDLE_MOVE_THROTTLE_MS = 1000;
const MANUAL_SLEEP_WAKE_DELAY_MS = 500;
let idleSleepTimer = null;
let idleSleepActive = false;
let idleSleepArmed = false;
let idleLastActivityTs = Date.now();
let idleLastMoveTs = 0;
let idleSleepWakeLockedUntil = 0;

function scheduleIdleSleep() {
  if (idleSleepTimer) clearTimeout(idleSleepTimer);
  if (!idleSleepArmed || idleSleepActive || !bisDone) return;
  const remainingMs = getIdleSleepMs() - (Date.now() - idleLastActivityTs);
  if (remainingMs <= 0) {
    enterIdleSleep();
    return;
  }
  idleSleepTimer = setTimeout(enterIdleSleep, remainingMs);
}
function noteIdleActivity(kind = 'generic', force = false) {
  if (!idleSleepArmed) return;
  const now = Date.now();
  if (!force && idleSleepActive) return;
  if (kind === 'move') {
    if (!force && now - idleLastMoveTs < IDLE_MOVE_THROTTLE_MS) return;
    idleLastMoveTs = now;
  }
  idleLastActivityTs = now;
  scheduleIdleSleep();
}
function enterIdleSleep(wakeLockMs = 0) {
  if (idleSleepActive || !bisDone) return;
  idleSleepActive = true;
  idleSleepWakeLockedUntil = Date.now() + Math.max(0, wakeLockMs || 0);
  if (idleSleepTimer) clearTimeout(idleSleepTimer);
  closeStart();
  closeDropdown();
  closeCad();
  if (altTabActive) closeAltTab();
  const overlay = document.getElementById('sleep-overlay');
  if (!overlay) return;
  document.body.classList.add('idle-sleeping');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  // The monitor sleeps; the machine does not. Ducked rather than stopped.
  duckSoundLoop('ambience', AMBIENCE_SLEEP_DUCK, 1.2);
  updateClock();
  overlay.focus();
}
function wakeIdleSleep() {
  if (!idleSleepActive) return;
  idleSleepActive = false;
  idleSleepWakeLockedUntil = 0;
  const overlay = document.getElementById('sleep-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('idle-sleeping');
  duckSoundLoop('ambience', 1, 0.9);
  idleLastActivityTs = Date.now();
  scheduleIdleSleep();
}
function armIdleSleep() {
  if (idleSleepArmed) {
    noteIdleActivity('generic', true);
    return;
  }
  idleSleepArmed = true;

  document.addEventListener('pointerdown', () => noteIdleActivity('generic'), { passive: true });
  document.addEventListener('pointermove', () => noteIdleActivity('move'), { passive: true });
  document.addEventListener('wheel', () => noteIdleActivity('generic'), { passive: true });
  document.addEventListener('touchstart', () => noteIdleActivity('generic'), { passive: true });
  document.addEventListener('keydown', () => noteIdleActivity('generic'));

  const wakeAndSwallow = e => {
    if (!idleSleepActive) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (Date.now() < idleSleepWakeLockedUntil) return;
    wakeIdleSleep();
  };
  document.addEventListener('keydown', wakeAndSwallow, true);
  document.addEventListener('pointerdown', wakeAndSwallow, true);
  document.addEventListener('pointermove', wakeAndSwallow, true);
  document.addEventListener('touchstart', wakeAndSwallow, true);

  window.addEventListener('focus', () => {
    if (!idleSleepActive && Date.now() - idleLastActivityTs >= getIdleSleepMs()) enterIdleSleep();
    else noteIdleActivity('generic', true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || idleSleepActive) return;
    if (Date.now() - idleLastActivityTs >= getIdleSleepMs()) enterIdleSleep();
    else scheduleIdleSleep();
  });

  scheduleIdleSleep();
}

// ─────────────────────────────────────────────────────────────────
// START MENU
// ─────────────────────────────────────────────────────────────────
let startOpen = false;
function toggleStart() {
  startOpen = !startOpen;
  document.getElementById('start-menu').style.display = startOpen ? 'flex' : 'none';
  document.getElementById('start-btn').classList.toggle('pressed', startOpen);
}
function closeStart() { if (startOpen) toggleStart(); }
function handleOutsideStart(e) {
  if (startOpen && !e.target.closest('#start-menu') && e.target.id !== 'start-btn')
    closeStart();
}
document.addEventListener('mousedown', handleOutsideStart);
document.addEventListener('touchstart', handleOutsideStart, { passive: true });

// Uppercase stem, preserve extension case: "untitled.txt" → "UNTITLED.txt"
function iconLabel(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return name.toUpperCase();
  return name.slice(0, dot).toUpperCase() + name.slice(dot);
}

function resolveFsIcon(name, kind) {
  // The bin is the one icon with two states, so it is resolved here rather than
  // read out of SYSTEM_FILE_ICONS' static map. recycleBinEntries is declared in
  // fs-persist.js, which the bundle loads well before this ever runs.
  if (isRecycleBinItemName(name)) {
    return recycleBinEntries.length ? 'icon:recycle-full' : 'icon:recycle-empty';
  }
  if (kind === 'image') return 'icon:image';
  if (kind === 'video') return 'icon:video';
  if (kind === 'audio') return 'icon:audio';
  if (kind === 'dir') return 'icon:folder';
  const systemIcon = SYSTEM_FILE_ICONS[String(name).toUpperCase()];
  if (systemIcon) return systemIcon;
  const ext = (String(name || '').split('.').pop() || '').toLowerCase();
  return {
    exe:'icon:exe', script:'icon:script', txt:'icon:text', readme:'icon:text', md:'icon:text',
    json:'icon:script', js:'icon:script', ts:'icon:script', jsx:'icon:script', tsx:'icon:script',
    html:'icon:browser', htm:'icon:browser', css:'icon:script', py:'icon:script',
    tmp:'icon:void', log:'icon:text', csv:'icon:sysmon', core:'icon:daemon'
  }[ext] || 'icon:unknown';
}

function getDesktopFsIcons() {
  // vfsListSync returns [] for a missing directory, which is what the old
  // `if (!dir) return []` did, and it yields dirs, then text files, then blobs -
  // the same order the three legacy loops produced, so icon order is unchanged.
  //
  // The kinds do NOT map one to one. vfsListSync reports 'dir' / 'text' /
  // 'blob'; this function has always emitted 'dir' / 'file' / the blob's own
  // media kind, and resolveFsIcon above branches on 'image' / 'video' /
  // 'audio' / 'dir'. Passing 'blob' through would strip the icon off every
  // uploaded image, video and audio file on the desktop. The kind also lands in
  // the returned target, which the open path reads. So remap explicitly.
  const icons = vfsListSync('DESKTOP').map(entry => ({
    name: entry.name,
    kind: entry.kind === 'dir' ? 'dir'
        : entry.kind === 'text' ? 'file'
        : entry.blob?.kind || inferBlobKindFromName(entry.name),
  }));
  return icons.map(item => ({
    name: item.name,
    emoji: resolveFsIcon(item.name, item.kind),
    kind: item.kind,
    desktopEntry: true,
    target: {
      name: item.name,
      path: 'DESKTOP\\' + item.name,
      kind: item.kind === 'dir' ? 'dir' : 'file',
      sysfile: false,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────
// DESKTOP ICON GRID
// ─────────────────────────────────────────────────────────────────
const _mobileGrid  = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700;
const ICON_CELL_W  = _mobileGrid ? 104 : 86;
const ICON_CELL_H  = _mobileGrid ? 104 : 86;
const ICON_BOX_W   = _mobileGrid ? 96  : 80;
const ICON_BOX_H   = _mobileGrid ? 96  : 80;
const ICON_PAD_X   = 6;
const ICON_PAD_Y   = 6;
const ICON_POS_KEY = 'sleepOS-icon-positions';
let iconPositions  = {};   // { ic.name: { col, row, manual? } }

function iconGetGridMetrics() {
  const layer = document.getElementById('icons-layer');
  if (!layer) {
    return {
      cols: 1,
      rows: 1,
      stepX: 0,
      stepY: 0,
      padX: ICON_PAD_X,
      padY: ICON_PAD_Y,
    };
  }
  const availW = Math.max(ICON_BOX_W, layer.offsetWidth - ICON_PAD_X * 2);
  const availH = Math.max(ICON_BOX_H, layer.offsetHeight - ICON_PAD_Y * 2);
  const cols = Math.max(1, Math.floor((availW - ICON_BOX_W) / ICON_CELL_W) + 1);
  const rows = Math.max(1, Math.floor((availH - ICON_BOX_H) / ICON_CELL_H) + 1);
  return {
    cols,
    rows,
    stepX: cols > 1 ? (availW - ICON_BOX_W) / (cols - 1) : 0,
    stepY: rows > 1 ? (availH - ICON_BOX_H) / (rows - 1) : 0,
    padX: ICON_PAD_X,
    padY: ICON_PAD_Y,
  };
}

function iconGetGridSize() {
  const { cols, rows } = iconGetGridMetrics();
  return { cols, rows };
}

function iconCellToPixel(col, row) {
  const { stepX, stepY, padX, padY } = iconGetGridMetrics();
  return {
    left: Math.round(padX + col * stepX),
    top: Math.round(padY + row * stepY),
  };
}

function iconRecycleBinCell() {
  const { cols, rows } = iconGetGridSize();
  return { col: Math.max(0, cols - 1), row: Math.max(0, rows - 1) };
}

function iconPixelToCell(px, py) {
  const { cols, rows, stepX, stepY, padX, padY } = iconGetGridMetrics();
  return {
    col: Math.max(0, Math.min(cols - 1, stepX > 0 ? Math.round((px - padX) / stepX) : 0)),
    row: Math.max(0, Math.min(rows - 1, stepY > 0 ? Math.round((py - padY) / stepY) : 0)),
  };
}

function iconDefaultPositions(icons) {
  const { rows } = iconGetGridSize();
  const out = {};
  icons.forEach((ic, i) => { out[ic.name] = { col: Math.floor(i / rows), row: i % rows }; });
  return out;
}

function iconFindFreeCell(wantCol, wantRow, excludeName) {
  const { cols, rows } = iconGetGridSize();
  const clamp = (c, r) => ({ col: Math.max(0, Math.min(c, cols - 1)), row: Math.max(0, Math.min(r, rows - 1)) });
  const occ = new Set(
    Object.entries(iconPositions).filter(([k]) => k !== excludeName).map(([, p]) => p.col + ',' + p.row)
  );
  const start = clamp(wantCol, wantRow);
  const visited = new Set();
  const q = [start];
  let iter = 0;
  while (q.length && iter++ < cols * rows * 2) {
    const { col, row } = q.shift();
    const k = col + ',' + row;
    if (visited.has(k)) continue;
    visited.add(k);
    if (!occ.has(k)) return { col, row };
    for (const [dc, dr] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nc = col + dc, nr = row + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) q.push({ col: nc, row: nr });
    }
  }
  return start;
}

function saveIconPositions() {
  localStorage.setItem(ICON_POS_KEY, JSON.stringify(iconPositions));
}

function isDesktopBuiltInIcon(ic) {
  return !!ic && !ic.desktopEntry && !ic.custom && !ic.recycleBin;
}

function getDesktopFolderDropTarget(clientX, clientY, draggingIcons) {
  const draggingSet = new Set(Array.isArray(draggingIcons) ? draggingIcons : [draggingIcons].filter(Boolean));
  const folderEls = Array.from(document.querySelectorAll('#icons-layer .desktop-icon')).filter(el => {
    const targetIcon = el._ic;
    if (!targetIcon || draggingSet.has(targetIcon)) return false;
    return !!targetIcon.desktopEntry && targetIcon.kind === 'dir';
  });
  for (const el of folderEls) {
    const rect = el.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return el._ic;
    }
  }
  return null;
}

async function moveDesktopIconIntoFolder(icon, folderIcon) {
  if (!icon || !folderIcon?.desktopEntry || folderIcon.kind !== 'dir') return false;
  const dstDirPath = folderIcon.target.path;
  return await moveShellItemToDir(icon, 'DESKTOP', dstDirPath);
}

// ─────────────────────────────────────────────────────────────────
// DESKTOP ICONS
// ─────────────────────────────────────────────────────────────────
const desktopSel = new Set(); // Set of icon div elements currently selected

function clearDesktopSel() {
  desktopSel.forEach(d => d.classList.remove('selected'));
  desktopSel.clear();
}

function canDeleteDesktopSystemIcon(ic) {
  return !!ic && !ic.custom && String(ic.name || '').toLowerCase() === 'void.tmp' && !daemonStory.endingReached;
}

function deleteDesktopSystemIcons(icons) {
  const targets = (icons || []).filter(canDeleteDesktopSystemIcon);
  if (!targets.length) return;
  const prompt = targets.length === 1 ? 'Delete "' + targets[0].name + '"?' : 'Delete ' + targets.length + ' selected items?';
  osConfirm(prompt, 'Delete', async ok => {
    if (!ok) return;
    const blocked = [];
    let changed = false;
    for (const target of targets) {
      const result = await deleteVirtualPath(target.name);
      if (result.ok && result.deleted) changed = true;
      else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
    }
    if (blocked.length) osAlert(blocked[0], 'Delete', 'icon:warning');
    if (changed) clearDesktopSel();
  }, 'icon:recycle-full');
}

function canDeleteDesktopFsEntry(ic) {
  return !!ic?.desktopEntry && !!ic?.target?.path;
}

function deleteDesktopFsEntries(icons) {
  const targets = (icons || []).filter(canDeleteDesktopFsEntry);
  if (!targets.length) return;
  const prompt = targets.length === 1 ? 'Delete "' + targets[0].name + '"?' : 'Delete ' + targets.length + ' selected files?';
  osConfirm(prompt, 'Delete', async ok => {
    if (!ok) return;
    const blocked = [];
    let changed = false;
    for (const target of targets) {
      const result = await deleteVirtualPath(target.target.path);
      if (result.ok && result.deleted) changed = true;
      else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
    }
    if (blocked.length) osAlert(blocked[0], 'Delete', 'icon:warning');
    if (changed) {
      clearDesktopSel();
      document.dispatchEvent(new CustomEvent('fs-changed'));
    }
  }, 'icon:recycle-full');
}

async function recycleDesktopItemAtPath(path) {
  const result = await recycleVirtualPath(path);
  if (!result.ok) osAlert([result.message, ...(result.details || [])].filter(Boolean).join('\n'), 'Recycle Bin', 'icon:warning');
  return result;
}

function makeDesktopIconEl(ic) {
  const div = document.createElement('div');
  div.className = 'desktop-icon';
  const displayName = ic.name === '?????.exe' ? getExeDisplayName() : ic.name;
  // The bin is the one desktop icon whose art depends on live state, so it is
  // resolved per render instead of read off the static DESKTOP_ICONS entry.
  const icon = isRecycleBinItemName(ic.name) ? resolveFsIcon(ic.name) : ic.emoji;
  div.innerHTML = '<div class="di-img">' + iconMarkup(icon) + '</div><div class="di-name">' + escHtml(iconLabel(displayName)) + '</div>';
  div._ic = ic;
  function activate() {
    if (ic.action) window[ic.action]?.();
    else if (ic.target) openDesktopShortcutTarget(ic.target);
    else if (ic.openFn) ic.openFn();
  }
  let clicks = 0, clickT;
  function queueActivateClick() {
    clicks++;
    if (clicks === 1) {
      clickT = setTimeout(() => { clicks = 0; }, 380);
    } else {
      clearTimeout(clickT);
      clicks = 0;
      activate();
    }
  }
  div.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (e.button === 2) return; // let contextmenu handle right-clicks
    if (e.ctrlKey) {
      // Toggle this icon in the multi-selection
      if (desktopSel.has(div)) {
        div.classList.remove('selected');
        desktopSel.delete(div);
      } else {
        div.classList.add('selected');
        desktopSel.add(div);
      }
      clicks = 0;
      clearTimeout(clickT);
      return;
    }
    if (!desktopSel.has(div) || desktopSel.size <= 1) {
      clearDesktopSel();
      div.classList.add('selected');
      desktopSel.add(div);
    }

    // Drag-to-rearrange tracking
    const isMouse = e.pointerType === 'mouse';
    const dragThreshold = isMouse ? 5 : 12;
    const startClientX = e.clientX, startClientY = e.clientY;
    const layer   = document.getElementById('icons-layer');
    const lr      = layer.getBoundingClientRect();
    const draggedDivs = desktopSel.has(div) ? [...desktopSel] : [div];
    const dragStates = draggedDivs.map(el => {
      const rect = el.getBoundingClientRect();
      const iconState = el._ic;
      const currentPos = iconPositions[iconState.name];
      return {
        el,
        ic: iconState,
        startLeft: el.offsetLeft,
        startTop: el.offsetTop,
        offX: e.clientX - rect.left,
        offY: e.clientY - rect.top,
        startCell: currentPos
          ? { col: currentPos.col, row: currentPos.row }
          : iconPixelToCell(el.offsetLeft, el.offsetTop),
      };
    });
    const primaryState = dragStates.find(state => state.el === div) || dragStates[0];
    const draggedIcons = dragStates.map(state => state.ic);
    const draggedPayload = buildShellDragPayload(ic, 'DESKTOP', 'desktop', { items: draggedIcons });
    let dragging  = false;

    const onMove = mv => {
      if (!dragging) {
        if (Math.abs(mv.clientX - startClientX) > dragThreshold || Math.abs(mv.clientY - startClientY) > dragThreshold) {
          dragging = true;
          clicks = 0; clearTimeout(clickT);
          dragStates.forEach(state => {
            state.el.style.zIndex = '999';
            state.el.style.opacity = '0.75';
          });
        }
      }
      if (dragging) {
        mv.preventDefault();
        const dx = mv.clientX - startClientX;
        const dy = mv.clientY - startClientY;
        dragStates.forEach(state => {
          state.el.style.left = (state.startLeft + dx) + 'px';
          state.el.style.top  = (state.startTop + dy) + 'px';
        });
      }
    };
    // Async is safe here in a way it would not be inside a `drop` listener:
    // this is a pointerup, and nothing below depends on preventDefault or on
    // the event still propagating. The geometry is all read from `up`, whose
    // coordinates stay valid after the handler yields.
    const onUp = async up => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      dragStates.forEach(state => {
        state.el.style.zIndex = '';
        state.el.style.opacity = '';
      });
      if (dragging) {
        const recycleEl = document.querySelector('[data-icon-key="' + CSS.escape(RECYCLE_BIN_NAME) + '"]');
        const canRecycleDragged = draggedIcons.length && draggedIcons.every(canDeleteDesktopFsEntry);
        if (canRecycleDragged && recycleEl && !draggedDivs.includes(recycleEl)) {
          const rr = recycleEl.getBoundingClientRect();
          const overRecycleBin = up.clientX >= rr.left && up.clientX <= rr.right && up.clientY >= rr.top && up.clientY <= rr.bottom;
          if (overRecycleBin) {
            // `every` short-circuits on the first failure, so this keeps the
            // original semantics: stop recycling as soon as one is refused.
            let ok = true;
            for (const targetIcon of draggedIcons) {
              ok = (await recycleDesktopItemAtPath(targetIcon.target.path)).ok;
              if (!ok) break;
            }
            if (ok) {
              clearDesktopSel();
              return;
            }
          }
        }
        const folderTarget = getDesktopFolderDropTarget(up.clientX, up.clientY, draggedIcons);
        if (folderTarget && await moveShellPayloadToDir(draggedPayload, folderTarget.target.path)) {
          clearDesktopSel();
          return;
        }
        draggedDivs.forEach(stateEl => { stateEl.style.pointerEvents = 'none'; });
        const dropNode = document.elementFromPoint(up.clientX, up.clientY);
        draggedDivs.forEach(stateEl => { stateEl.style.pointerEvents = ''; });
        const explorerItemEl = dropNode?.closest?.('.exp-item,.exp-list-item,.exp-det-item');
        const explorerPaneEl = dropNode?.closest?.('.exp-body');
        const explorerDrop = explorerItemEl?._shellDropHandler || explorerPaneEl?._shellDropHandler;
        if (explorerDrop) {
          const ok = await explorerDrop(draggedPayload);
          if (ok) {
            clearDesktopSel();
            return;
          }
        }
        if (dropNode?.closest?.('.os-window')) {
          dragStates.forEach(state => {
            const { left, top } = iconCellToPixel(state.startCell.col, state.startCell.row);
            state.el.style.left = left + 'px';
            state.el.style.top = top + 'px';
          });
          return;
        }
        // snap based on icon top-left corner position (Windows-style)
        const iconLeft = up.clientX - lr.left - primaryState.offX;
        const iconTop  = up.clientY - lr.top  - primaryState.offY;
        const { col: wc, row: wr } = iconPixelToCell(iconLeft, iconTop);
        dragStates.forEach(state => { delete iconPositions[state.ic.name]; });
        dragStates
          .slice()
          .sort((a, b) => a.startCell.col - b.startCell.col || a.startCell.row - b.startCell.row)
          .forEach(state => {
            const wantCol = wc + (state.startCell.col - primaryState.startCell.col);
            const wantRow = wr + (state.startCell.row - primaryState.startCell.row);
            const { col, row } = iconFindFreeCell(wantCol, wantRow, state.ic.name);
            iconPositions[state.ic.name] = { col, row, manual: true };
            const { left, top } = iconCellToPixel(col, row);
            state.el.style.left = left + 'px';
            state.el.style.top  = top  + 'px';
          });
        saveIconPositions();
      } else {
        if (isMouse) {
          queueActivateClick();
        } else if (!_longPressActive) {
          activate();
        }
        _longPressActive = false;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  });
  addLongPress(div);
  div.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    // If right-clicking outside current selection, replace it
    if (!desktopSel.has(div)) {
      clearDesktopSel();
      div.classList.add('selected');
      desktopSel.add(div);
    }
    const selDivs = [...desktopSel];
    const selIcs  = selDivs.map(d => d._ic);
    const multi   = selDivs.length > 1;
    const canDeleteSystemFiles = selIcs.some(canDeleteDesktopSystemIcon);
    const canDeleteDesktopFiles = selIcs.some(canDeleteDesktopFsEntry);
    const singleDesktopImage = !multi && selIcs[0]?.desktopEntry && selIcs[0]?.kind === 'image' ? selIcs[0] : null;
    const items   = [];
    if (multi) {
      items.push({ label: 'Open All (' + selDivs.length + ')', action: () => selIcs.forEach(i => {
        if (i.action) window[i.action]?.();
        else if (i.target) openDesktopShortcutTarget(i.target);
        else if (i.openFn) i.openFn();
      })});
    } else {
      items.push({ label: 'Open', action: activate });
      // Lore / decompiler shortcuts for single icons
      const icName = ic.name || '';
      if (['daemon.core','void.tmp'].includes(icName)) {
        items.push({ label: 'Open in Notepad', action: () => openNotepad(icName) });
      }
      if (icName.toLowerCase().endsWith('.exe') && !['NOTEPAD.exe','TERMINAL.exe','SYSMON.exe','BROWSER.exe','DEFRAG.exe','CALC.exe','REGEDIT.exe','EXPLORER.exe'].includes(icName)) {
        items.push({ label: 'Open in Decompiler', action: () => openDecompilerView(icName) });
      }
      if (singleDesktopImage) {
        items.push({ label: 'Set as Wallpaper', action: () => applyWallpaper(singleDesktopImage.target.path) });
      }
    }
    if (canDeleteSystemFiles) {
      items.push('-');
      items.push({ label: multi ? 'Delete Deletable Items' : 'Delete', action: () => deleteDesktopSystemIcons(selIcs) });
    }
    if (canDeleteDesktopFiles) {
      items.push('-');
      items.push({ label: multi ? 'Delete Files' : 'Delete', action: () => deleteDesktopFsEntries(selIcs) });
    }
    if (!multi && ic.recycleBin) {
      items.push('-');
      items.push({ label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin() });
    }
    if (selIcs.some(i => i.custom)) {
      items.push('-');
      items.push({ label: multi ? 'Delete Selected' : 'Delete', action: () => {
        selDivs.forEach(d => {
          if (!d._ic.custom) return;
          const idx = customDesktopIcons.indexOf(d._ic);
          if (idx > -1) customDesktopIcons.splice(idx, 1);
          delete iconPositions[d._ic.name];
          d.remove();
        });
        desktopSel.clear();
        saveDesktopShortcuts();
        saveIconPositions();
        document.dispatchEvent(new CustomEvent('fs-changed'));
      }});
    }
    showCtxMenu(e.clientX, e.clientY, items);
  });
  if (ic.recycleBin || (ic.desktopEntry && ic.kind === 'dir')) {
    const dropDirPath = ic.recycleBin ? null : ic.target.path;
    const setDropOutline = on => { div.style.outline = on ? '1px dotted #fff' : ''; };
    div.addEventListener('dragover', e => {
      const payload = getShellDragPayload();
      if (!payload || shellDragIncludesItem(payload, ic)) return;
      const accepts = ic.recycleBin
        ? canRecycleShellPayload(payload)
        : canMoveShellPayloadToDir(payload, dropDirPath);
      if (!accepts) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropOutline(true);
    });
    div.addEventListener('dragleave', () => setDropOutline(false));
    div.addEventListener('drop', e => {
      const payload = getShellDragPayload();
      setDropOutline(false);
      if (!payload || shellDragIncludesItem(payload, ic)) return;
      // The accept decision has to be made synchronously. preventDefault and
      // stopPropagation are both no-ops once the handler has yielded - the
      // default action fires and the event finishes bubbling the moment the
      // listener returns at its first await - and a late clearShellDragPayload
      // would let another handler start a second move on the same items.
      // These are the same predicates the dragover handler above gates on.
      const accepts = ic.recycleBin
        ? canRecycleShellPayload(payload)
        : canMoveShellPayloadToDir(payload, dropDirPath);
      if (!accepts) return;
      e.preventDefault();
      e.stopPropagation();
      clearShellDragPayload();
      void (ic.recycleBin ? recycleShellPayload(payload) : moveShellPayloadToDir(payload, dropDirPath));
    });
  }
  return div;
}

function addDesktopShortcut(name, emoji, target, openFn, dirPath) {
  const ic = {
    name,
    emoji,
    target: target || null,
    openFn,
    custom: true,
    dirPath: normalizeDesktopContainerDir(dirPath || 'DESKTOP'),
  };
  customDesktopIcons.push(ic);
  saveDesktopShortcuts();
  if (ic.dirPath !== 'DESKTOP') {
    document.dispatchEvent(new CustomEvent('fs-changed'));
    return;
  }
  // Find a free cell (prefer column-first after existing icons)
  const allIcons = [...getVisibleDesktopIcons(), ...getDesktopFsIcons(), ...getDesktopShortcutsForDir('DESKTOP')];
  const defaults = iconDefaultPositions(allIcons);
  const { col: dc, row: dr } = defaults[ic.name] || { col: 0, row: 0 };
  const { col, row } = iconFindFreeCell(dc, dr, ic.name);
  iconPositions[ic.name] = { col, row };
  saveIconPositions();
  document.dispatchEvent(new CustomEvent('fs-changed'));
}

let _desktopInteractionsBound = false;
function setupIcons() {
  clearDesktopSel();
  const layer = document.getElementById('icons-layer');
  layer.innerHTML = '';

  const allIcons = [...getVisibleDesktopIcons(), ...getDesktopFsIcons(), ...getDesktopShortcutsForDir('DESKTOP')];
  const recycleIcon = allIcons.find(ic => ic.recycleBin);
  const saved    = (() => { try { return JSON.parse(localStorage.getItem(ICON_POS_KEY) || '{}'); } catch { return {}; } })();
  const defaults = iconDefaultPositions(allIcons.filter(ic => !ic.recycleBin));
  if (recycleIcon) defaults[recycleIcon.name] = iconRecycleBinCell();
  const hasSavedPosition = ic => {
    const entry = saved[ic.name];
    if (!entry || !Number.isFinite(entry.col) || !Number.isFinite(entry.row)) return false;
    return ic.recycleBin || !isDesktopBuiltInIcon(ic) || entry.manual === true;
  };
  const assignPosition = ic => {
    const isAutoRecycleBin = ic.recycleBin && saved[ic.name]?.manual !== true;
    const preferred = isAutoRecycleBin ? iconRecycleBinCell() : (hasSavedPosition(ic) ? saved[ic.name] : (defaults[ic.name] || { col: 0, row: 0 }));
    const { col, row } = iconFindFreeCell(preferred.col, preferred.row, ic.name);
    iconPositions[ic.name] = saved[ic.name]?.manual === true ? { col, row, manual: true } : { col, row };
  };
  iconPositions  = {};
  // Place non-recycle-bin icons first so the recycle bin can always claim the bottom-right cell
  const nonBinIcons = allIcons.filter(ic => !ic.recycleBin);
  nonBinIcons.filter(hasSavedPosition).forEach(assignPosition);
  nonBinIcons.filter(ic => !hasSavedPosition(ic)).forEach(assignPosition);
  if (recycleIcon) assignPosition(recycleIcon);
  saveIconPositions();

  allIcons.forEach(ic => {
    const el = makeDesktopIconEl(ic);
    el.setAttribute('data-icon-key', ic.name);
    el.style.position = 'absolute';
    const { left, top } = iconCellToPixel(iconPositions[ic.name].col, iconPositions[ic.name].row);
    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
    layer.appendChild(el);
  });

  if (_desktopInteractionsBound) return;
  _desktopInteractionsBound = true;

  // Rubber-band selection on empty desktop space
  layer.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.desktop-icon') || e.target.closest('.os-window')) return;
    if (!e.ctrlKey) clearDesktopSel();
    document.body.style.userSelect = 'none';
    // layer is position:fixed inset:0 so offsetLeft/Top of icons === clientX/Y coords
    const sx = e.clientX, sy = e.clientY;
    let didDrag = false;
    const selDiv = document.createElement('div');
    selDiv.className = 'sel-rect';
    selDiv.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:0;height:0;';
    layer.appendChild(selDiv);
    const onMove = mv => {
      didDrag = true;
      const cx = mv.clientX, cy = mv.clientY;
      const left = Math.min(sx, cx), top = Math.min(sy, cy);
      const w = Math.abs(cx - sx),   h   = Math.abs(cy - sy);
      selDiv.style.left = left + 'px'; selDiv.style.top  = top  + 'px';
      selDiv.style.width = w   + 'px'; selDiv.style.height = h  + 'px';
      const sr = { left, top, right: left + w, bottom: top + h };
      // icons are absolutely positioned in layer - offsetLeft/Top are in layer (= client) coords
      layer.querySelectorAll('.desktop-icon').forEach(el => {
        const elL = el.offsetLeft, elT = el.offsetTop;
        const elR = elL + el.offsetWidth, elB = elT + el.offsetHeight;
        const hit = sr.left < elR && sr.right > elL && sr.top < elB && sr.bottom > elT;
        if (hit) { desktopSel.add(el); el.classList.add('selected'); }
        else if (!e.ctrlKey) { desktopSel.delete(el); el.classList.remove('selected'); }
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      document.body.style.userSelect = '';
      selDiv.remove();
      // suppress the click that fires after mouseup so it doesn't clear selection
      if (didDrag) window.addEventListener('click', e2 => e2.stopPropagation(), { once: true, capture: true });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });

  layer.addEventListener('dragover', e => {
    if (e.target.closest('.desktop-icon')) return;
    const payload = getShellDragPayload();
    if (!payload || isDesktopSurfaceTransferBlocked(payload, 'DESKTOP') || !canMoveShellPayloadToDir(payload, 'DESKTOP')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  layer.addEventListener('drop', e => {
    if (e.target.closest('.desktop-icon')) return;
    const payload = getShellDragPayload();
    if (!payload || isDesktopSurfaceTransferBlocked(payload, 'DESKTOP') || !canMoveShellPayloadToDir(payload, 'DESKTOP')) return;
    e.preventDefault();
    e.stopPropagation();
    void moveShellPayloadToDir(payload, 'DESKTOP').then(ok => { if (ok) clearShellDragPayload(); });
  });

  // Desktop background right-click / long-press
  addLongPress(document.getElementById('desktop'));
  document.getElementById('desktop').addEventListener('contextmenu', e => {
    if (e.target.closest('.desktop-icon') || e.target.closest('.os-window')) return;
    e.preventDefault();
    clearDesktopSel();
    showCtxMenu(e.clientX, e.clientY, [
      { label: 'Open Terminal',    icon: 'icon:terminal', action: openTerminal },
      { label: 'Open Explorer',    icon: 'icon:explorer', action: openExplorer },
      { label: 'Open Notepad',     icon: 'icon:notepad',  action: openNotepad },
      { label: 'Open Browser',     icon: 'icon:browser',  action: openBrowser },
      '-',
      // No clipboard or upload art yet, so these two ride the gutter empty
      // rather than sitting flush left and breaking the column.
      { label: 'Paste', disabled: !_expClipboard, action: () => pasteClipboardInto('DESKTOP') },
      '-',
      { label: 'New Folder',       icon: 'icon:folder',   action: () => promptCreateFolderAt('DESKTOP') },
      { label: 'Upload File...',  icon: 'icon:upload',   action: () => triggerUpload('DESKTOP') },
      { label: 'Change Wallpaper', icon: 'icon:image',    action: openAppearance },
      '-',
      { label: 'Properties', icon: 'icon:info', action: () => osAlert('sleepOS v0.9β\nBuild: 2024.11.13-EXPERIMENTAL\nSOMATIC KERNEL 686', 'Properties', 'icon:info') },
    ]);
  });

  document.getElementById('desktop').addEventListener('click', e => {
    if (!e.target.closest('.desktop-icon') && !e.target.closest('.os-window'))
      clearDesktopSel();
  });
}

document.addEventListener('fs-changed', () => {
  if (typeof setupIcons === 'function') setupIcons();
});

// Reflow icons on orientation change (mobile)
window.addEventListener('orientationchange', () => {
  setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
});

// Reflow icons when window is resized
let _iconResizeTimer;
window.addEventListener('resize', () => {
  const desktop = document.getElementById('desktop');
  // The desktop is hidden by CSS during boot, not by an inline style, so
  // `desktop.style.display` is '' at that point. Checking the inline style
  // let this handler run over the BIOS screen. Use the computed value.
  if (!desktop || getComputedStyle(desktop).display === 'none') return;
  clearTimeout(_iconResizeTimer);
  _iconResizeTimer = setTimeout(() => {
    // Re-lay out through setupIcons rather than reflowing here. It honours
    // manually placed icons, recomputes defaults for the new grid size, and
    // places via iconFindFreeCell, which is bounded.
    //
    // This replaced a hand-rolled placement loop that could not terminate:
    // it clamped with `if (col >= cols) col = cols - 1` instead of advancing,
    // so once the last column filled it cycled the same occupied cells
    // forever. Shrinking the window below the icon count hung the page.
    if (typeof setupIcons === 'function') setupIcons();
  }, 150);
});

// ─────────────────────────────────────────────────────────────────
// WINDOW CONTENT
// ─────────────────────────────────────────────────────────────────

const WELCOME_DEFAULT =
`== sleepOS v0.9\u03b2 \u2014 WELCOME ==

You are running sleepOS, an experimental interactive desktop.

Programs:
  PROJECTS.DIR  \u2014 interactive apps (double-click to browse)
  NOTEPAD.exe   \u2014 text editor with syntax highlighting
  TERMINAL.exe  \u2014 command line (type HELP for commands)
  BROWSER.exe   \u2014 web browser
  SYSMON.exe    \u2014 system monitor
  DEFRAG.exe    \u2014 disk defragmenter
  CALC.exe      \u2014 calculator
  REGEDIT.exe   \u2014 registry editor

Files:
  Right-click the desktop or any folder to create
  files and folders, or upload from your machine.
  Everything persists within your session.

Shortcuts:
  Space + Tab     switch windows
  Ctrl + Alt + Q  session controls
  Esc             close menus and overlays

Known issues:
  [!] void.tmp cannot be read, deleted, or ignored
  [!] Something is watching this session`;

function openWelcome() { openNotepad('WELCOME.README', '', { initialContent: WELCOME_DEFAULT }); }
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function detectLang(fname) {
  if (!fname) return 'txt';
  const ext = (fname.split('.').pop() || '').toLowerCase();
  return { js:'js', mjs:'js', ts:'js', jsx:'js', tsx:'js',
           html:'html', htm:'html',
           css:'css', scss:'css',
           json:'json',
           md:'md', markdown:'md',
           py:'py',
           script:'script' }[ext] || 'txt';
}

const LANG_LABELS = { js:'JavaScript', html:'HTML', css:'CSS', json:'JSON', md:'Markdown', py:'Python', script:'.script', txt:'Plain Text' };

// Each rule: { re (global regex), cls (CSS class) }
const LANG_RULES = {
  js: [
    { re: /\/\*[\s\S]*?\*\//g,          cls: 'tok-cmt' },
    { re: /\/\/[^\n]*/g,                 cls: 'tok-cmt' },
    { re: /`(?:[^`\\]|\\.)*`/g,          cls: 'tok-str' },
    { re: /"(?:[^"\\]|\\.)*"/g,          cls: 'tok-str' },
    { re: /'(?:[^'\\]|\\.)*'/g,          cls: 'tok-str' },
    { re: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|this|class|extends|import|export|default|try|catch|finally|throw|async|await|true|false|null|undefined|void|static|get|set|from)\b/g, cls: 'tok-kw' },
    { re: /\b([A-Za-z_$][\w$]*)\s*(?=\()/g, cls: 'tok-fn' },
    { re: /\b0x[\da-fA-F]+|\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, cls: 'tok-num' },
  ],
  html: [
    { re: /<!--[\s\S]*?-->/g,            cls: 'tok-cmt' },
    { re: new RegExp("\"(?:[^\"\\\\]|\\\\.)*\"", "g"), cls: 'tok-str' },
    { re: new RegExp("'(?:[^'\\\\]|\\\\.)*'", "g"), cls: 'tok-str' },
    { re: /\b[a-zA-Z-]+=(?=["'])/g,     cls: 'tok-att' },
    { re: /<\/?[A-Za-z][A-Za-z0-9]*|>/g, cls: 'tok-tag' },
  ],
  css: [
    { re: /\/\*[\s\S]*?\*\//g,           cls: 'tok-cmt' },
    { re: /"[^"]*"|'[^']*'/g,            cls: 'tok-str' },
    { re: /#[0-9a-fA-F]{3,8}\b/g,        cls: 'tok-num' },
    { re: /\b\d+(\.\d+)?(px|em|rem|%|vh|vw|vmin|vmax|pt|cm|mm|s|ms|deg|fr)?\b/g, cls: 'tok-num' },
    { re: /[.#:[\]A-Za-z*][^{;]*(?=\{)/g, cls: 'tok-fn' },
    { re: /[\w-]+(?=\s*:)/g,             cls: 'tok-kw' },
  ],
  json: [
    { re: /"(?:[^"\\]|\\.)*"\s*(?=:)/g,  cls: 'tok-att' },
    { re: /"(?:[^"\\]|\\.)*"/g,           cls: 'tok-str' },
    { re: /\b(true|false|null)\b/g,       cls: 'tok-kw' },
    { re: /-?\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, cls: 'tok-num' },
  ],
  md: [
    { re: /^#{1,6} .+/gm,               cls: 'tok-hdr' },
    { re: /`[^`]+`/g,                    cls: 'tok-cmt' },
    { re: /\*\*[^*\n]+\*\*|__[^_\n]+__/g, cls: 'tok-kw' },
    { re: /\*[^*\n]+\*|_[^_\n]+_/g,     cls: 'tok-str' },
    { re: /^\s*[-*+] /gm,               cls: 'tok-fn' },
    { re: /\[[^\]]+\]\([^)]+\)/g,        cls: 'tok-fn' },
  ],
  py: [
    { re: /"""[\s\S]*?"""|'''[\s\S]*?'''/g, cls: 'tok-str' },
    { re: /#[^\n]*/g,                    cls: 'tok-cmt' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, cls: 'tok-str' },
    { re: /\b(def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|try|except|finally|raise|with|lambda|pass|break|continue|yield|True|False|None|global|nonlocal|del|assert|async|await)\b/g, cls: 'tok-kw' },
    { re: /\b([A-Za-z_]\w*)\s*(?=\()/g, cls: 'tok-fn' },
    { re: /\b\d+(\.\d+)?\b/g,           cls: 'tok-num' },
  ],
  script: [
    { re: /#[^\n]*/g,                    cls: 'tok-cmt' },
    { re: /\/\/[^\n]*/g,                 cls: 'tok-cmt' },
    { re: /^\s*:[A-Za-z_][\w.-]*/gm,     cls: 'tok-fn' },
    { re: /\b(print|echo|set|input|wait|inc|dec|add|sub|mul|div|mod|clear|touch|mkdir|del|rm|open|notepad|start|run|goto|if|not|exists|defined|call|return|exit|grep)\b/gi, cls: 'tok-kw' },
    { re: /==|!=|>=|<=|>|</g,            cls: 'tok-att' },
    { re: /\[(red|green|yellow|cyan|blue|white)\]/gi, cls: 'tok-fn' },
    { re: /\$\w+/g,                      cls: 'tok-var' },
    { re: /\b\d+\b/g,                    cls: 'tok-num' },
  ],
  txt: [],
};

function highlight(text, lang) {
  const rules = LANG_RULES[lang] || [];
  if (!rules.length) return escHtml(text);

  // Collect all non-overlapping token intervals
  const intervals = [];
  for (let ri = 0; ri < rules.length; ri++) {
    const { re, cls } = rules[ri];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      intervals.push({ start: m.index, end: m.index + m[0].length, cls, ri });
    }
  }
  // Sort by start; ties broken by rule order (lower ri = higher priority)
  intervals.sort((a, b) => a.start !== b.start ? a.start - b.start : a.ri - b.ri);

  // Sweep: drop intervals that overlap an already-chosen one
  const chosen = [];
  let coveredTo = 0;
  for (const iv of intervals) {
    if (iv.start >= coveredTo) { chosen.push(iv); coveredTo = iv.end; }
  }

  let result = '';
  let cur = 0;
  for (const iv of chosen) {
    if (iv.start > cur) result += escHtml(text.slice(cur, iv.start));
    result += `<span class="${iv.cls}">${escHtml(text.slice(iv.start, iv.end))}</span>`;
    cur = iv.end;
  }
  if (cur < text.length) result += escHtml(text.slice(cur));
  return result;
}

// Notepad counter for unique window IDs
let _notepadCount = 0;

function openDecompilerView(filename) {
  const id = 'decompile-' + filename.replace(/\W/g,'_');
  if (!mkWin({ id, title: filename + ' \u2014 Decompiler View', icon: 'icon:exe', w:500, h:360 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  const content = getExeDecompilerContent(filename);

  // Read-only display with syntax highlighting (asm-like)
  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;overflow:auto;background:#fff;padding:8px;font-family:var(--sleep-font);font-size:11px;line-height:1.7;white-space:pre;';

  // Basic asm-style syntax coloring
  function highlightAsm(text) {
    return text.split('\n').map(line => {
      const esc = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (esc.trimStart().startsWith(';')) return '<span style="color:#6a9955;font-style:italic;">' + esc + '</span>';
      const opcodes = /\b(PUSH|CALL|MOV|CMP|JE|JZ|JNE|JNZ|JLE|JL|JG|JGE|JMP|TEST|SUB|ADD|AND|OR|XOR|LEA|RET|NOP|HLT)\b/g;
      const colored = esc.replace(opcodes, m => '<span style="color:#0000cc;font-weight:bold;">' + m + '</span>');
      return colored.replace(/\b(0x[0-9A-Fa-f]+)\b/g, '<span style="color:#098658;">$1</span>')
                    .replace(/\b(DD|DB|DQ|DW|RESB|RESW|RESD|dup)\b/g, '<span style="color:#dd4400;">$1</span>');
    }).join('\n');
  }

  wrap.innerHTML = highlightAsm(content);
  body.appendChild(wrap);

  if (ws) ws.textContent = filename + '  \u2014  Read-only  |  Decompiler View';

  if (mb) {
    const fileSpan = document.createElement('span');
    fileSpan.className = 'menu-item'; fileSpan.textContent = 'File';
    fileSpan.addEventListener('click', e => {
      e.stopPropagation();
      showDropdown(fileSpan, [
        { label: 'Close', action: () => closeWin(id) },
      ]);
    });
    mb.appendChild(fileSpan);
    const viewSpan = document.createElement('span');
    viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
    viewSpan.addEventListener('click', e => {
      e.stopPropagation();
      showDropdown(viewSpan, [
        { label: 'Copy All', action: () => navigator.clipboard?.writeText(content) },
      ]);
    });
    mb.appendChild(viewSpan);
  }
}

function openLoreNotepad(filename, content, title, icon) {
  const id = 'lore-' + (filename || '').replace(/\W/g,'_');
  if (!mkWin({ id, title: title + ' \u2014 Notepad', icon: icon || 'icon:notepad', w:440, h:320, menubar:false, statusbar:false })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;';
  const pre = document.createElement('pre');
  pre.style.cssText = 'background:#fff;padding:8px;margin:0;height:100%;overflow:auto;font-family:var(--sleep-font);font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;';
  pre.textContent = content;
  body.appendChild(pre);
}

function runScriptInPopup(name, source, dirName) {
  const id = 'script-out-' + Date.now();
  if (!mkWin({ id, title: name + ' - Script Output', icon: 'icon:script', w: 420, h: 280, menubar: false, statusbar: false, popup: true })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'background:#000;padding:6px;overflow:auto;font-family: var(--sleep-font);font-size:12px;color:#ccc;';
  const print = (text, color) => {
    const div = document.createElement('div');
    div.textContent = text || '\u00a0';
    if (color) div.style.color = color;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  };
  print('Running ' + name + '...', '#888');
  print('');
  execScript(source, print, { fs: makeVfsScriptFs(), sourceName: name, dirName, clearFn: () => { body.innerHTML = ''; } })
    .then(code => { if (code !== 0) print('Exit code: ' + code, '#dddd00'); });
}

function quoteTerminalArg(text) {
  const value = String(text ?? '');
  if (!value) return '""';
  if (!/[\s"]/.test(value)) return value;
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function runScriptInTerminal(name, dirName, args) {
  const items = [quoteTerminalArg(name), ...(Array.isArray(args) ? args.map(quoteTerminalArg) : [])];
  openTerminal(dirName || '', 'RUN ' + items.join(' '));
}

function openSaveDialog(defaultName, callback) {
  const id = 'saveas-' + Date.now();
  if (!mkWin({ id, title: 'Save As', icon: 'icon:notepad', w: 420, h: 310, menubar: false, statusbar: false, popup: true })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:6px;font-size:11px;overflow:hidden;';

  let saveCwd = '';

  // ── "Save in:" bar ────────────────────────────────────────────
  const locRow = document.createElement('div');
  locRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
  const locLabel = document.createElement('span');
  locLabel.textContent = 'Save in:'; locLabel.style.whiteSpace = 'nowrap';
  const locDisp = document.createElement('div');
  locDisp.style.cssText = 'flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;background:#fff;padding:1px 4px;font-family: var(--sleep-font);font-size:11px;';
  locRow.appendChild(locLabel); locRow.appendChild(locDisp);
  body.appendChild(locRow);

  // ── File list ────────────────────────────────────────────────
  const fileList = document.createElement('div');
  fileList.style.cssText = 'flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;background:#fff;overflow:auto;padding:4px;display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start;min-height:0;';
  body.appendChild(fileList);

  // ── File name row ────────────────────────────────────────────
  const nameRow = document.createElement('div');
  nameRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
  const nameLabel = document.createElement('span');
  nameLabel.textContent = 'File name:'; nameLabel.style.whiteSpace = 'nowrap';
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.value = defaultName;
  nameInput.style.cssText = 'flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;padding:1px 4px;font-family: var(--sleep-font);font-size:11px;background:#fff;';
  nameRow.appendChild(nameLabel); nameRow.appendChild(nameInput);
  body.appendChild(nameRow);

  // ── Buttons ──────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;flex-shrink:0;';
  const saveBtn   = document.createElement('button'); saveBtn.className = 'dlg-btn primary'; saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'dlg-btn';        cancelBtn.textContent = 'Cancel';
  btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
  body.appendChild(btnRow);

  function makeFLItem(icon, label) {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:68px;padding:3px;cursor:default;border:1px solid transparent;font-size:10px;text-align:center;word-break:break-word;';
    el.innerHTML = `<div class="fl-icon">${iconMarkup(icon)}</div><span>${escHtml(label)}</span>`;
    el.addEventListener('mouseover', () => { el.style.background='#000080'; el.style.color='#fff'; });
    el.addEventListener('mouseout',  () => { el.style.background='';        el.style.color=''; });
    return el;
  }

  function renderSaveList() {
    fileList.innerHTML = '';
    locDisp.textContent = saveCwd ? `C:\\sleepOS\\${saveCwd}` : 'C:\\sleepOS';

    if (saveCwd) {
      const up = makeFLItem('icon:folder', '..');
      up.addEventListener('dblclick', () => { saveCwd = ''; renderSaveList(); });
      fileList.appendChild(up);
    }

    // vfsListSync is synchronous metadata, so this render loop never awaits.
    // It reports dirs first, then text files, then blobs; the dialog offers
    // only text files to save over, exactly as the old dir.files walk did.
    const entries = vfsListSync(saveCwd);
    const listedDirs = entries.filter(e => e.kind === 'dir').map(e => e.name);
    const dirs = saveCwd ? listedDirs
                         : ['DOCS', ...listedDirs].filter((v, i, a) => a.indexOf(v) === i);
    dirs.forEach(d => {
      const el = makeFLItem('icon:folder', d);
      el.addEventListener('dblclick', () => { saveCwd = d; renderSaveList(); });
      fileList.appendChild(el);
    });

    entries.filter(e => e.kind === 'text').forEach(({ name }) => {
      // resolveFsIcon already owns the extension table; this dialog used to
      // keep a second, smaller copy of it that drifted from the real one.
      const el = makeFLItem(resolveFsIcon(name, 'file'), name);
      el.addEventListener('click', () => { nameInput.value = name; });
      el.addEventListener('dblclick', () => { nameInput.value = name; saveBtn.click(); });
      fileList.appendChild(el);
    });
  }

  saveBtn.addEventListener('click', () => {
    const fname = nameInput.value.trim();
    if (!fname) return;
    closeWin(id);
    callback(fname, saveCwd);
  });
  cancelBtn.addEventListener('click', () => closeWin(id));
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  renderSaveList();
  procSetTimeout(id, () => { nameInput.focus(); nameInput.select(); }, 50);
}

// Lore-ified pseudo-bytecode for .exe decompiler view
function getExeDecompilerContent(fname) {
  const name = (fname || '').toLowerCase();
  const base = fname.replace(/\.exe$/i,'').toUpperCase();
  const loreMap = {
    'terminal.exe': [
      '; TERMINAL.exe - Disassembly v1.0',
      'section .text',
      '  PUSH soul_daemon',
      '  CALL obsv.sys',
      '  MOV  eax, [STDIN_HANDLE]',
      '  CMP  eax, 0x00000000',
      '  JE   void_fallback',
      '  CALL parse_command',
      '  JMP  main_loop',
      'void_fallback:',
      '  MOV  [VOID_PRESSURE], 0xFF',
      '  RET',
      '; NOTE: 3 subroutines unresolved',
      '; CALL 0xDEAD???? - target unknown',
    ],
    'sysmon.exe': [
      '; SYSMON.exe - Disassembly',
      'section .data',
      '  soul_integrity  DD 0x57',
      '  daemon_count    DD 0x07',
      '  observer_ref    DD [CLASSIFIED]',
      'section .text',
      '  PUSH soul_integrity',
      '  CALL read_corpus_metrics',
      '  MOV  eax, [soul_integrity]',
      '  SUB  eax, 0x01',
      '  JLE  integrity_critical',
      '  CALL update_display',
      '  JMP  tick_loop',
      'integrity_critical:',
      '  CALL emit_warning',
      '  PUSH 0xDEAD',
      '  RET',
    ],
    'browser.exe': [
      '; BROWSER.exe - Disassembly',
      'section .rodata',
      '  home_url  DB "sleep://home", 0',
      '  err_msg   DB "site blocked by void", 0',
      'section .text',
      '  MOV  esi, home_url',
      '  CALL resolve_sleep_addr',
      '  TEST eax, eax',
      '  JZ   frame_blocked',
      '  CALL render_page',
      '  JMP  event_loop',
      'frame_blocked:',
      '  PUSH err_msg',
      '  CALL show_error',
      '  ; observer may intercept traffic here',
      '  RET',
    ],
    'defrag.exe': [
      '; DEFRAG.exe - Disassembly',
      'section .bss',
      '  corpus_blocks RESB 640',
      '  void_fragment DB [CANNOT RESOLVE]',
      'section .text',
      '  MOV  ecx, 0x280',
      '  LEA  edi, [corpus_blocks]',
      '  CALL scan_fragments',
      '  MOV  eax, [void_fragment]',
      '  CMP  eax, 0x00',
      '  JNE  skip_void',
      '  ; void_fragment cannot be moved',
      '  ; it has always been here',
      'skip_void:',
      '  CALL compact_corpus',
      '  JMP  defrag_loop',
    ],
    'notepad.exe': [
      '; NOTEPAD.exe - Disassembly',
      'section .data',
      '  welcome_readme DB "WELCOME.README", 0',
      '  null_text      DD 0x00',
      'section .text',
      '  MOV  esi, welcome_readme',
      '  CALL fs_open_read',
      '  TEST eax, eax',
      '  JZ   open_blank',
      '  CALL load_text_buffer',
      '  JMP  editor_loop',
      'open_blank:',
      '  MOV  [text_buffer], null_text',
      '  CALL init_editor',
      '  RET',
    ],
    'explorer.exe': [
      '; EXPLORER.exe - Disassembly',
      'section .data',
      '  root_path DB "C:\\sleepOS\\", 0',
      '  sys_files DD 9',
      'section .text',
      '  PUSH root_path',
      '  CALL enumerate_fs',
      '  MOV  ecx, sys_files',
      '  CALL add_system_entries',
      '  ; 1 entry cannot be enumerated',
      '  ; see: ?????.exe',
      '  CALL render_icon_grid',
      '  JMP  window_loop',
    ],
    'calc.exe': [
      '; CALC.exe - Disassembly',
      'section .data',
      '  display_buf DB 32 dup(0)',
      '  soul_pi     DQ 3.14159265358979',
      'section .text',
      '  MOV  eax, 0x00',
      '  MOV  [accumulator], eax',
      '  CALL init_display',
      '  JMP  calc_loop',
      'calc_loop:',
      '  CALL wait_keypress',
      '  CALL eval_operation',
      '  PUSH [accumulator]',
      '  CALL update_display',
      '  JMP  calc_loop',
      '; NOTE: division by zero returns VOID',
    ],
    'regedit.exe': [
      '; REGEDIT.exe - Disassembly',
      'section .data',
      '  hive_root DB "HKEY_SLEEPBOX_MACHINE", 0',
      '  soul_key  DB "SOUL\\Metrics", 0',
      'section .text',
      '  PUSH hive_root',
      '  CALL open_registry_hive',
      '  MOV  esi, soul_key',
      '  CALL reg_open_key',
      '  CALL enumerate_values',
      '  ; WARNING: OBSERVER_COUNT is classified',
      '  ; ACCESS DENIED for key VOID\\',
      '  CALL render_tree',
      '  JMP  edit_loop',
    ],
  };
  const specific = loreMap[name];
  if (specific) return specific.join('\n');
  return [
    '; ' + base + ' - Disassembly',
    '; File type: WIN32 PE (sleepOS compatible)',
    '',
    'section .data',
    '  entry_point DD 0x' + Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0'),
    '  build_stamp DD 0x' + Math.floor(Math.random()*0xFFFFFFFF).toString(16).toUpperCase().padStart(8,'0'),
    '',
    'section .text',
    '  PUSH soul_daemon',
    '  CALL obsv.sys',
    '  MOV  eax, [entry_point]',
    '  CALL eax',
    '  CMP  eax, 0',
    '  JNZ  execution_error',
    '  RET',
    'execution_error:',
    '  PUSH 0xDEADC0DE',
    '  CALL void_handler',
    '  JMP  0x0000',
    '',
    '; [decompiler: 1 function unresolved]',
  ].join('\n');
}

// Lore content for daemon.core and void.tmp
const DAEMON_CORE_CONTENT =
`[DAEMON CORE - raw read attempt]

This file is being written.
It is always being written.

Fragment recovered at offset 0x0000:
  owner    : SYSTEM\\???
  type     : persistent observer
  priority : ABOVE_KERNEL
  started  : before system boot
  status   : ACTIVE

Fragment recovered at offset 0x00FF:
  watching : all active processes
  watching : all inactive processes
  watching : this file

Fragment recovered at offset 0x01FE:
  [UNREADABLE - data still being written]
  [UNREADABLE - data still being written]
  [UNREADABLE - data still being written]

Do not attempt to modify this file.
You cannot. It is already modified.
`;

function getVoidTmpContent() {
  return buildVoidTmpRawContent();
}

// The live Notepad window editing `pathKey`, or null. Reads `wins` directly so
// a closed window can never leave a stale entry behind, and matches
// case-insensitively because sleepOS paths are case-insensitive everywhere else.
function findNotepadWindowFor(pathKey) {
  const key = String(pathKey).toUpperCase();
  return Object.keys(wins).find(id =>
    wins[id].notepadPath && String(wins[id].notepadPath).toUpperCase() === key) || null;
}

function openNotepad(filename, dirName, options) {
  options = options || {};
  const splitInfo = fsSplitPath(filename, dirName);
  const fullPathUpper = ((splitInfo.dirName ? splitInfo.dirName + '\\' : '') + splitInfo.fileName).toUpperCase();
  // Special handling for .exe files - decompiler view (read-only)
  const normalizedName = (filename || '').toLowerCase();
  const isExe = normalizedName.endsWith('.exe');
  const isDaemonCore = normalizedName === 'daemon.core';
  const isVoidTmp = normalizedName === 'void.tmp';

  if (isExe && filename) {
    return openDecompilerView(filename);
  }
  if (isDaemonCore) {
    daemonActivate('raw');
    return openLoreNotepad(filename, buildDaemonCoreRawContent(), 'daemon.core - [RAW READ]', 'icon:daemon');
  }
  if (isVoidTmp) {
    daemonRecordInvestigation('void');
    return openLoreNotepad(filename, getVoidTmpContent(), 'void.tmp - [OBSERVATION]', 'icon:void');
  }

  // vfsStatSync is metadata only, so the story checks and the window can all be
  // decided synchronously. Note the `type === 'file'` test: fsGetEntry returned
  // null for a directory, while vfsStatSync returns a stat for one, so without
  // it a directory whose uppercased name collides with a story path would fire
  // the investigation beat.
  const st = filename ? vfsStatSync(filename, dirName) : null;
  const isFile = !!st && st.type === 'file';
  if (isFile && fullPathUpper === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
  if (isFile && fullPathUpper === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
  const { dirName: initialDir, fileName } = splitInfo;
  const pathKey = filename ? ((initialDir ? initialDir + '\\' : '') + fileName) : String(++_notepadCount);
  // Which file a window is editing lives on the window record, not in its id.
  // The id is baked from the path at open time and cannot follow a Save As, so
  // matching on it meant reopening the original file focused the window that
  // had moved on to the new one, and opening the new file - whose id was still
  // free - built a SECOND editor on it. Two windows on one file is a silent
  // data-loss path: whichever saves last discards the other's edits.
  const existingId = filename ? findNotepadWindowFor(pathKey) : null;
  if (existingId) { focusWin(existingId); unminWin(existingId); return; }
  // Suffix rather than bail out when the natural id is taken by a window that
  // has been saved to a different name; mkWin dedupes on id and would return
  // null, leaving the file unopenable.
  let id = 'notepad-' + pathKey.replace(/\W/g,'_');
  while (wins[id]) id += '_';
  const displayName = fileName || 'untitled.txt';
  const hasInitialContent = Object.prototype.hasOwnProperty.call(options, 'initialContent');
  // `initial` starts empty for a stored text file and is filled in below when
  // the async read resolves. openNotepad stays SYNCHRONOUS: it has 22 call
  // sites - dispatch tables, menu actions, an inline HTML onclick - that are
  // bare function references and cannot await. This mirrors what the binary
  // branch further down has always done.
  const initial = hasInitialContent ? String(options.initialContent ?? '') : '';
  if (!mkWin({ id, title: displayName + ' \u2014 Notepad', icon: 'icon:notepad', w:500, h:360 })) return;
  // Untitled documents stay null so they never match a stored file.
  wins[id].notepadPath = filename ? pathKey : null;

  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  // ── editor container (highlight div + textarea overlay) ──────
  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';

  const hl = document.createElement('div');
  hl.className = 'editor-highlight';

  const ta = document.createElement('textarea');
  ta.className = 'note-textarea';
  ta.value = initial;
  ta.spellcheck = false;

  wrap.appendChild(hl);
  wrap.appendChild(ta);
  body.appendChild(wrap);

  let currentFile = fileName || null;
  let currentDir = currentFile ? initialDir : fsNormalizeDir(dirName);
  let lang = detectLang(fileName || filename);

  function renderHighlight() {
    hl.innerHTML = highlight(ta.value, lang) + '\n'; // trailing \n keeps last-line height correct
    syncScroll();
  }
  function syncScroll() {
    hl.scrollTop  = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
  }

  renderHighlight();

  const lineCount = () => ta.value.split('\n').length;

  // Set when a binary file's bytes could not be read, so the status bar can say
  // why instead of leaving an unexplained empty document.
  let binaryReadError = '';

  const updateStatus = () => {
    if (!ws) return;
    const fname = currentFile || 'untitled.txt';
    if (binaryReadError) { ws.textContent = `${fname}  -  ${binaryReadError}`; return; }
    ws.textContent = `${fname}  -  Ln ${lineCount()}  |  ${ta.value.length} bytes  |  ${LANG_LABELS[lang] || lang}`;
  };

  // Text content is async now, so the window is already on screen and the
  // textarea fills a microtask later. Imperceptible while the tree is in
  // memory, and still correct when phase 4 moves content to IndexedDB.
  if (st && st.kind === 'text' && !hasInitialContent) {
    // Read from the stat's own resolved directory and name rather than
    // re-splitting the raw arguments, so the read cannot land anywhere other
    // than the entry the stat found.
    vfsReadFile(st.name, st.dirName).then(text => {
      if (!wins[id]) return;
      if (text == null) return;
      ta.value = text;
      renderHighlight();
      updateStatus();
    }).catch(err => { reportVfsError(err); });
  }

  // Opening a binary file in Notepad shows its bytes as ANSI mojibake, the way
  // Windows does, instead of a blank document. Reading a blob is async, so the
  // window opens first and fills in. Saving over it is refused by
  // vfsWriteFile, which throws EEXIST, so the file cannot be damaged from here.
  if (st && st.kind === 'blob' && !hasInitialContent) {
    readBlobAsAnsiText(st.blob).then(result => {
      if (!wins[id]) return;
      if (result.error) { binaryReadError = result.error; updateStatus(); return; }
      ta.value = result.text;
      renderHighlight();
      updateStatus();
    });
  }

  ta.addEventListener('input', () => { renderHighlight(); updateStatus(); });
  ta.addEventListener('scroll', syncScroll);
  ta.addEventListener('dragover', e => e.preventDefault());
  ta.addEventListener('drop', e => {
    e.preventDefault();
    // Collect names from internal shell drag or external OS files
    const shellPayload = getShellDragPayload();
    let names = [];
    if (shellPayload?.items?.length) {
      names = shellPayload.items.map(i => i.name);
      clearShellDragPayload();
    } else if (e.dataTransfer?.files?.length) {
      names = [...e.dataTransfer.files].map(f => f.name);
    }
    if (!names.length) return;
    const insert = names.join(' ');
    const start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + insert.length;
    renderHighlight();
    updateStatus();
  });
  updateStatus();

  // ── IDE keybindings ──────────────────────────────────────────
  ta.addEventListener('keydown', e => {
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
      renderHighlight(); updateStatus();
    }
    // Enter → auto-indent (match leading whitespace of current line)
    if (e.key === 'Enter') {
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const indent = ta.value.slice(lineStart).match(/^[ \t]*/)[0];
      if (indent.length) {
        e.preventDefault();
        ta.value = ta.value.slice(0, s) + '\n' + indent + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 1 + indent.length;
        renderHighlight(); updateStatus();
      }
    }
    // Ctrl+S / Cmd+S → save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      currentFile ? save(currentFile) : promptSaveAs();
    }
    // Ctrl+/ → toggle line comment
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      const cmt = { js:'//', html:'<!--', css:'/*', py:'#', script:'#', md:'', txt:'', json:'' }[lang] || '//';
      if (!cmt) return;
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const lineEnd = ta.value.indexOf('\n', s);
      const line = ta.value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      const trimmed = line.trimStart();
      const prefix = line.slice(0, line.length - trimmed.length);
      let newLine;
      if (trimmed.startsWith(cmt)) newLine = prefix + trimmed.slice(cmt.length);
      else newLine = prefix + cmt + trimmed;
      ta.value = ta.value.slice(0, lineStart) + newLine + (lineEnd === -1 ? '' : ta.value.slice(lineEnd));
      ta.selectionStart = ta.selectionEnd = s + (newLine.length - line.length);
      renderHighlight(); updateStatus();
    }
  });

  // One implementation for Save and Save As. Both used to be near-duplicates,
  // which is how a try/catch gets added to one and forgotten on the other.
  // Returns true when the text is in the filesystem, false when the user has
  // been told it is not - fsWriteTextFile returned null on failure and every
  // caller ignored it, so a full disk silently ate the document.
  //
  // The title and status bar are updated ONLY on success. Reporting a saved
  // document that was never written is precisely the failure this phase exists
  // to kill.
  async function writeAndSync(fname, dir) {
    let saved;
    try {
      saved = await vfsWriteFile(fname, ta.value, dir || currentDir);
    } catch (err) {
      if (err.code === 'ENOSPC') {
        osAlert('Not enough space to save this file.\nDelete something and try again.', 'Disk Full', 'icon:error');
      } else if (err.code === 'EACCES') {
        osAlert('Storage is unavailable, so this file cannot be saved.', 'Cannot Save', 'icon:error');
      } else if (err.code === 'EEXIST') {
        osAlert('A binary file already uses that name.', 'Cannot Save', 'icon:error');
      } else {
        osAlert('Could not save: ' + err.message, 'Cannot Save', 'icon:error');
      }
      return false;
    }
    currentFile = saved.fileName;
    currentDir = saved.dirName;
    // Save As moves this window onto a different file. Repoint its identity so
    // the original file can be opened again and the new one resolves here
    // instead of getting a second editor.
    if (wins[id]) wins[id].notepadPath = (currentDir ? currentDir + '\\' : '') + currentFile;
    // re-detect lang if filename changed
    const newLang = detectLang(currentFile);
    if (newLang !== lang) { lang = newLang; renderHighlight(); }
    // Not just the titlebar span: the taskbar button, Alt+Tab, SYSMON and the
    // terminal's task list all kept showing the pre-Save-As name.
    setWinTitle(id, currentFile + ' \u2014 Notepad');
    updateStatus();
    return true;
  }

  // Every caller is a key handler or a menu action, none of which can await.
  // writeAndSync reports its own failures; this catch only stops an unexpected
  // throw from becoming an unhandled rejection.
  function save(fname, dir) {
    writeAndSync(fname, dir).catch(err => { reportVfsError(err); });
  }

  function promptSaveAs() {
    openSaveDialog(currentFile || 'untitled.txt', (fname, dir) => save(fname, dir));
  }

  function setLang(l) { lang = l; renderHighlight(); updateStatus(); }

  function buildMenu() {
    mb.innerHTML = '';
    [
      { label: 'File', items: [
        { label: 'New',           action: () => openNotepad() },
        '-',
        { label: 'Save  Ctrl+S', action: () => currentFile ? save(currentFile) : promptSaveAs() },
        { label: 'Save As\u2026', action: promptSaveAs },
        '-',
        { label: 'Close',         action: () => closeWin(id) },
      ]},
      { label: 'Edit', items: [
        { label: 'Select All',    action: () => { ta.focus(); ta.select(); } },
        '-',
        { label: 'Toggle Comment  Ctrl+/', action: () => ta.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{key:'/',ctrlKey:true,bubbles:true}))) },
      ]},
      { label: 'Language', items: Object.entries(LANG_LABELS).map(([k,v]) => ({
          label: (lang === k ? '\u2713 ' : '\u00a0\u00a0') + v,
          action: () => setLang(k),
        }))
      },
    ].forEach(({ label, items }) => {
      const span = document.createElement('span');
      span.className = 'menu-item'; span.textContent = label;
      span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items); });
      mb.appendChild(span);
    });
  }
  buildMenu();
  // Rebuild language menu when lang changes so checkmark updates
  const origSetLang = setLang;
  setLang = (l) => { origSetLang(l); buildMenu(); };

  ta.addEventListener('contextmenu', e => {
    e.preventDefault();
    const hasSel = ta.selectionStart !== ta.selectionEnd;
    showCtxMenu(e.clientX, e.clientY, [
      // No art for the clipboard verbs, and no other item here has an icon
      // either, so this menu stays text-only and keeps no gutter at all.
      { label: 'Cut',                 disabled: !hasSel, action: () => document.execCommand('cut') },
      { label: 'Copy',                disabled: !hasSel, action: () => document.execCommand('copy') },
      { label: 'Paste',               action: () => { ta.focus(); navigator.clipboard?.readText().then(t => document.execCommand('insertText', false, t)); } },
      '-',
      { label: 'Select All',          action: () => { ta.focus(); ta.select(); } },
      { label: 'Toggle Comment',      action: () => ta.dispatchEvent(Object.assign(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true }))) },
      '-',
      { label: 'Save  Ctrl+S',        action: () => currentFile ? save(currentFile) : promptSaveAs() },
      { label: 'Save As\u2026',       action: promptSaveAs },
    ]);
  });
}

function openExplorer(startPath) {
  const id = nextExplorerWinId();
  if (!mkWin({ id, title:'FILE EXPLORER \u2014 C:\\sleepOS', icon:'icon:explorer', w:560, h:400, x:110, y:65 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;display:flex;flex-direction:column;overflow:hidden;';

  let cwd = (startPath || '').toUpperCase();

  const toolbar = document.createElement('div');
  toolbar.className = 'exp-toolbar';
  const upBtn      = document.createElement('button'); upBtn.textContent = '\u2B06 Up';
  const refreshBtn = document.createElement('button'); refreshBtn.textContent = '\u21BB Refresh';
  const addrEl     = document.createElement('input'); addrEl.className = 'exp-addr';
  addrEl.title = 'Type a path and press Enter to navigate';
  addrEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = addrEl.value.trim();
      const normalized = fsNormalizeDir(raw);
      if (normalized === '') {
        cwd = '';
        render();
        addrEl.blur();
      } else if (normalized === 'PROJECTS' || vfsDirExistsSync(normalized)) {
        cwd = normalized;
        render();
        addrEl.blur();
      } else {
        addrEl.style.background = 'rgba(180,0,0,0.25)';
        procSetTimeout(id, () => { addrEl.style.background = ''; }, 600);
        const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
        addrEl.value = fullPath;
        addrEl.blur();
      }
    } else if (e.key === 'Escape') {
      const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
      addrEl.value = fullPath;
      addrEl.blur();
    }
  });
  addrEl.addEventListener('blur', () => {
    const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
    addrEl.value = fullPath;
  });
  addrEl.addEventListener('focus', () => addrEl.select());
  toolbar.appendChild(upBtn); toolbar.appendChild(refreshBtn); toolbar.appendChild(addrEl);
  body.appendChild(toolbar);

  const pane = document.createElement('div');
  pane.className = 'exp-body';
  pane.style.position = 'relative';
  body.appendChild(pane);

  // Rubber-band selection on empty pane space
  pane.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const ITEM_SEL = '.exp-item,.exp-list-item,.exp-det-item';
    if (e.target.closest(ITEM_SEL)) return;
    if (!e.ctrlKey) clearSelection();
    document.body.style.userSelect = 'none';
    const pr0  = pane.getBoundingClientRect();
    const st0  = pane.scrollTop;
    const sx   = e.clientX - pr0.left + st0;
    const sy   = e.clientY - pr0.top  + st0;
    let didDrag = false;
    const selDiv = document.createElement('div');
    selDiv.className = 'sel-rect';
    selDiv.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:0;height:0;';
    pane.appendChild(selDiv);
    const onMove = mv => {
      didDrag = true;
      const pr  = pane.getBoundingClientRect();
      const st  = pane.scrollTop;
      const cx  = mv.clientX - pr.left + st;
      const cy  = mv.clientY - pr.top  + st;
      const left = Math.min(sx, cx), top = Math.min(sy, cy);
      const w    = Math.abs(cx - sx),  h  = Math.abs(cy - sy);
      selDiv.style.left = left + 'px'; selDiv.style.top  = top  + 'px';
      selDiv.style.width = w   + 'px'; selDiv.style.height = h  + 'px';
      const sr = { left, top, right: left + w, bottom: top + h };
      let changed = false;
      pane.querySelectorAll(ITEM_SEL).forEach(el => {
        const key = el._selKey;
        if (!key) return;
        const er = el.getBoundingClientRect();
        const el_l = er.left   - pr.left + st;
        const el_t = er.top    - pr.top  + st;
        const el_r = er.right  - pr.left + st;
        const el_b = er.bottom - pr.top  + st;
        const hit = sr.left < el_r && sr.right > el_l && sr.top < el_b && sr.bottom > el_t;
        if (hit && !selectedKeys.has(key)) { selectedKeys.add(key); changed = true; }
        else if (!hit && !e.ctrlKey && selectedKeys.has(key)) { selectedKeys.delete(key); changed = true; }
      });
      if (changed) syncSelectionUi();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      document.body.style.userSelect = '';
      selDiv.remove();
      if (didDrag) window.addEventListener('click', e2 => e2.stopPropagation(), { once: true, capture: true });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });

  let selected = null;
  let viewMode = 'icons';
  let selectedKeys = new Set();
  let selectionItems = new Map();
  let selectionNodes = new Map();
  let emptyStatusText = '';

  async function doMoveItem(srcItem, srcCwd, dstDirPath) {
    return await moveShellItemToDir(srcItem, srcCwd, dstDirPath);
  }
  async function doRecycleItem(srcItem, srcCwd) {
    return await recycleShellItem(srcItem, srcCwd);
  }
  async function doMovePayload(payload, dstDirPath) {
    return await moveShellPayloadToDir(payload, dstDirPath);
  }
  async function doRecyclePayload(payload) {
    return await recycleShellPayload(payload);
  }
  function setExplorerStatus(text) {
    if (ws) ws.textContent = text;
  }
  const ITEM_SELECTOR = '.exp-item,.exp-list-item,.exp-det-item';

  function getIcon(name, kind) {
    return resolveFsIcon(name, kind);
  }

  function selectionKey(item) {
    const recyclePart = item._recycle?.id ? '|recycle|' + item._recycle.id : '';
    const shortcutPart = item._shortcut?.target?.path ? '|shortcut|' + normalizeShortcutPath(item._shortcut.target.path) : '';
    const projectPart = item._proj?.file ? '|project|' + item._proj.file : '';
    return (item.sysfile ? '1' : '0') + '|' + item.kind + '|' + item.name + recyclePart + shortcutPart + projectPart;
  }

  function registerSelectionNode(el, item) {
    const key = selectionKey(item);
    selectionItems.set(key, item);
    selectionNodes.set(key, el);
    el._selKey = key;
  }

  function getSelectedItems() {
    return Array.from(selectedKeys).map(key => selectionItems.get(key)).filter(Boolean);
  }

  function getSingleSelectedItem() {
    const items = getSelectedItems();
    return items.length === 1 ? items[0] : null;
  }

  function getDeletableSelectedItems() {
    if (cwd === 'RECYCLE') return getSelectedItems().filter(item => !!item._recycle);
    return getSelectedItems().filter(item => !item._proj && canAttemptDeleteItem(makeFsPath(item.name), cwd, item));
  }

  function makeFsPath(name) {
    return cwd ? cwd + '\\' + name : name;
  }

  function getSelectedNamesText() {
    return getSelectedItems().map(item => item.name).join('\n');
  }

  function getSelectedPathsText() {
    return getSelectedItems().map(item => {
      if (item._recycle) return 'C:\\sleepOS\\' + recycleEntryOriginalPath(item._recycle);
      return 'C:\\sleepOS\\' + (cwd ? cwd + '\\' : '') + item.name;
    }).join('\n');
  }

  function updateSelectionStatus() {
    if (!ws) return;
    const items = getSelectedItems();
    if (!items.length) {
      ws.textContent = emptyStatusText;
      return;
    }
    if (items.length === 1) {
      ws.textContent = items[0]._proj ? items[0].name + '  \u2014  double-click to open' : items[0].name;
      return;
    }
    ws.textContent = items.length + ' objects selected';
  }

  function syncSelectionUi() {
    selectionNodes.forEach((node, key) => node.classList.toggle('selected', selectedKeys.has(key)));
    const items = getSelectedItems();
    if (selected && !selectedKeys.has(selectionKey(selected))) selected = null;
    if (!selected && items.length) selected = items[items.length - 1];
    updateSelectionStatus();
  }

  function clearSelection() {
    selectedKeys = new Set();
    selected = null;
    syncSelectionUi();
  }

  function replaceSelection(item) {
    selectedKeys = new Set([selectionKey(item)]);
    selected = item;
    syncSelectionUi();
  }

  function toggleSelection(item) {
    const key = selectionKey(item);
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
      if (selected && selectionKey(selected) === key) selected = null;
    } else {
      next.add(key);
      selected = item;
    }
    selectedKeys = next;
    if (!selected && selectedKeys.size) {
      const items = getSelectedItems();
      selected = items[items.length - 1] || null;
    }
    syncSelectionUi();
  }

  function selectAllVisibleItems() {
    selectedKeys = new Set(selectionItems.keys());
    selected = getSelectedItems()[0] || null;
    syncSelectionUi();
  }

  function invertSelection() {
    const next = new Set();
    selectionItems.forEach((_, key) => {
      if (!selectedKeys.has(key)) next.add(key);
    });
    selectedKeys = next;
    selected = getSelectedItems()[0] || null;
    syncSelectionUi();
  }

  function ensureContextSelection(item) {
    const key = selectionKey(item);
    if (!selectedKeys.has(key) || selectedKeys.size <= 1) replaceSelection(item);
    else {
      selected = item;
      syncSelectionUi();
    }
  }

  function renameItem(item) {
    if (!item || item.sysfile || item._proj) return;
    osPrompt('Rename to:', item.name, 'Rename', async nextName => {
      if (!nextName || nextName === item.name) return;
      try {
        if (!(await vfsRename(cwd, item.name, nextName))) return;
      } catch (err) {
        osAlert(err.code === 'EEXIST' ? 'A file with that name already exists.' : err.message, 'Rename Failed', 'icon:error');
        return;
      }
      if (item.kind !== 'dir') {
        const st = vfsStatSync(nextName, cwd);
        if (st && st.kind === 'blob' && st.blob.kind === 'image') {
          handleWallpaperFileRename(cwd, item.name, nextName);
        }
      }
      // increaseDriveFragmentation retired with phase 4: fragmentation is now
      // measured from the real block layout, not nudged. A rename would have
      // been a fiction here regardless - fsRenameEntry only moves a dirent
      // key, never a block, so the disk's real layout is untouched, and the
      // rename's own queued op already triggers vfsBootMount's onCommit
      // handler, which calls fsRefreshFragmentation() after every commit.
      render();
    });
  }

  function getSelectedRecycleEntries() {
    return getSelectedItems().map(item => normalizeRecycleEntry(item._recycle)).filter(Boolean);
  }

  async function restoreSelectedRecycleEntries() {
    const entries = getSelectedRecycleEntries();
    if (!entries.length) return;
    const blocked = [];
    let restoredCount = 0;
    for (const entry of entries) {
      const result = await restoreRecycleEntry(entry);
      if (result.ok && result.restored) restoredCount++;
      else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
    }
    if (blocked.length) osAlert(blocked[0], 'Recycle Bin', 'icon:warning');
    if (restoredCount && ws) ws.textContent = restoredCount === 1 ? '1 item restored' : restoredCount + ' items restored';
    if (restoredCount || blocked.length) render();
  }

  function openItem(name, kind, sysfile) {
    const item = name && typeof name === 'object' ? name : { name, kind, sysfile };
    name = item.name;
    kind = item.kind;
    sysfile = item.sysfile;
    if (item._recycle) {
      // Fired and not awaited so openItem keeps its synchronous signature -
      // it is referenced from double-click, Enter and several dispatch tables.
      // render() runs when the restore lands, not before.
      void restoreRecycleEntry(item._recycle).then(result => {
        if (!result.ok) osAlert([result.message, ...(result.details || [])].filter(Boolean).join('\n'), 'Recycle Bin', 'icon:warning');
        else if (ws) ws.textContent = 'Restored: ' + result.name;
        render();
      });
      return;
    }
    if (isRecycleBinItemName(name)) {
      openRecycleBin();
      return;
    }
    if (item._shortcut) {
      openDesktopShortcutTarget(item._shortcut.target);
      return;
    }
    if (kind === 'dir') {
      cwd = makeFsPath(name);
      render();
      return;
    }
    if (cwd === 'PROJECTS') {
      const project = PROJECTS.find(p => p.name === name);
      if (project) {
        const url = /^https?:\/\//.test(project.file) ? project.file : 'https://' + project.file;
        window.open(url, '_blank');
      }
      return;
    }
    if (cwd === 'DESKTOP') {
      if (item._shortcut) {
        openDesktopShortcutTarget(item._shortcut.target);
        return;
      }
      if (sysfile) {
        openSystemFile(name);
        return;
      }
    }
    if (sysfile) {
      openSystemFile(name);
      return;
    }
    const st = vfsStatSync(name, cwd);
    if (!st || st.kind === 'dir') return;
    // Registry association first; falls through to the built-in defaults when
    // the extension is unassociated. See HKEY_CLASSES_ROOT in os/registry.js.
    if (openWithAssociation(name, cwd)) return;
    if (st.kind === 'blob') openMediaFile(name, cwd);
    else openNotepad(name, cwd);
  }

  function deleteSelected() {
    const items = getDeletableSelectedItems();
    if (!items.length) return;
    const recycleView = cwd === 'RECYCLE';
    const prompt = recycleView
      ? (items.length === 1 ? 'Permanently delete "' + items[0].name + '"?' : 'Permanently delete ' + items.length + ' selected items?')
      : (items.length === 1 ? 'Delete "' + items[0].name + '"?' : 'Delete ' + items.length + ' selected items?');
    osConfirm(prompt, recycleView ? 'Delete Permanently' : 'Delete', async ok => {
      if (!ok) return;
      const blocked = [];
      let changed = false;
      if (recycleView) {
        for (const item of items) {
          const result = await purgeRecycleEntry(item._recycle);
          if (result.ok && result.deleted) changed = true;
          else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
        }
        if (blocked.length) osAlert(blocked[0], 'Recycle Bin', 'icon:warning');
        if (changed && ws) ws.textContent = items.length === 1 ? '1 item deleted permanently' : items.length + ' items deleted permanently';
        if (changed || blocked.length) render();
        return;
      }
      for (const item of items) {
        if (item._shortcut) {
          const scIdx = customDesktopIcons.indexOf(item._shortcut);
          if (scIdx > -1) {
            customDesktopIcons.splice(scIdx, 1);
            saveDesktopShortcuts();
            delete iconPositions[item.name];
            saveIconPositions();
            changed = true;
            continue;
          }
        }
        const result = await deleteVirtualPath(makeFsPath(item.name), cwd);
        if (result.ok && result.deleted) changed = true;
        else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
      }
      if (blocked.length) osAlert(blocked[0], 'Delete', 'icon:warning');
      if (changed || blocked.length) document.dispatchEvent(new CustomEvent('fs-changed'));
      render();
    }, 'icon:recycle-full');
  }

  function typeLabel(kind) {
    return kind === 'dir' ? 'File Folder' : kind === 'image' ? 'Image File' :
           kind === 'video' ? 'Video File' : kind === 'audio' ? 'Audio File' :
           kind === 'binary' ? 'Binary File' : 'Text File';
  }

  // vfsListSync/vfsStatSync report kind as 'dir' | 'text' | 'blob'. Explorer's
  // item.kind is finer-grained for blobs (image/video/audio/binary), which is
  // what getIcon/typeLabel key off of, so every VFS entry passes through here
  // on its way into an item.
  function explorerKindFor(entry) {
    if (entry.kind === 'dir') return 'dir';
    if (entry.kind === 'blob') return (entry.blob && entry.blob.kind) || inferBlobKindFromName(entry.name);
    return 'file';
  }

  function makeItem(name, kind, sysfile, meta) {
    const item = { name, kind, sysfile, ...(meta || {}) };
    const icon = getIcon(name, kind);
    const isRecycleEntry = !!item._recycle;
    const isRecycleBin = !!item.recycleBin || isRecycleBinItemName(name);
    const isDesktopRootDir = !cwd && kind === 'dir' && sysfile && name === 'DESKTOP';
    let el;
    if (viewMode === 'list') {
      el = document.createElement('div');
      el.className = 'exp-list-item' + (sysfile ? ' exp-sysfile' : '');
      el.innerHTML = '<span class="exp-list-icon">' + iconMarkup(icon) + '</span><span>' + escHtml(iconLabel(name)) + '</span>';
    } else if (viewMode === 'details') {
      el = document.createElement('tr');
      el.className = 'exp-det-item' + (sysfile ? ' exp-sysfile' : '');
      el.innerHTML = '<td class="exp-det-icon">' + iconMarkup(icon) + '</td><td>' + escHtml(iconLabel(name)) + '</td><td>' + typeLabel(kind) + '</td>';
    } else {
      el = document.createElement('div');
      el.className = 'exp-item' + (sysfile ? ' exp-sysfile' : '');
      el.innerHTML = '<div class="exp-icon">' + iconMarkup(icon) + '</div><span>' + escHtml(iconLabel(name)) + '</span>';
    }
    registerSelectionNode(el, item);
    el.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey) toggleSelection(item);
      else replaceSelection(item);
    });
    el.addEventListener('dblclick', () => openItem(item));
    // Touch: single tap opens, long-press shows context menu
    addLongPress(el);
    let _tapX, _tapY, _tapT;
    el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { _tapX = e.clientX; _tapY = e.clientY; _tapT = Date.now(); } });
    el.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse' && !_longPressActive && Date.now() - _tapT < 400 && Math.abs(e.clientX - _tapX) < 10 && Math.abs(e.clientY - _tapY) < 10) openItem(item);
      _longPressActive = false;
    });

    // ── Drag source ──────────────────────────────────────────────
    const canDragItem = !isRecycleEntry && !item._proj && (!sysfile || isDesktopVirtualItem(item, cwd) || !!item._shortcut);
    if (canDragItem) {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', e => {
        const key = selectionKey(item);
        const dragItems = selectedKeys.has(key) ? getSelectedItems() : [item];
        if (!selectedKeys.has(key) || dragItems.length <= 1) replaceSelection(item);
        setShellDragPayload(buildShellDragPayload(item, cwd, 'explorer', { sourceId: id, items: dragItems }));
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', name);
        el.style.opacity = '0.5';
      });
      el.addEventListener('dragend', () => {
        clearShellDragPayload();
        el.style.opacity = '';
        pane.querySelectorAll('.exp-drop-target').forEach(n => n.classList.remove('exp-drop-target'));
      });
    }
    // ── Drag target (folders + recycle bin) ─────────────────────
    if ((kind === 'dir' && (!sysfile || isDesktopRootDir)) || isRecycleBin) {
      el._shellDropHandler = async payload => {
        if (!payload || shellDragIncludesItem(payload, item)) return false;
        if (isRecycleBin) {
          const ok = await doRecyclePayload(payload);
          if (!ok) setExplorerStatus('Move failed.');
          if (ok) render();
          return ok;
        }
        if (isDesktopRootDir && fsNormalizeDir(payload.srcCwd) === 'DESKTOP') return false;
        const dstPath = isDesktopRootDir ? 'DESKTOP' : (cwd ? cwd + '\\' + name : name);
        if (!canMoveShellPayloadToDir(payload, dstPath)) return false;
        const ok = await doMovePayload(payload, dstPath);
        if (!ok) setExplorerStatus('Move failed.');
        if (ok) render();
        return ok;
      };
      el.addEventListener('dragover', e => {
        const payload = getShellDragPayload();
        if (!payload || shellDragIncludesItem(payload, item)) return;
        const dstPath = isDesktopRootDir ? 'DESKTOP' : (cwd ? cwd + '\\' + name : name);
        const canDrop = isRecycleBin
          ? canRecycleShellPayload(payload)
          : fsNormalizeDir(payload.srcCwd) === dstPath ? false : canMoveShellPayloadToDir(payload, dstPath);
        if (!canDrop) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('exp-drop-target');
      });
      el.addEventListener('dragleave', () => el.classList.remove('exp-drop-target'));
      el.addEventListener('drop', e => {
        el.classList.remove('exp-drop-target');
        const payload = getShellDragPayload();
        if (!payload || shellDragIncludesItem(payload, item)) return;
        // preventDefault and stopPropagation stay ahead of the await - after
        // it they are both no-ops - and they were already unconditional here.
        e.preventDefault();
        e.stopPropagation();
        void el._shellDropHandler(payload).then(ok => { if (ok) clearShellDragPayload(); });
      });
    }

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      ensureContextSelection(item);
      const allSelected = getSelectedItems();
      const singleSelected = getSingleSelectedItem();
      const recycleSelected = getSelectedRecycleEntries();
      const multi = allSelected.length > 1;
      const canDelete = getDeletableSelectedItems().length > 0;
      const mutableSelected = allSelected.filter(i => !i.sysfile && !i._recycle && !i._shortcut);
      const isScript = !!singleSelected && !singleSelected.sysfile && !singleSelected._recycle && !singleSelected._shortcut && singleSelected.name.toLowerCase().endsWith('.script');
      const canSetWallpaper = !!singleSelected && !singleSelected.sysfile && !singleSelected._recycle && !singleSelected._shortcut && singleSelected.kind === 'image';
      const isLoreFile = !!singleSelected && !singleSelected._recycle && ['daemon.core','void.tmp'].includes(singleSelected.name);
      const isExeFile  = !!singleSelected && !singleSelected._recycle && !singleSelected._shortcut && singleSelected.name.toLowerCase().endsWith('.exe');
      if (singleSelected && !multi && (singleSelected.recycleBin || isRecycleBinItemName(singleSelected.name)) && !singleSelected._recycle) {
        showCtxMenu(e.clientX, e.clientY, [
          { label: 'Open', action: openRecycleBin },
          '-',
          { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
          '-',
          { label: 'Copy Name', action: () => navigator.clipboard?.writeText(singleSelected.name) },
        ]);
        return;
      }
      if (recycleSelected.length && allSelected.every(i => i._recycle)) {
        showCtxMenu(e.clientX, e.clientY, [
          { label: multi ? 'Restore Selected' : 'Restore', action: restoreSelectedRecycleEntries },
          { label: multi ? 'Delete Permanently' : 'Delete Permanently', action: deleteSelected },
          '-',
          { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
          '-',
          { label: 'Copy Name', action: () => navigator.clipboard?.writeText(getSelectedNamesText() || name) },
        ]);
        return;
      }
      showCtxMenu(e.clientX, e.clientY, [
        multi
          ? { label: 'Open All (' + allSelected.length + ')', action: () => allSelected.forEach(openItem) }
          : { label: kind === 'dir' ? 'Open Folder' : 'Open', action: () => openItem(item) },
        ...(isLoreFile ? [{ label: 'Open in Notepad', action: () => openNotepad(singleSelected.name) }] : []),
        ...(isExeFile  ? [{ label: 'Open in Decompiler', action: () => openDecompilerView(singleSelected.name) }] : []),
        ...(canSetWallpaper ? [{ label: 'Set as Wallpaper', action: () => applyWallpaper(makeFsPath(singleSelected.name)) }] : []),
        ...(isScript ? [{ label: 'Run Script', action: () => {
          runScriptInTerminal(singleSelected.name, cwd);
        }}] : []),
        '-',
        { label: 'Cut',   disabled: !mutableSelected.length || cwd === 'RECYCLE', action: () => { if (mutableSelected.length) { _expClipboard = { items: mutableSelected.map(i => ({ name:i.name, kind:i.kind, srcCwd:cwd })), cut:true }; if (ws) ws.textContent = mutableSelected.length + ' item(s) cut'; } } },
        { label: 'Copy',  disabled: !mutableSelected.length || cwd === 'RECYCLE', action: () => { if (mutableSelected.length) { _expClipboard = { items: mutableSelected.map(i => ({ name:i.name, kind:i.kind, srcCwd:cwd })), cut:false }; if (ws) ws.textContent = mutableSelected.length + ' item(s) copied'; } } },
        '-',
        { label: 'Rename', disabled: !singleSelected || !!singleSelected.sysfile || !!singleSelected._recycle || !!singleSelected._shortcut || cwd === 'RECYCLE', action: () => renameItem(singleSelected) },
        { label: 'Delete', disabled: !canDelete, action: deleteSelected },
        '-',
        { label: 'Copy Name', action: () => navigator.clipboard?.writeText(getSelectedNamesText() || name) },
      ]);
    });
    return el;
  }

  function makeProjectItem(project) {
    const item = { name: project.name, kind: 'file', sysfile: true, _proj: project };
    const openProject = () => window.open(/^https?:\/\//.test(project.file) ? project.file : 'https://' + project.file, '_blank');
    let el;
    if (viewMode === 'details') {
      el = document.createElement('tr');
      el.className = 'exp-det-item';
      el.innerHTML = '<td class="exp-det-icon">' + iconMarkup(project.emoji) + '</td><td>' + escHtml(project.name) + '</td><td>HTML Application</td>';
    } else if (viewMode === 'list') {
      el = document.createElement('div');
      el.className = 'exp-list-item';
      el.innerHTML = '<span class="exp-list-icon">' + iconMarkup(project.emoji) + '</span><span>' + escHtml(project.name) + '</span>';
    } else {
      el = document.createElement('div');
      el.className = 'exp-item';
      el.innerHTML = '<div class="exp-icon">' + iconMarkup(project.emoji) + '</div><span>' + escHtml(project.name) + '</span>';
    }
    registerSelectionNode(el, item);
    el.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey) toggleSelection(item);
      else replaceSelection(item);
    });
    el.addEventListener('dblclick', openProject);
    el.addEventListener('touchend', e => { e.preventDefault(); openProject(); }, { passive: false });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      ensureContextSelection(item);
      showCtxMenu(e.clientX, e.clientY, [
        { label: 'Open', action: openProject },
        '-',
        { label: 'Properties', action: () => osAlert('Name:\t' + project.name + '\nFile:\t' + project.file + '\nType:\tHTML Application\nLocation:\tC:\\sleepOS\\PROJECTS\\', 'Properties', 'icon:info') },
        '-',
        { label: 'Copy Name', action: () => navigator.clipboard?.writeText(getSelectedNamesText() || project.name) },
      ]);
    });
    return el;
  }

  function render() {
    pane.innerHTML = '';
    selected = null;
    selectedKeys = new Set();
    selectionItems = new Map();
    selectionNodes = new Map();
    const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
    addrEl.value = fullPath;
    // setWinTitle, not the span alone: the taskbar button, Alt+Tab and SYSMON
    // all read wins[id].title and used to keep the folder the window opened at.
    // The separator uses the same escape as line 3. It was a bare '?' here,
    // mojibake that degraded the title on the first navigation; keep it escaped.
    setWinTitle(id, 'FILE EXPLORER \u2014 ' + fullPath);

    if (cwd === 'PROJECTS') {
      const build = fn => {
        if (viewMode === 'details') {
          const tbl = document.createElement('table');
          tbl.className = 'exp-det-tbl';
          tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
          const tbody = document.createElement('tbody');
          PROJECTS.forEach(project => tbody.appendChild(fn(project)));
          tbl.appendChild(tbody);
          pane.appendChild(tbl);
        } else if (viewMode === 'list') {
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;';
          PROJECTS.forEach(project => list.appendChild(fn(project)));
          pane.appendChild(list);
        } else {
          const grid = document.createElement('div');
          grid.className = 'exp-grid';
          PROJECTS.forEach(project => grid.appendChild(fn(project)));
          pane.appendChild(grid);
        }
      };
      build(makeProjectItem);
      emptyStatusText = PROJECTS.length + ' objects';
      updateSelectionStatus();
      return;
    }

    if (cwd === 'RECYCLE') {
      const recycleItems = recycleBinEntries.map(entry => ({
        name: entry.name,
        kind: entry.kind,
        sysfile: false,
        _recycle: entry,
      }));
      const build = items => {
        if (viewMode === 'details') {
          const tbl = document.createElement('table');
          tbl.className = 'exp-det-tbl';
          tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
          const tbody = document.createElement('tbody');
          items.forEach(item => tbody.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          tbl.appendChild(tbody);
          pane.appendChild(tbl);
        } else if (viewMode === 'list') {
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;';
          items.forEach(item => list.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(list);
        } else {
          const grid = document.createElement('div');
          grid.className = 'exp-grid';
          items.forEach(item => grid.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(grid);
        }
        if (!items.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:12px;font-size:11px;color:#444;';
          empty.textContent = 'Recycle Bin is empty.';
          pane.appendChild(empty);
        }
      };
      build(recycleItems);
      emptyStatusText = recycleItems.length ? recycleItems.length + ' objects' : 'Recycle Bin is empty';
      updateSelectionStatus();
      return;
    }

    if (cwd === 'DESKTOP') {
      const desktopItems = getVisibleDesktopIcons().map(ic => ({
        name: ic.name,
        kind: ic.recycleBin ? 'dir' : 'file',
        sysfile: true,
        recycleBin: !!ic.recycleBin,
      }));
      getDesktopShortcutsForDir('DESKTOP').forEach(ic => desktopItems.push({
        name: ic.name,
        kind: ic.target.kind === 'dir' ? 'dir' : 'file',
        sysfile: false,
        _shortcut: ic,
      }));
      vfsListSync('DESKTOP').forEach(entry => desktopItems.push({ name: entry.name, kind: explorerKindFor(entry), sysfile: false }));
      const build = items => {
        if (viewMode === 'details') {
          const tbl = document.createElement('table');
          tbl.className = 'exp-det-tbl';
          tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
          const tbody = document.createElement('tbody');
          items.forEach(item => tbody.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          tbl.appendChild(tbody);
          pane.appendChild(tbl);
        } else if (viewMode === 'list') {
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;';
          items.forEach(item => list.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(list);
        } else {
          const grid = document.createElement('div');
          grid.className = 'exp-grid';
          items.forEach(item => grid.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(grid);
        }
      };
      build(desktopItems);
      emptyStatusText = desktopItems.length + ' objects';
      updateSelectionStatus();
      return;
    }

    const items = [];
    if (!cwd) {
      items.push({ name:'DESKTOP', kind:'dir', sysfile:true });
      items.push({ name:'PROJECTS', kind:'dir', sysfile:true });
      const rootEntries = vfsListSync('');
      ['DOCS', ...rootEntries.filter(e => e.kind === 'dir').map(e => e.name)]
        .filter((value, index, array) => array.indexOf(value) === index)
        .forEach(dirName => {
          if (dirName !== 'PROJECTS' && dirName !== 'DESKTOP') items.push({ name:dirName, kind:'dir', sysfile:false });
        });
      rootEntries.filter(e => e.kind !== 'dir').forEach(entry => items.push({ name: entry.name, kind: explorerKindFor(entry), sysfile: false }));
    } else {
      if (!vfsDirExistsSync(cwd)) {
        cwd = '';
        render();
        return;
      }
      if (cwd.startsWith('DESKTOP\\')) {
        getDesktopSystemIconsForDir(cwd).forEach(ic => items.push({
          name: ic.name,
          kind: ic.recycleBin ? 'dir' : 'file',
          sysfile: true,
          recycleBin: !!ic.recycleBin,
        }));
        getDesktopShortcutsForDir(cwd).forEach(ic => items.push({
          name: ic.name,
          kind: ic.target.kind === 'dir' ? 'dir' : 'file',
          sysfile: false,
          _shortcut: ic,
        }));
      }
      vfsListSync(cwd).forEach(entry => {
        if (cwd === 'CACHE' && entry.kind === 'dir' && entry.name === 'RECYCLE_BIN') return;
        items.push({ name: entry.name, kind: explorerKindFor(entry), sysfile: false });
      });
    }

    if (viewMode === 'details') {
      const tbl = document.createElement('table');
      tbl.className = 'exp-det-tbl';
      tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
      const tbody = document.createElement('tbody');
      items.forEach(item => tbody.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
      tbl.appendChild(tbody);
      pane.appendChild(tbl);
    } else if (viewMode === 'list') {
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;';
      items.forEach(item => list.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
      pane.appendChild(list);
    } else {
      const grid = document.createElement('div');
      grid.className = 'exp-grid';
      items.forEach(item => grid.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
      pane.appendChild(grid);
    }
    emptyStatusText = items.length + ' objects';
    updateSelectionStatus();
  }

  upBtn.addEventListener('click', () => {
    const i = cwd.lastIndexOf('\\');
    cwd = i >= 0 ? cwd.slice(0, i) : '';
    render();
  });
  refreshBtn.addEventListener('click', () => render());

  pane.addEventListener('click', e => {
    if (e.target.closest(ITEM_SELECTOR)) return;
    clearSelection();
  });
  pane._shellDropHandler = async payload => {
    if (!payload || cwd === 'PROJECTS' || cwd === 'RECYCLE') return false;
    if (isDesktopSurfaceTransferBlocked(payload, cwd)) return false;
    if (!canMoveShellPayloadToDir(payload, cwd)) return false;
    const ok = await doMovePayload(payload, cwd);
    if (!ok) setExplorerStatus('Move failed.');
    if (ok) render();
    return ok;
  };

  addLongPress(pane);
  pane.addEventListener('contextmenu', e => {
    if (e.target.closest(ITEM_SELECTOR)) return;
    e.preventDefault();
    clearSelection();
    const inProjects = cwd === 'PROJECTS';
    const inRecycle = cwd === 'RECYCLE';
    showCtxMenu(e.clientX, e.clientY, inProjects ? [
      { label: 'Refresh', action: render },
    ] : inRecycle ? [
      { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
      '-',
      { label: 'Refresh', action: render },
    ] : [
      { label: 'Open Terminal Here', action: () => openTerminal(cwd) },
      '-',
      { label: 'Paste', disabled: !_expClipboard, action: pasteClipboard },
      '-',
      { label: 'New Folder', action: () => promptCreateFolderAt(cwd, () => render()) },
      { label: 'New Text File', action: () => osPrompt('File name:', 'untitled.txt', 'New Text File', async name => {
        if (!name) return;
        try {
          await vfsWriteFile(name, '', cwd);
        } catch (err) {
          osAlert(err.code === 'ENOSPC' ? 'Not enough space to create this file.' : err.message, 'Cannot Create', 'icon:error');
          return;
        }
        openNotepad(name, cwd);
        render();
      }) },
      '-',
      { label: 'Upload File...', action: () => triggerUpload(cwd) },
      '-',
      { label: 'Refresh', action: render },
    ]);
  });

  // ── External file drag-and-drop onto the pane ─────────────────
  let dropOverlay = null;
  pane.addEventListener('dragenter', e => {
    if (getShellDragPayload()) return;
    if (cwd === 'PROJECTS' || cwd === 'RECYCLE') return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      if (!dropOverlay) {
        dropOverlay = document.createElement('div');
        dropOverlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,128,0.12);border:2px dashed #000080;pointer-events:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#000080;font-weight:bold;z-index:10;';
        dropOverlay.textContent = 'Drop files to upload';
        pane.appendChild(dropOverlay);
      }
    }
  });
  pane.addEventListener('dragover', e => {
    if (!e.target.closest(ITEM_SELECTOR)) {
      const payload = getShellDragPayload();
      if (payload && pane._shellDropHandler && !isDesktopSurfaceTransferBlocked(payload, cwd) && canMoveShellPayloadToDir(payload, cwd)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        return;
      }
    }
    if (cwd === 'PROJECTS' || cwd === 'RECYCLE') return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  pane.addEventListener('dragleave', e => {
    if (!pane.contains(e.relatedTarget)) {
      dropOverlay?.remove(); dropOverlay = null;
    }
  });
  pane.addEventListener('drop', e => {
    dropOverlay?.remove(); dropOverlay = null;
    const payload = getShellDragPayload();
    if (payload && !e.target.closest(ITEM_SELECTOR)) {
      e.preventDefault();
      e.stopPropagation();
      void pane._shellDropHandler(payload).then(ok => { if (ok) clearShellDragPayload(); });
      return;
    }
    if (e.dataTransfer.files?.length) {
      if (cwd === 'PROJECTS' || cwd === 'RECYCLE') return;
      e.preventDefault();
      e.stopPropagation();
      _uploadCwd = cwd;
      handleFileUpload(e.dataTransfer.files);
      render();
      return;
    }
    if (e.target.closest(ITEM_SELECTOR)) return;
  });

  mb.innerHTML = '';
  [
    { label: 'File', items: () => cwd === 'PROJECTS' ? [
      { label: 'Open', disabled: !selected, action: () => { if (selected?._proj) window.open(selected._proj.file, '_blank'); } },
      '-',
      { label: 'Close', action: () => closeWin(id) },
    ] : cwd === 'RECYCLE' ? [
      { label: 'Restore', disabled: !getSelectedRecycleEntries().length, action: restoreSelectedRecycleEntries },
      { label: 'Delete Permanently', disabled: !getSelectedRecycleEntries().length, action: deleteSelected },
      '-',
      { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
      '-',
      { label: 'Close', action: () => closeWin(id) },
    ] : [
      { label: 'New Folder', action: () => promptCreateFolderAt(cwd, () => render()) },
      { label: 'New Text File', action: () => osPrompt('File name:', 'untitled.txt', 'New Text File', async name => {
        if (!name) return;
        try {
          await vfsWriteFile(name, '', cwd);
        } catch (err) {
          osAlert(err.code === 'ENOSPC' ? 'Not enough space to create this file.' : err.message, 'Cannot Create', 'icon:error');
          return;
        }
        openNotepad(name, cwd);
        render();
      }) },
      '-',
      { label: 'Open', disabled: !selected, action: () => { if (selected) openItem(selected); } },
      { label: 'Delete', disabled: !getDeletableSelectedItems().length, action: deleteSelected },
      '-',
      { label: 'Upload File...', action: () => triggerUpload(cwd) },
      '-',
      { label: 'Close', action: () => closeWin(id) },
    ]},
    { label: 'Edit', items: () => [
      { label: 'Cut',   disabled: !getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut).length || cwd==='PROJECTS' || cwd==='RECYCLE', action: () => { const its=getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut); _expClipboard={items:its.map(i=>({name:i.name,kind:i.kind,srcCwd:cwd})),cut:true}; if(ws) ws.textContent=its.length+' item(s) cut'; } },
      { label: 'Copy',  disabled: !getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut).length || cwd==='RECYCLE', action: () => { const its=getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut); _expClipboard={items:its.map(i=>({name:i.name,kind:i.kind,srcCwd:cwd})),cut:false}; if(ws) ws.textContent=its.length+' item(s) copied'; } },
      { label: 'Paste', disabled: !_expClipboard || cwd==='PROJECTS' || cwd==='RECYCLE', action: pasteClipboard },
      '-',
      { label: 'Select All', action: () => selectAllVisibleItems() },
      { label: 'Invert Selection', action: () => invertSelection() },
      '-',
      { label: 'Copy Name', disabled: !getSelectedItems().length, action: () => {
        const text = getSelectedNamesText();
        if (!text) return;
        navigator.clipboard?.writeText(text);
        if (ws) ws.textContent = 'Copied';
      }},
      { label: 'Copy Path', disabled: !getSelectedItems().length, action: () => {
        const text = getSelectedPathsText();
        if (!text) return;
        navigator.clipboard?.writeText(text);
        if (ws) ws.textContent = 'Copied';
      }},
      '-',
      { label: 'Rename', disabled: !getSingleSelectedItem() || getSingleSelectedItem()?.sysfile || getSingleSelectedItem()?._recycle || getSingleSelectedItem()?._shortcut || cwd === 'PROJECTS' || cwd === 'RECYCLE', action: () => renameItem(getSingleSelectedItem()) },
      { label: 'Delete', disabled: !getDeletableSelectedItems().length || cwd === 'PROJECTS', action: deleteSelected },
    ]},
    { label: 'View', items: () => [
      { label: (viewMode === 'icons' ? '* ' : '  ') + 'Large Icons', action: () => { viewMode = 'icons'; render(); } },
      { label: (viewMode === 'list' ? '* ' : '  ') + 'List', action: () => { viewMode = 'list'; render(); } },
      { label: (viewMode === 'details' ? '* ' : '  ') + 'Details', action: () => { viewMode = 'details'; render(); } },
      '-',
      { label: 'Refresh', action: render },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item';
    span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items()); });
    mb.appendChild(span);
  });

  // ── Paste helper ─────────────────────────────────────────────
  // Shared with the desktop; see pasteClipboardInto in os/fs-core.js.
  async function pasteClipboard() {
    if (await pasteClipboardInto(cwd)) render();
  }

  // ── Explorer keyboard shortcuts ───────────────────────────────
  pane.setAttribute('tabindex', '-1');
  pane.style.outline = 'none';
  const winEl = document.getElementById('win-' + id);
  winEl?.addEventListener('keydown', e => {
    if (!wins[id]) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const items = getSelectedItems().filter(i => !i.sysfile && !i._proj && !i._recycle && !i._shortcut);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      if (cwd === 'RECYCLE') return;
      if (!items.length) return;
      _expClipboard = { items: items.map(i => ({ name: i.name, kind: i.kind, sysfile: i.sysfile, srcCwd: cwd })), cut: false };
      if (ws) ws.textContent = items.length === 1 ? '"' + items[0].name + '" copied' : items.length + ' items copied';
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      if (cwd === 'RECYCLE') return;
      if (!items.length) return;
      _expClipboard = { items: items.map(i => ({ name: i.name, kind: i.kind, sysfile: i.sysfile, srcCwd: cwd })), cut: true };
      if (ws) ws.textContent = items.length === 1 ? '"' + items[0].name + '" cut' : items.length + ' items cut';
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteClipboard();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAllVisibleItems();
    } else if (e.key === 'Delete' || e.key === 'Backspace' && e.altKey) {
      e.preventDefault();
      if (getDeletableSelectedItems().length) deleteSelected();
    } else if (e.key === 'F2') {
      e.preventDefault();
      const single = getSingleSelectedItem();
      if (single && !single.sysfile && !single._recycle && !single._shortcut && cwd !== 'RECYCLE') renameItem(single);
    } else if (e.key === 'F5') {
      e.preventDefault();
      render();
    } else if (e.key === 'Escape') {
      clearSelection();
    }
  });

  render();

  function onFsChanged() {
    if (wins[id]) render();
    else document.removeEventListener('fs-changed', onFsChanged);
  }
  document.addEventListener('fs-changed', onFsChanged);
}

function openFiles() { openExplorer('PROJECTS'); }

let _termNav = null; // exposes cwd navigation to callers when terminal is already open
let _termExec = null;

// Delegates to os/process-view.js, the one module both `ps` and SYSMON read
// so the two views cannot disagree about what processes exist.
function buildPsRows() {
  return buildProcessRows();
}

// Shared by CMDS.kill so it cannot disagree with `ps`/`taskkill` about which
// pids belong to the daemon story: findBuiltInProcess is the same lookup
// taskkill already uses, so both commands agree on what counts as a story
// process by construction, not by a second hand-maintained list. Returns the
// message to print and stop, or null if pid is not a story process and
// CMDS.kill should proceed to the real kernel table.
function buildKillDenialMessage(pid) {
  const builtIn = findBuiltInProcess(pid);
  return builtIn ? `${pid} is a system process. Use TASKKILL.` : null;
}
function openTerminal(startDir, initialCommand) {
  if (!mkWin({ id:'terminal', title:'TERMINAL.exe - Command Prompt', icon:'icon:terminal', w:520, h:320, x:140, y:90, menubar:false, statusbar:false })) {
    if (startDir && _termNav) _termNav(startDir);
    if (initialCommand && _termExec) _termExec(initialCommand);
    return;
  }
  const body = document.getElementById('wb-terminal');
  body.style.padding = '0'; body.style.overflow = 'hidden';
  body.innerHTML = `
    <div class="term-wrap" id="tw">
      <div class="term-out" id="to"></div>
      <div class="term-in-line">
        <span class="term-prompt" id="term-prompt">C:\sleepOS&gt;&nbsp;</span>
        <input class="term-input" id="ti" type="text" autocomplete="off" spellcheck="false">
      </div>
    </div>`;

  const out = document.getElementById('to');
  const inp = document.getElementById('ti');

  body.addEventListener('contextmenu', e => {
    e.preventDefault();
    const sel = window.getSelection()?.toString();
    showCtxMenu(e.clientX, e.clientY, [
      { label: 'Copy',            disabled: !sel, action: () => sel && navigator.clipboard?.writeText(sel) },
      { label: 'Paste',           action: () => navigator.clipboard?.readText().then(t => { inp.value += t; inp.focus(); }) },
      '-',
      { label: 'Clear Screen',    action: () => { out.innerHTML = ''; } },
      '-',
      { label: 'Close',           action: () => closeWin('terminal') },
    ]);
  });

  const print = (text, color) => {
    const div = document.createElement('div');
    div.textContent = text;
    if (color) div.style.color = color;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  };

  print('sleepOS Command Processor v2.33');
  print('Copyright (C) MMXXI Eve Networks Corp.');
  print('');
  print('Type HELP for available commands.');
  print('');

  let cmdHistory = [], histIdx = -1;
  let cwd = startDir ? startDir.toUpperCase() : ''; // '' = root, 'DOCS' = DOCS dir, etc.
  // The environment is the terminal PROCESS's, not the terminal WINDOW's.
  // shellVars is a live reference into the kernel process table, so SET, INC,
  // INPUT and $var expansion all read and write the same object a spawned
  // child will inherit - no copying, no syncing, and no second source of
  // truth. The defaults live in os/kernel.js as KERNEL_DEFAULT_ENV.
  //
  // A consequence, and a deliberate one: closing the terminal destroys the
  // process entry, so reopening it gets a fresh environment inherited from the
  // kernel. A new shell does not remember the last shell's PATH. Persisting
  // that would mean putting the environment in the registry, which is a
  // different feature.
  //
  // The fallback covers callers that reach openTerminal without a registered
  // window, which is what the test harness does.
  const _termPid = typeof kernelPidForWin === 'function' ? kernelPidForWin('terminal') : null;
  const _termProc = _termPid ? kernelGetProcess(_termPid) : null;
  const shellVars = _termProc && _termProc.env
    ? _termProc.env
    : Object.assign(Object.create(null), kernelDefaultEnv());
  let promptOverride = '';
  let activeCommandController = null;
  let pendingRead = null;

  function getPromptStr() {
    return cwd ? `C:\\sleepOS\\${cwd}>` : 'C:\\sleepOS>';
  }
  function getActivePromptStr() {
    return promptOverride || getPromptStr();
  }
  function updatePrompt() {
    const el = document.getElementById('term-prompt');
    if (el) el.textContent = getActivePromptStr() + '\u00a0';
  }
  function setPromptOverride(text) {
    promptOverride = String(text || '').trim();
    updatePrompt();
  }

  function getCurrentCommandSignal() {
    return activeCommandController ? activeCommandController.signal : null;
  }

  function refreshTerminalInputMode() {
    inp.readOnly = !!activeCommandController && !pendingRead;
  }

  function interruptActiveCommand() {
    if (!activeCommandController && !pendingRead) return false;
    const err = makeAbortError();
    if (pendingRead) {
      const { reject } = pendingRead;
      pendingRead = null;
      setPromptOverride('');
      if (reject) reject(err);
    }
    if (activeCommandController && !activeCommandController.signal.aborted) {
      activeCommandController.abort(err);
    }
    inp.value = '';
    refreshTerminalInputMode();
    print('^C', '#ff4444');
    inp.focus();
    return true;
  }

  // Allow openTerminal(dir) to navigate us when already open
  _termNav = (dir) => { cwd = dir.toUpperCase(); updatePrompt(); print(`\nChanged directory to C:\\sleepOS\\${cwd}`); };

  updatePrompt(); // set prompt correctly if startDir was given

  function unquoteShellValue(value) {
    const trimmed = String(value ?? '').trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1).replace(/\\(["'])/g, '$1');
    }
    return trimmed;
  }

  function parseTerminalDelayMs(value) {
    const ms = scriptParseNumber(unquoteShellValue(value));
    if (ms === null || ms < 0) throw new Error('Usage: SLEEP <ms>');
    return Math.floor(ms);
  }

  function resolveShellText(text) {
    return scriptResolveText(String(text ?? ''), shellVars);
  }

  function normalizeTerminalReadPrompt(text) {
    const trimmed = String(text || '').trim();
    return trimmed || 'INPUT:';
  }

  function readTerminalLine(promptText) {
    if (pendingRead) throw new Error('Another INPUT request is already pending.');
    throwIfAborted(getCurrentCommandSignal());
    const normalizedPrompt = normalizeTerminalReadPrompt(promptText);
    return new Promise((resolve, reject) => {
      pendingRead = { promptText: normalizedPrompt, resolve, reject };
      setPromptOverride(normalizedPrompt);
      refreshTerminalInputMode();
      inp.focus();
    });
  }

  function getCommandParts(segment) {
    const trimmed = String(segment || '').trim();
    if (!trimmed) return { cmd: '', args: '' };
    const sp = trimmed.search(/\s/);
    return sp === -1
      ? { cmd: trimmed.toLowerCase(), args: '' }
      : { cmd: trimmed.slice(0, sp).toLowerCase(), args: trimmed.slice(sp + 1).trim() };
  }

  function splitUnquoted(text, delimiter) {
    const parts = [];
    let quote = null;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === quote && text[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === delimiter) {
        parts.push(text.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(text.slice(start));
    return parts;
  }

  function findLastUnquotedRedirect(text) {
    let quote = null;
    let found = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === quote && text[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '>') {
        const op = text[i + 1] === '>' ? '>>' : '>';
        found = { index: i, op };
        if (op === '>>') i++;
      }
    }
    return found;
  }

  function parseShellLine(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    const redirect = findLastUnquotedRedirect(trimmed);
    let commandText = trimmed;
    let redirectOp = null;
    let redirectTarget = '';
    if (redirect) {
      commandText = trimmed.slice(0, redirect.index).trim();
      redirectOp = redirect.op;
      redirectTarget = trimmed.slice(redirect.index + redirect.op.length).trim();
    }
    return {
      stages: splitUnquoted(commandText, '|').map(part => part.trim()).filter(Boolean),
      redirectOp,
      redirectTarget,
    };
  }

  function applyShellSet(rawArgs) {
    const text = String(rawArgs ?? '').trim();
    if (!text) return buildSetLines();

    let match = text.match(/^(\w+)=(.*)$/);
    if (match) {
      const key = match[1];
      if (match[2] === '') {
        delete shellVars[key];
      } else {
        shellVars[key] = scriptStripOuterQuotes(resolveShellText(match[2]));
      }
      return [];
    }

    match = resolveShellText(text).match(/^(\w+)(?:\s+(.*))?$/);
    if (!match) throw new Error('Usage: SET [name[=value] | name value]');
    if (match[2] === undefined) return buildSetLines(match[1]);

    shellVars[match[1]] = scriptStripOuterQuotes(match[2]);
    return [];
  }

  function runShellNumericCommand(op, rawArgs) {
    const resolved = resolveShellText(rawArgs).trim();
    const match = resolved.match(/^(\w+)(?:\s+(.+))?$/);
    if (!match) {
      const usage = op === 'mul' || op === 'div' || op === 'mod'
        ? `Usage: ${op.toUpperCase()} <var> <amount>`
        : `Usage: ${op.toUpperCase()} <var> [amount]`;
      throw new Error(usage);
    }
    const nextValue = scriptMutateNumericVar(shellVars, match[1], op, match[2] === undefined ? undefined : scriptStripOuterQuotes(match[2]), 0);
    return [`${match[1]}=${nextValue}`];
  }

  async function runShellInputCommand(rawArgs) {
    const resolved = resolveShellText(rawArgs).trim();
    const match = resolved.match(/^(\w+)(?:\s+(.+))?$/);
    if (!match) throw new Error('Usage: INPUT <var> [prompt]');
    const key = match[1];
    const prompt = match[2] ? scriptStripOuterQuotes(match[2]) : key + ':';
    const value = await readTerminalLine(prompt);
    shellVars[key] = value;
    return [value];
  }

  // Resolution goes through os/programs.js, which searches the current
  // directory first and then each PATH entry. The `launchers` map that used to
  // live here was one of three lists of the same programs; it is gone, and the
  // launch banners and the daemon's 320ms beat moved into the registry with
  // the programs they belong to.
  function launchTerminalTarget(rawTarget) {
    const key = resolveShellText(rawTarget).trim();
    if (!key) return false;
    // Checked before resolution so the message is about the story, not about
    // PATH. void.tmp is already absent from the root set after the ending, so
    // without this the player would get "not recognized" for a file the story
    // says was removed.
    if (key.toLowerCase() === 'void.tmp' && daemonStory.endingReached) {
      print('void.tmp is no longer present.');
      return true;
    }
    const hit = programResolve(key, cwd, shellVars.PATH);
    if (!hit) return false;
    const program = hit.program;
    // TERMINAL.exe resolving from inside the terminal is the one program whose
    // launch is a message rather than an action.
    if (program.selfLines) {
      program.selfLines.forEach(line => print(line));
      return true;
    }
    program.lines.forEach(line => print(line));
    if (program.open) procSetTimeout('terminal', () => program.open({ cwd }), program.delay);
    return true;
  }

  function expandGlob(pattern) {
    if (!vfsDirExistsSync(cwd)) return [pattern];
    const allNames = vfsListSync(cwd).filter(e => e.type === 'file').map(e => e.name);
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp('^' + escaped + '$', 'i');
    const matches = allNames.filter(n => re.test(n));
    return matches.length ? matches : [pattern];
  }

  function buildDirLines(args) {
    const targetArg = (args || '').trim();
    if (targetArg && /[*?]/.test(targetArg)) return expandGlob(targetArg);
    const targetCwd = targetArg ? targetArg.toUpperCase() : cwd;
    if (!vfsDirExistsSync(targetCwd)) throw new Error(`Directory not found: ${args}`);
    const entries = vfsListSync(targetCwd);
    const path = targetCwd ? `C:\\sleepOS\\${targetCwd}` : 'C:\\sleepOS';
    const now = new Date();
    const ds = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`;
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const lines = [
      'Volume in drive C is CORPUS',
      'Volume Serial Number is DEAD-C0DE',
      '',
      `Directory of ${path}`,
      '',
    ];
    if (!targetCwd) {
      [
        `11/13/2024  10:31    <DIR>    .`,
        `11/13/2024  10:31    <DIR>    ..`,
        `11/13/2024  10:31    <DIR>    DOCS`,
        `11/13/2024  10:31    <DIR>    PROJECTS`,
      ].forEach(line => lines.push(line));
      getTerminalRootSystemEntries({ includeExplorer: true }).forEach(entry => {
        lines.push(`${entry.date}  ${String(entry.size).padStart(7)}    ${entry.name}`);
      });
      entries.filter(e => e.type === 'dir' && e.name !== 'DOCS').forEach(e => lines.push(`${ds}  ${ts}    <DIR>    ${e.name}`));
      entries.filter(e => e.kind === 'text').forEach(e => lines.push(`${ds}  ${ts}  ${String(e.size).padStart(7)}    ${e.name}`));
      entries.filter(e => e.kind === 'blob').forEach(e => lines.push(`${ds}  ${ts}  ${fmtSize(e.size).padStart(7)}    ${e.name}  [${e.blob.kind}]`));
    } else {
      entries.filter(e => e.type === 'dir').forEach(e => lines.push(`${ds}  ${ts}    <DIR>    ${e.name}`));
      entries.filter(e => e.kind === 'text').forEach(e => lines.push(`${ds}  ${ts}  ${String(e.size).padStart(7)}    ${e.name}`));
      entries.filter(e => e.kind === 'blob').forEach(e => lines.push(`${ds}  ${ts}  ${fmtSize(e.size).padStart(7)}    ${e.name}  [${e.blob.kind}]`));
      if (entries.length === 0) lines.push('  (empty directory)');
    }
    lines.push('');
    return lines;
  }

  function buildPsLines() {
    const lines = ['   PID  KIND    STATE    PROCESS', '  ----  ----    -----    -------'];
    buildPsRows().forEach(p => {
      lines.push('  ' + String(p.pid).padStart(4) + '  ' + p.kind.padEnd(6) + '  ' + p.state.padEnd(7) + '  ' + p.name);
    });
    return lines;
  }

  function buildVerLines() {
    return [
      'sleepOS Version 0.9β (Build 2024.11.13-EXPERIMENTAL)',
      'Soul Architecture: SOMA-686  /  Corpus Mode: ACTIVE',
    ];
  }

  function buildWhoLines() {
    return [
      'Current user : VISITOR\\UNKNOWN',
      'Domain       : sleepOS.CORPUS',
      'Session ID   : 0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0'),
      'Observers    : unknown (cannot enumerate)',
    ];
  }

  function buildDateLines() {
    const now = new Date();
    return [
      'System date: ' + now.toDateString(),
      'NOTE: Clock drift detected. True date: +/- 2.3 years from displayed.',
    ];
  }

  function buildIpconfigLines() {
    return [
      'sleepOS IP Configuration',
      '',
      'Adapter: SOMA-686 NIC',
      '  Connection-specific DNS  : corpus.internal',
      '  IPv4 Address             : 0.0.0.0',
      '  Subnet Mask              : 255.255.255.???',
      '  Default Gateway          : [unreachable]',
      '  DNS Servers              : unknown (responding)',
      '',
      'Adapter: VOID Interface',
      '  Status                   : Connected',
      '  Address                  : [cannot be expressed]',
      '  Packets in               : ∞',
      '  Packets out              : 0',
    ];
  }

  function buildTreeLines() {
    const lines = ['C:\\sleepOS', '├── DOCS\\'];
    const docsFiles = vfsListSync('DOCS').filter(e => e.kind === 'text').map(e => e.name);
    docsFiles.forEach((n, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${n}`));
    const rootEntries = vfsListSync('');
    rootEntries.filter(e => e.type === 'dir').forEach(e => {
      const d = e.name;
      if (d === 'DOCS') return;
      lines.push(`├── ${d}\\`);
      const subEntries = vfsListSync(d);
      subEntries.filter(x => x.kind === 'text').forEach((x, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${x.name}`));
      subEntries.filter(x => x.kind === 'blob').forEach((x, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${x.name}`));
    });
    getRootSystemFiles({ includeExplorer: true }).forEach(name => {
      let label = name;
      if (name === 'daemon.core') label = daemonStory.endingReached ? 'daemon.core              [ARCHIVED]' : 'daemon.core              [CONTAINMENT]';
      if (name === '?????.exe') label = daemonStory.stage >= 7 ? getExeDisplayName() + '                [QUARANTINE LAUNCHER]' : '?????.exe                [DO NOT EXECUTE]';
      lines.push(`├── ${label}`);
    });
    rootEntries.filter(e => e.kind === 'text').forEach(e => lines.push(`├── ${e.name}`));
    rootEntries.filter(e => e.kind === 'blob').forEach(e => lines.push(`├── ${e.name}  [${e.blob.kind}]`));
    lines.push('└── PROJECTS\\');
    lines.push('    ├── sand playground');
    lines.push('    ├── fireworks');
    lines.push('    ├── ... (more objects)');
    lines.push('    └── [1 object cannot be listed]');
    return lines;
  }

  async function getPipeableText(path) {
    const { dirName, fileName } = vfsSplitPath(path, cwd);
    const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
    if (upperPath === 'DAEMON.CORE') {
      daemonActivate('raw');
      return buildDaemonCoreRawContent().split('\n');
    }
    if (upperPath === 'VOID.TMP' && !daemonStory.endingReached) {
      daemonRecordInvestigation('void');
      return getVoidTmpContent().split('\n');
    }
    const st = vfsStatSync(path, cwd);
    if (!st || st.type !== 'file') throw new Error('File not found: ' + path);
    if (upperPath === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
    if (upperPath === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
    if (st.kind === 'blob') {
      return [
        `Binary file: ${st.name} (${st.blob.kind}, ${fmtSize(st.blob.size)})`,
        `Use OPEN ${st.name} to view it.`,
      ];
    }
    const text = await vfsReadFile(path, cwd);
    return text ? text.split('\n') : [];
  }

  async function buildPingLines(args, signal) {
    const host = (args || 'evenet.fun').trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '');
    const lines = [`Pinging ${host} with 32 bytes of data:`];
    const times = [];
    let received = 0;
    for (let i = 0; i < 4; i++) {
      throwIfAborted(signal);
      if (i > 0) await scriptSleep(1000, signal);
      const ctrl = new AbortController();
      const tid = procSetTimeout('terminal', () => ctrl.abort(), 4000);
      const abortFetch = () => ctrl.abort();
      if (signal) signal.addEventListener('abort', abortFetch, { once: true });
      const t0 = performance.now();
      try {
        await fetch(`https://${host}/`, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
        clearTimeout(tid);
        const ms = Math.round(performance.now() - t0);
        times.push(ms);
        received++;
        lines.push(`Reply from ${host}: bytes=32 time=${ms}ms TTL=57`);
      } catch (e) {
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', abortFetch);
        if (signal?.aborted) throw signal.reason && isAbortError(signal.reason) ? signal.reason : makeAbortError();
        lines.push(`Request timeout for ${host}.`);
        continue;
      }
      if (signal) signal.removeEventListener('abort', abortFetch);
    }
    lines.push('');
    lines.push(`Ping statistics for ${host}:`);
    const lost = 4 - received;
    lines.push(`  Packets: Sent = 4, Received = ${received}, Lost = ${lost} (${Math.round(lost / 4 * 100)}% loss)`);
    if (times.length) {
      lines.push(`Approximate round trip times: Min=${Math.min(...times)}ms  Max=${Math.max(...times)}ms  Avg=${Math.round(times.reduce((a, b) => a + b) / times.length)}ms`);
    }
    return lines;
  }

  function buildHelpLines() {
    return [
      'Available commands:',
      '  HELP                - show this help',
      '  DIR, LS             - list directory',
      '  CD [path]           - change directory',
      '  MKDIR [name]        - create a directory',
      '  TOUCH [name]        - create empty file',
      '  ECHO [text]         - print text',
      '  PRINT [text]        - alias for ECHO',
      '  DEL, RM [file]      - delete a file or directory',
      '  COPY [src] [dst]    - copy a file',
      '  MOVE, MV            - move a file',
      '  TYPE, CAT [file]    - read file contents',
      '  GREP <pattern> [f]  - filter a file or piped text',
      '  WC [file]           - count lines, words, bytes',
      '  TREE                - directory tree',
      '  PS                  - list running processes',
      '  TASKKILL [pid]      - terminate a process',
      '  SPAWN <script> [args] - run a script as a background process',
      '  KILL <pid> [/F]     - terminate a process (SIGTERM, or /F for SIGKILL)',
      '  IPCONFIG            - network configuration',
      '  SET [name=value]    - show or assign shell variables',
      '  ENV                 - show the process environment',
      '  PATH [value]        - show or set the executable search path',
      '  WHERE <name>        - show which directory a program resolves from',
      '  INPUT <var> [text]  - read a line into a shell variable',
      '  INC, DEC <var> [n]  - adjust numeric shell variables',
      '  ADD, SUB, MUL, DIV, MOD - arithmetic on shell variables',
      '  PING [host]         - ping a host',
      '  SLEEP <ms>          - pause for a number of milliseconds',
      '  WAIT <ms>           - alias for SLEEP',
      '  VER                 - show OS version',
      '  WHO, WHOAMI         - current user info',
      '  DATE                - system date',
      '  CLS                 - clear screen',
      '  CLEAR               - alias for CLS',
      '  OPEN [file]         - open a file (image/video in viewer, text in editor)',
      '  RUN <file> [args]   - execute a .script file',
      '  NOTEPAD [file]      - open Notepad (optionally open a file)',
      '  START [program]     - run an executable or project',
      '  EXIT                - close terminal',
      '',
      'Pipes and redirection:',
      '  DIR | GREP txt',
      '  CAT README.txt | NOTEPAD',
      '  DIR > listing.txt',
      '  CAT README.txt | GREP TODO >> notes.txt',
      '',
      'Scripting: see DOCS/SCRIPTING.txt  (CD DOCS, CAT SCRIPTING.txt)',
      '  Scripts support labels, subroutines, args, existence tests, and status codes.',
      '',
      'You can also type executables directly:',
      '  notepad.exe, terminal.exe, calc.exe, regedit.exe, sysmon.exe',
      '  welcome.readme, void.tmp, daemon.core, ?????.exe',
      '  or any project name (try: fireworks, fluid, ...)',
      '  Programs are found in the current directory first, then along PATH.',
    ];
  }

  function buildSetLines(nameFilter) {
    const keys = Object.keys(shellVars).sort((a, b) => a.localeCompare(b));
    if (!nameFilter) return keys.map(key => `${key}=${shellVars[key]}`);
    return Object.prototype.hasOwnProperty.call(shellVars, nameFilter)
      ? [`${nameFilter}=${shellVars[nameFilter]}`]
      : [`Variable not defined: ${nameFilter}`];
  }

  // The same table SET prints, under the name a person types. Delegating rather
  // than re-listing shellVars is what stops the two from ever disagreeing about
  // what the environment contains.
  function buildEnvLines() {
    return buildSetLines();
  }

  function buildWhereLines(rawArgs) {
    const name = unquoteShellValue(resolveShellText(rawArgs)).trim();
    if (!name) throw new Error('Usage: WHERE <name>');
    const hit = programResolve(name, cwd, shellVars.PATH);
    // NOT the message real where.exe gives - Windows prints "INFO: Could not
    // find files for the given pattern(s)." and does not echo the name back.
    // Kept this way anyway: naming the thing that was searched for is more
    // useful than the real message's fidelity, and this shell already departs
    // from cmd.exe in plenty of other places.
    if (!hit) return [`INFO: Could not find "${name}".`];
    return [programDisplayDir(hit.dir) + '\\' + hit.program.name];
  }

  // cmd.exe's PATH: bare prints, with a value assigns. Sugar over SET PATH=,
  // and the thing a person actually types. Writes straight through shellVars,
  // which is the terminal process's env, so a PATH set here is the same PATH
  // programResolve reads and the same one a spawned child inherits.
  function applyShellPath(rawArgs) {
    const text = String(rawArgs ?? '').trim();
    if (!text) return [`PATH=${shellVars.PATH ?? ''}`];
    shellVars.PATH = scriptStripOuterQuotes(resolveShellText(text));
    return [];
  }

  async function runPipeStage(cmd, args, stdinLines) {
    cmd = ({ print: 'echo', wait: 'sleep', clear: 'cls' }[cmd] || cmd);
    if (cmd === 'echo') return [unquoteShellValue(resolveShellText(args))];
    if (cmd === 'help') return buildHelpLines();
    if (cmd === 'dir' || cmd === 'ls') return buildDirLines(resolveShellText(args));
    if (cmd === 'ps') return buildPsLines();
    if (cmd === 'ver') return buildVerLines();
    if (cmd === 'who' || cmd === 'whoami') return buildWhoLines();
    if (cmd === 'date') return buildDateLines();
    if (cmd === 'set') return applyShellSet(args);
    // Registering these here as well as in CMDS is not belt-and-braces: an
    // unknown command makes runPipeStage return null, which the caller turns
    // into "Piping not supported for command: X". A command added to CMDS
    // alone would look supported right up until someone piped or redirected it.
    if (cmd === 'env') return buildEnvLines();
    if (cmd === 'where') return buildWhereLines(args);
    if (cmd === 'path') return applyShellPath(args);
    if (cmd === 'input') return runShellInputCommand(args);
    if (cmd === 'inc' || cmd === 'dec' || cmd === 'add' || cmd === 'sub' || cmd === 'mul' || cmd === 'div' || cmd === 'mod') {
      return runShellNumericCommand(cmd, args);
    }
    if (cmd === 'ipconfig') return buildIpconfigLines();
    if (cmd === 'tree') return buildTreeLines();
    if (cmd === 'ping') return buildPingLines(resolveShellText(args), getCurrentCommandSignal());
    if (cmd === 'sleep') {
      await scriptSleep(parseTerminalDelayMs(resolveShellText(args)), getCurrentCommandSignal());
      return Array.isArray(stdinLines) ? stdinLines.slice() : [];
    }
    if (cmd === 'cls') {
      out.innerHTML = '';
      return Array.isArray(stdinLines) ? stdinLines.slice() : [];
    }
    if (cmd === 'cat' || cmd === 'type') {
      const target = resolveShellText(args).trim();
      if (target) return await getPipeableText(target);
      if (Array.isArray(stdinLines)) return stdinLines.slice();
      throw new Error('Usage: CAT [file]');
    }
    if (cmd === 'grep') {
      const match = resolveShellText(args).trim().match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)(?:\s+(.+))?$/);
      if (!match) throw new Error('Usage: GREP <pattern> [file]');
      const pattern = unquoteShellValue(match[1]);
      const target = match[2] ? unquoteShellValue(match[2]) : '';
      let re;
      try { re = new RegExp(pattern, 'i'); } catch (e) { throw new Error('Invalid regex: ' + pattern); }
      const sourceLines = target ? await getPipeableText(target) : Array.isArray(stdinLines) ? stdinLines.slice() : null;
      if (!sourceLines) throw new Error('Usage: GREP <pattern> [file]');
      return sourceLines.filter(line => re.test(line));
    }
    if (cmd === 'wc') {
      let sourceText = '';
      let label = '';
      const targetArg = resolveShellText(args).trim();
      if (targetArg) {
        const target = unquoteShellValue(targetArg);
        const st = vfsStatSync(target, cwd);
        if (!st || st.kind !== 'text') throw new Error('File not found: ' + target);
        sourceText = (await vfsReadFile(target, cwd)) || '';
        label = '  ' + st.name;
      } else if (Array.isArray(stdinLines)) {
        sourceText = stdinLines.join('\n');
      } else {
        throw new Error('Usage: WC [file]');
      }
      const lines = sourceText ? sourceText.split('\n').length : 0;
      const words = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
      const bytes = new TextEncoder().encode(sourceText).length;
      return [`  ${String(lines).padStart(6)}  ${String(words).padStart(6)}  ${String(bytes).padStart(6)}${label}`];
    }
    return null;
  }

  async function writePipelineOutput(targetPath, lines, append) {
    const normalizedTarget = unquoteShellValue(resolveShellText(targetPath));
    if (!normalizedTarget) throw new Error('Missing redirect target.');
    const existingStat = vfsStatSync(normalizedTarget, cwd);
    if (existingStat && existingStat.kind === 'blob') throw new Error('Cannot write text output to binary file: ' + normalizedTarget);
    const output = lines.join('\n');
    const existingText = existingStat && existingStat.kind === 'text' ? (await vfsReadFile(normalizedTarget, cwd)) || '' : '';
    const nextValue = append
      ? (existingText && output ? existingText + '\n' + output : existingText + output)
      : output;
    try {
      return await vfsWriteFile(normalizedTarget, nextValue, cwd);
    } catch (err) {
      throw new Error(err.code === 'ENOSPC' ? 'Disk full. Nothing was written.'
        : err.code === 'EACCES' ? 'Storage is unavailable. Nothing was written.'
        : 'Write failed: ' + err.message);
    }
  }

  async function tryExecutePipeline(raw) {
    const parsed = parseShellLine(raw);
    if (!parsed || (!parsed.redirectOp && parsed.stages.length < 2)) return false;
    if (!parsed.stages.length) {
      print('Invalid command pipeline.', '#ff4444');
      print('');
      return true;
    }
    try {
      let stream = null;
      let consumedBySink = false;
      for (let i = 0; i < parsed.stages.length; i++) {
        const { cmd, args } = getCommandParts(parsed.stages[i]);
        if (!cmd) throw new Error('Invalid command pipeline.');
        const isLastStage = i === parsed.stages.length - 1;
        if (isLastStage && (cmd === 'notepad' || cmd === 'notepad.exe')) {
          const content = Array.isArray(stream) ? stream.join('\n') : '';
          const target = args.trim();
          if (target) {
            const saved = await writePipelineOutput(target, Array.isArray(stream) ? stream : [], false);
            print(`Opening ${saved.fileName} in Notepad...`);
            procSetTimeout('terminal', () => openNotepad(saved.fileName, saved.dirName), 300);
          } else {
            print('Opening piped output in Notepad...');
            procSetTimeout('terminal', () => openNotepad(undefined, cwd, { initialContent: content }), 300);
          }
          consumedBySink = true;
          break;
        }
        const result = await runPipeStage(cmd, args, stream);
        if (!result) throw new Error('Piping not supported for command: ' + cmd.toUpperCase());
        stream = result;
      }
      if (parsed.redirectOp) {
        if (consumedBySink) throw new Error('Cannot redirect output after piping into Notepad.');
        const saved = await writePipelineOutput(parsed.redirectTarget, Array.isArray(stream) ? stream : [], parsed.redirectOp === '>>');
        print(`${parsed.redirectOp === '>>' ? 'Appended' : 'Wrote'}: ${saved.fileName}`);
      } else if (!consumedBySink) {
        (stream || []).forEach(line => print(line));
      }
    } catch (err) {
      print(err.message || String(err), '#ff4444');
    }
    print('');
    return true;
  }

  const CMDS = {
    type: (args) => CMDS.cat(args),
    cd: (args) => {
      const dest = (args || '').trim();
      if (!dest || dest === '.' || dest === 'C:\\sleepOS' || dest === '\\') {
        cwd = ''; updatePrompt(); return;
      } else if (dest === '..') {
        if (!cwd) { print('Already at root.'); return; }
        const i = cwd.lastIndexOf('\\'); cwd = i >= 0 ? cwd.slice(0, i) : ''; updatePrompt(); return;
      } else {
        const rawNewCwd = cwd ? cwd + '\\' + dest.toUpperCase() : dest.toUpperCase();
        if (vfsDirExistsSync(rawNewCwd)) { cwd = vfsNormalizeDir(rawNewCwd); updatePrompt(); }
        else { print(`The system cannot find the path specified: ${dest}`); }
      }
    },
    mkdir: async (args) => {
      if (!args) { print('Usage: MKDIR [name]'); return; }
      const name = args.trim().toUpperCase();
      if (['PROJECTS','DOCS','.','..'].includes(name)) {
        print(`A subdirectory or file ${name} already exists.`); return;
      }
      let result;
      try {
        result = await vfsMkdir(name, cwd);
      } catch (err) {
        print(err.code === 'ENOSPC' ? 'Disk full. Nothing was written.'
            : err.code === 'EACCES' ? 'Storage is unavailable. Nothing was written.'
            : 'Write failed: ' + err.message, '#ff4444');
        return;
      }
      if (!result.created) { print(`A subdirectory or file ${name} already exists.`); return; }
      print(`Directory created: ${getPromptStr().replace('>','')}\\${name}`);
    },
    touch: async (args) => {
      if (!args) { print('Usage: TOUCH [filename]'); return; }
      const name = args.trim();
      const st = vfsStatSync(name, cwd);
      if (st && st.kind === 'text') { print(`File already exists: ${name}`); return; }
      try {
        await vfsWriteFile(name, '', cwd);
      } catch (err) {
        print(err.code === 'ENOSPC' ? 'Disk full. Nothing was written.'
            : err.code === 'EACCES' ? 'Storage is unavailable. Nothing was written.'
            : 'Write failed: ' + err.message, '#ff4444');
        return;
      }
      print(`Created: ${name}`);
    },
    del: async (args) => {
      const raw = (args || '').trim();
      if (!raw) { print('Usage: DEL [filename]'); return; }
      const result = await deleteVirtualPath(raw, cwd);
      if (!result.ok) print(result.message || `Cannot delete ${raw}`, '#ff4444');
      (result.details || []).forEach(line => print(line, result.ok ? undefined : '#dddd00'));
    },
    rm: (args) => CMDS.del(args),
    copy: (args) => {
      const parts = (args || '').trim().split(/\s+/);
      if (parts.length < 2) { print('Usage: COPY [source] [destination]'); return; }
      print(`Copying '${parts[0]}' to '${parts[1]}'...`);
      procSetTimeout('terminal', () => {
        print('1 file(s) copied.');
        print(`WARNING: The copy is not identical to the original.`);
        print('This is considered normal.');
      }, 700);
    },
    move: (args) => {
      if (!args) { print('Usage: MOVE [source] [destination]'); return; }
      print('Move failed.', '#ff4444');
      print('Files in sleepOS cannot be moved.');
      print('They are already where they need to be.');
    },
    mv: (args) => CMDS.move(args),
    taskkill: (args) => {
      const pidStr = (args || '').replace(/\D/g,'');
      if (!pidStr) { print('Usage: TASKKILL <pid>'); return; }
      const pid = parseInt(pidStr, 10);
      if (pid === 512) {
        const result = killSoulDaemonProcess();
        print(result.message, result.ok ? undefined : '#ff4444');
        (result.details || []).forEach(line => print(line, result.ok ? undefined : '#dddd00'));
        return;
      }
      const builtIn = findBuiltInProcess(pid);
      if (builtIn) {
        print(`Terminating ${builtIn.name} (PID ${pid})...`);
        print(`ERROR: Access is denied. (PID ${pid})`, '#ff4444');
        print('System processes cannot be terminated.');
        return;
      }
      // Look up the real window through the kernel table - pids are real now,
      // not a hash of the window id, so this is a table lookup rather than a guess.
      const proc = kernelGetProcess(pid);
      const winId = proc && proc.winId;
      if (winId && wins[winId]) {
        const name = wins[winId].title.split(' \u2014')[0].trim();
        print(`Terminating ${name} (PID ${pid})...`);
        procSetTimeout('terminal', () => {
          closeWin(winId);
          print(`SUCCESS: Process "${name}" (PID ${pid}) terminated.`);
        }, 400);
      } else {
        print(`ERROR: The process with PID ${pid} was not found.`, '#ff4444');
      }
    },
    cat: async (args) => {
      const raw = (args||'').trim();
      if (!raw) { print('Usage: CAT <file>'); return; }
      const { dirName, fileName } = vfsSplitPath(raw, cwd);
      const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
      if (upperPath === 'DAEMON.CORE') {
        daemonActivate('raw');
        buildDaemonCoreRawContent().split('\n').forEach(line => print(line));
        return;
      }
      if (upperPath === 'VOID.TMP' && !daemonStory.endingReached) {
        daemonRecordInvestigation('void');
        getVoidTmpContent().split('\n').forEach(line => print(line));
        return;
      }
      const st = vfsStatSync(raw, cwd);
      if (!st || st.type !== 'file') {
        print('File not found: ' + raw);
        return;
      }
      if (upperPath === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
      if (upperPath === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
      if (st.kind === 'blob') {
        print(`Binary file: ${st.name} (${st.blob.kind}, ${fmtSize(st.blob.size)})`);
        print(`Use OPEN ${st.name} to view it.`);
        return;
      }
      const text = await vfsReadFile(raw, cwd);
      if (text === '') {
        print('(empty file)');
        return;
      }
      (text || '').split('\n').forEach(line => print(line));
    },
    open: (args) => {
      const raw = (args || '').trim();
      if (!raw) { print('Usage: OPEN [filename]'); return; }
      const split = vfsSplitPath(raw, cwd);
      if (isVisibleSystemPath(raw, { includeExplorer: true })) {
        print(`Opening ${split.fileName}...`);
        procSetTimeout('terminal', () => openSystemFile(split.fileName), 300);
        return;
      }
      const st = vfsStatSync(raw, cwd);
      if (st && st.kind === 'blob') {
        print(`Opening ${raw}...`);
        procSetTimeout('terminal', () => openMediaFile(raw, cwd), 300);
      } else if (st && st.kind === 'text') {
        print(`Opening ${raw}...`);
        procSetTimeout('terminal', () => openNotepad(raw, cwd), 300);
      } else {
        print(`File not found: ${raw}`);
        print('Use DIR to list available files.');
      }
    },
    notepad: (args) => {
      const fname = args ? args.trim() : null;
      if (fname) {
        const st = vfsStatSync(fname, cwd);
        if (!st || st.kind !== 'text') { print(`File not found: ${fname}`); return; }
      }
      print(fname ? `Opening ${fname} in Notepad...` : 'Opening Notepad...');
      procSetTimeout('terminal', () => openNotepad(fname || undefined, cwd), 300);
    },
    grep: async (args) => {
      if (!args) { print('Usage: GREP <pattern> <file>'); return; }
      const parts = args.match(/^("(?:[^"\\]|\\.)*"|[^\s]+)\s+(.+)$/);
      if (!parts) { print('Usage: GREP <pattern> <file>'); return; }
      const pattern = parts[1].replace(/^"|"$/g,'');
      const fname = parts[2].trim();
      let re;
      try { re = new RegExp(pattern, 'i'); } catch(e) { print('Invalid regex: ' + pattern, '#ff4444'); return; }
      const st = vfsStatSync(fname, cwd);
      if (!st || st.kind !== 'text') { print('File not found: ' + fname); return; }
      const content = (await vfsReadFile(fname, cwd)) || '';
      const lines = content.split('\n');
      let matches = 0;
      lines.forEach((line, i) => {
        if (re.test(line)) { print((i+1) + ':' + line); matches++; }
      });
      if (matches === 0) print('(no matches)');
      else print('\n' + matches + ' match' + (matches !== 1 ? 'es' : '') + ' found');
    },
    wc: async (args) => {
      const fname = (args || '').trim();
      if (!fname) { print('Usage: WC <file>'); return; }
      const st = vfsStatSync(fname, cwd);
      if (!st || st.kind !== 'text') { print('File not found: ' + fname); return; }
      const content = (await vfsReadFile(fname, cwd)) || '';
      const lines = content.split('\n').length;
      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      const bytes = new TextEncoder().encode(content).length;
      print(`  ${String(lines).padStart(6)}  ${String(words).padStart(6)}  ${String(bytes).padStart(6)}  ${fname}`);
    },
    exit: () => closeWin('terminal'),
  };

  CMDS.help = () => buildHelpLines().forEach(line => print(line));
  CMDS.dir = (args) => buildDirLines(args).forEach(line => print(line));
  CMDS.ls = (args) => CMDS.dir(args);
  CMDS.ps = () => buildPsLines().forEach(line => print(line));
  CMDS.ver = () => buildVerLines().forEach(line => print(line));
  CMDS.who = () => buildWhoLines().forEach(line => print(line));
  CMDS.whoami = () => CMDS.who();
  CMDS.date = () => buildDateLines().forEach(line => print(line));
  CMDS.ping = async (args) => {
    (await buildPingLines(resolveShellText(args), getCurrentCommandSignal())).forEach(line => print(line));
  };
  CMDS.ipconfig = () => buildIpconfigLines().forEach(line => print(line));
  CMDS.tree = () => buildTreeLines().forEach(line => print(line));
  CMDS.sleep = async (args) => {
    await scriptSleep(parseTerminalDelayMs(args), getCurrentCommandSignal());
  };
  CMDS.wait = (args) => CMDS.sleep(args);
  CMDS.echo = (args) => { print(unquoteShellValue(args || '')); };
  CMDS.print = (args) => CMDS.echo(args);
  CMDS.cls = () => { out.innerHTML = ''; };
  CMDS.clear = () => CMDS.cls();
  CMDS.set = (args) => applyShellSet(args).forEach(line => print(line));
  CMDS.env = () => buildEnvLines().forEach(line => print(line));
  CMDS.where = (args) => buildWhereLines(args).forEach(line => print(line));
  CMDS.path = (args) => applyShellPath(args).forEach(line => print(line));
  CMDS.input = async (args) => {
    await runShellInputCommand(args);
  };
  CMDS.inc = (args) => runShellNumericCommand('inc', args).forEach(line => print(line));
  CMDS.dec = (args) => runShellNumericCommand('dec', args).forEach(line => print(line));
  CMDS.add = (args) => runShellNumericCommand('add', args).forEach(line => print(line));
  CMDS.sub = (args) => runShellNumericCommand('sub', args).forEach(line => print(line));
  CMDS.mul = (args) => runShellNumericCommand('mul', args).forEach(line => print(line));
  CMDS.div = (args) => runShellNumericCommand('div', args).forEach(line => print(line));
  CMDS.mod = (args) => runShellNumericCommand('mod', args).forEach(line => print(line));
  CMDS.start = (args) => {
    if (!args || !String(args).trim()) { print('Usage: START [program]'); return; }
    if (!launchTerminalTarget(args)) print(`Cannot find program: ${args}`);
  };
  CMDS.run = async (args) => {
    const tokens = scriptTokenize(args || '');
    if (!tokens.length) { print('Usage: RUN <script.script> [args...]'); return; }
    const fname = tokens[0];
    const st = vfsStatSync(fname, cwd);
    if (!st || st.kind !== 'text') { print(`Script not found: ${fname}`, '#ff4444'); return; }
    print(`Running ${fname}...`);
    const text = await vfsReadFile(fname, cwd);
    const exitCode = await execScript(text, print, {
      fs: makeVfsScriptFs(),
      sourceName: st.name,
      dirName: st.dirName,
      vars: shellVars,
      readLine: readTerminalLine,
      signal: getCurrentCommandSignal(),
      args: tokens.slice(1),
      clearFn: () => { out.innerHTML = ''; },
    });
    if (exitCode !== 0) print(`Exit code: ${exitCode}`, '#dddd00');
  };

  CMDS.spawn = async (args) => {
    const tokens = scriptTokenize(args || '');
    if (!tokens.length) { print('Usage: SPAWN <script.script> [args...]'); return; }
    try {
      const pid = await kernelSpawn(tokens[0], tokens.slice(1), {
        cwd,
        parentPid: kernelPidForWin('terminal'),
        onStdout: line => print(line),
        onStderr: line => print(line, '#ff4444'),
      });
      print(`[${pid}] ${tokens[0]}`);
    } catch (err) {
      print(err.code === 'ENOENT' ? `Script not found: ${tokens[0]}` : err.message, '#ff4444');
    }
  };

  CMDS.kill = (args) => {
    const parts = (args || '').trim().split(/\s+/).filter(Boolean);
    const force = parts.some(p => p.toLowerCase() === '/f' || p === '-9');
    const pid = parseInt(parts.find(p => /^\d+$/.test(p)), 10);
    if (!pid) { print('Usage: KILL <pid> [/F]'); return; }
    const denial = buildKillDenialMessage(pid);
    if (denial) { print(denial, '#ff4444'); return; }
    const proc = kernelGetProcess(pid);
    if (!proc) { print(`No such process: ${pid}`, '#ff4444'); return; }
    // kernelSignal reports whether it actually did anything - pid 1 (the
    // kernel) and any system process with no window return false, and this
    // must not print a success line it did not earn.
    const ok = kernelSignal(pid, force ? 'SIGKILL' : 'SIGTERM');
    if (!ok) { print(`Access denied: PID ${pid} cannot be terminated.`, '#ff4444'); return; }
    print(`[${pid}] ${force ? 'killed' : 'terminated'}`);
  };

  async function runTerminalCommand(raw, options) {
    if (activeCommandController) {
      print('A command is already running. Press Ctrl+C to interrupt.', '#dddd00');
      print('');
      return;
    }
    const text = String(raw || '').trim();
    options = options || {};
    activeCommandController = new AbortController();
    refreshTerminalInputMode();
    histIdx = -1;
    print(getPromptStr() + ' ' + text);
    if (text && options.recordHistory !== false) {
      cmdHistory.push(text);
      if (cmdHistory.length > 50) cmdHistory.shift();
    }
    try {
      if (await tryExecutePipeline(text)) return;

      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = resolveShellText(parts.slice(1).join(' '));
      const exeAlias = cmd.endsWith('.exe') ? cmd.slice(0, -4) : '';

      if ((cmd === 'del' || cmd === 'rm') && args.includes('*')) {
        const expanded = expandGlob(args.trim());
        // Sequential: DEL prints a line per file, and a parallel run would
        // interleave those with each other and with the blank line below.
        for (const name of expanded) await CMDS.del(name);
        print('');
        return;
      }

      if (!cmd) {
        // no-op
      } else if (CMDS[cmd]) {
        await CMDS[cmd](args);
      } else if (!args && launchTerminalTarget(parts[0])) {
        // A bare name ending in .exe is unambiguously asking to run a
        // program, so it goes through PATH resolution first.
      } else if (exeAlias && CMDS[exeAlias] && (args || !programFindAnywhere(parts[0]))) {
        // Whether the trailing alias branch may still catch a PATH miss
        // depends on whether the name is a real program at all, not just on
        // whether the launcher branch above fired.
        //   - A name WITH arguments (NOTEPAD.exe README.txt) always reaches
        //     here directly - the registry launcher takes no arguments, so
        //     this was never PATH-gated to begin with.
        //   - A bare name whose launcher attempt above failed reaches here
        //     only if programFindAnywhere says it isn't a real program (DIR,
        //     HELP, VER, DATE, ... have no registry entry - there is nothing
        //     for PATH to govern, so DIR.exe keeps working exactly like
        //     bare DIR always has). If it IS a real program (NOTEPAD.exe),
        //     the failed PATH lookup is the final answer and must not fall
        //     back to the same-named builtin - an earlier version of this
        //     reorder let that fallback stay unconditional, so a PATH-denied
        //     NOTEPAD.exe kept opening Notepad anyway, reintroducing the
        //     exact bug this reorder exists to fix.
        await CMDS[exeAlias](args);
      } else {
        print(`'${parts[0]}' is not recognized as an internal or external command.`);
        // A player who narrows PATH and then gets a generic "not recognized"
        // concludes the OS is broken rather than that they changed it. Naming
        // the directory the program is actually in is the whole payoff for
        // making PATH real, so it is not an optional nicety.
        const elsewhere = programFindAnywhere(resolveShellText(parts[0]).trim());
        if (elsewhere) {
          print(`${elsewhere.program.name} exists in ${programDisplayDir(elsewhere.dir)}, which is not on PATH.`);
        } else {
          print('Type HELP for a list of commands, or DIR to list executables.');
        }
      }
    } catch (err) {
      if (!isAbortError(err)) print(err.message || String(err), '#ff4444');
    } finally {
      activeCommandController = null;
      refreshTerminalInputMode();
    }
    print('');
  }

  _termExec = async (raw) => {
    if (pendingRead) {
      print('Finish the current INPUT prompt before starting another command.', '#ff4444');
      print('');
      return;
    }
    if (activeCommandController) {
      print('A command is already running. Press Ctrl+C to interrupt.', '#dddd00');
      print('');
      return;
    }
    await runTerminalCommand(raw, { recordHistory: true });
  };

  inp.addEventListener('keydown', async (e) => {
    if (pendingRead) {
      if (e.ctrlKey && !e.altKey && !e.metaKey && String(e.key).toLowerCase() === 'c') {
        if (interruptActiveCommand()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const response = inp.value;
        const { promptText, resolve } = pendingRead;
        inp.value = '';
        pendingRead = null;
        setPromptOverride('');
        refreshTerminalInputMode();
        print(promptText + ' ' + response);
        resolve(response);
      }
      return;
    }

    if (e.ctrlKey && !e.altKey && !e.metaKey && String(e.key).toLowerCase() === 'c') {
      if (interruptActiveCommand()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (histIdx < cmdHistory.length - 1) histIdx++;
      inp.value = cmdHistory[cmdHistory.length - 1 - histIdx] || '';
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      histIdx = Math.max(-1, histIdx - 1);
      inp.value = histIdx < 0 ? '' : cmdHistory[cmdHistory.length - 1 - histIdx];
      return;
    }

    if (e.key !== 'Enter') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if (activeCommandController) {
      print('A command is already running. Press Ctrl+C to interrupt.', '#dddd00');
      print('');
      return;
    }

    const raw = inp.value.trim();
    inp.value = '';
    await runTerminalCommand(raw, { recordHistory: true });
  }, true);

  refreshTerminalInputMode();
  document.getElementById('tw').addEventListener('click', () => inp.focus());
  procSetTimeout('terminal', () => inp.focus(), 80);
  if (initialCommand) procSetTimeout('terminal', () => { if (_termExec) _termExec(initialCommand); }, 30);
}

function openSysmon() {
  if (!mkWin({ id:'sysmon', title:'SYSMON.exe - System Monitor', icon:'icon:sysmon', w:460, h:400, x:160, y:80 })) return;
  const mb   = document.getElementById('mb-sysmon');
  const body = document.getElementById('wb-sysmon');
  body.style.cssText = 'background:#c0c0c0;overflow:hidden;display:flex;flex-direction:column;';

  // Two meters, both measured. The six flavor meters that used to sit here
  // were a random walk wearing a percentage sign, and a system monitor is the
  // one place that fiction cannot live. They were deleted rather than
  // relocated: a meter that exists only to be invented has no honest home.
  //
  // There is deliberately no RAM bar. Summing interpreter bytes and DOM nodes
  // produces a quantity that means nothing, and no meter beats an incoherent
  // one.
  const METRICS = [
    { key: 'cpu',  label: 'CPU Usage', color: '#000080' },
    { key: 'disk', label: 'Disk Used', color: '#000080' },
  ];

  let updateInterval = 1500;
  let showSysProcs   = true;
  let activeTab      = 'resources';
  let selectedProc   = null;
  let smTimer        = null;
  // The probe's per-app percentages. instWindowSample RESETS the window as a
  // side effect, so the result has to be held here: renderProcesses runs later
  // in the same tick and would otherwise find the totals already cleared.
  let lastCpuSample = new Map();

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;border-bottom:2px solid #808080;background:#c0c0c0;flex-shrink:0;padding:3px 4px 0;gap:2px;';
  function makeTabBtn(label, key) {
    const t = document.createElement('button');
    t.textContent = label; t.dataset.tab = key;
    t.style.cssText = 'background:#c0c0c0;border:1px solid;border-color:#fff #808080 #808080 #fff;border-bottom:none;padding:2px 12px;font-size:11px;cursor:default;font-family:var(--sleep-font);position:relative;bottom:-1px;';
    t.addEventListener('click', () => switchTab(key));
    tabBar.appendChild(t); return t;
  }
  const tabRes  = makeTabBtn('Resources', 'resources');
  const tabProc = makeTabBtn('Processes', 'processes');
  body.appendChild(tabBar);

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow:hidden;position:relative;';
  body.appendChild(content);

  // Resources panel
  const resPanel = document.createElement('div');
  resPanel.style.cssText = 'position:absolute;inset:0;overflow:auto;padding:6px 6px 4px;';
  resPanel.innerHTML = METRICS.map(m => `
    <div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
      <div style="width:112px;font-size:10px;white-space:nowrap;">${m.label}</div>
      <div style="flex:1;height:14px;border:1px solid;border-color:#808080 #fff #fff #808080;background:#fff;position:relative;min-width:60px;">
        <div id="smbar-${m.key}" style="position:absolute;inset:0;right:auto;width:0%;background:${m.color || '#000080'};"></div>
      </div>
      <div id="smval-${m.key}" style="width:30px;font-size:10px;text-align:right;">-</div>
    </div>`).join('') + `
    <div style="margin-top:6px;padding:3px 0 0;font-size:10px;color:#444;border-top:1px solid #b0b0b0;">
      <b>Processes:</b> <span id="sm-proc-count">--</span> running &nbsp;|&nbsp; <b>Uptime:</b> <span id="sm-uptime">--:--:--</span>
    </div>`;
  content.appendChild(resPanel);

  // Processes panel
  const procPanel = document.createElement('div');
  procPanel.style.cssText = 'position:absolute;inset:0;overflow:hidden;display:none;flex-direction:column;';
  const btnStyle = 'background:#c0c0c0;border:1px solid;border-color:#fff #808080 #808080 #fff;padding:2px 10px;font-size:10px;cursor:default;font-family:var(--sleep-font);';
  const procToolbar = document.createElement('div');
  procToolbar.style.cssText = 'padding:3px 4px;display:flex;gap:3px;border-bottom:1px solid #808080;flex-shrink:0;';
  procToolbar.innerHTML = `
    <button id="sm-kill-btn"    style="${btnStyle}">End Task</button>
    <button id="sm-copypid-btn" style="${btnStyle}">Copy PID</button>
    <button id="sm-refresh-btn" style="${btnStyle}">Refresh</button>`;
  procPanel.appendChild(procToolbar);
  const procHeader = document.createElement('div');
  procHeader.style.cssText = 'display:flex;background:#c0c0c0;border-bottom:1px solid #808080;font-size:10px;font-weight:bold;flex-shrink:0;';
  procHeader.innerHTML = `
    <div style="width:54px;padding:2px 4px;border-right:1px solid #808080;">PID</div>
    <div style="flex:1;padding:2px 4px;border-right:1px solid #808080;">Image Name</div>
    <div style="width:52px;padding:2px 4px;border-right:1px solid #808080;">CPU %</div>
    <div style="width:96px;padding:2px 4px;">Mem</div>`;
  procPanel.appendChild(procHeader);
  const procList = document.createElement('div');
  procList.style.cssText = 'flex:1;overflow-y:auto;background:#fff;';
  procPanel.appendChild(procList);
  content.appendChild(procPanel);

  function getProcessList() {
    // Phase 5b deleted the story rows' authored cpu/mem, so there is nothing
    // left to jitter: a story process has no window and no interpreter, so it
    // has no measurable execution context and reports null like any other
    // unmeasured row. Real (kernel-table) rows carry their measured cpu/mem
    // straight through from buildProcessRows.
    return buildProcessRows().filter(p => showSysProcs || !p.isStory);
  }

  function renderProcesses() {
    if (!wins['sysmon']) return;
    const procs = getProcessList();
    procList.innerHTML = '';
    procs.forEach(p => {
      const sel = selectedProc && selectedProc.pid === p.pid;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;font-size:10px;border-bottom:1px solid #f0f0f0;cursor:default;background:${sel ? '#000080' : 'transparent'};color:${sel ? '#fff' : '#000'};`;
      let mem = p.mem, memUnit = p.memUnit;
      // A script row's mem/memUnit come straight through from
      // buildProcessRows (interpreter-tracked bytes). An app row measures
      // nothing there - its cost is the DOM subtree of its own window, and
      // that's the OS layer's business, not process-view.js's, so it's
      // counted here at render time.
      if (mem === null && p.winId && wins[p.winId] && wins[p.winId].el) {
        mem = wins[p.winId].el.getElementsByTagName('*').length + 1;
        memUnit = 'nodes';
      }
      // Three cases, and the difference between the last two is the point of
      // this phase. A worker reports interpreter-measured CPU. An app has a
      // live window, so it IS measurable - if the probe recorded nothing this
      // window it was genuinely idle, which is 0.0, not "unmeasurable". A row
      // with no window and no interpreter has no execution context at all, and
      // only that reads as a dash.
      let cpu = p.cpu;
      if (cpu === null && p.winId && wins[p.winId]) {
        cpu = lastCpuSample.get(p.pid) || 0;
      }
      const cpuText = cpu === null ? '-' : cpu.toFixed(1);
      // Each cell carries its own unit because the two process classes report
      // genuinely different things: a script reports interpreter-tracked bytes,
      // an app reports the node count of its window subtree. Neither is heap
      // and the column header claims neither.
      const memText = mem === null ? '-'
        : memUnit === 'nodes' ? mem.toLocaleString() + ' nodes'
        : (mem / 1024).toFixed(1) + ' KB';
      row.innerHTML = `<div style="width:54px;padding:1px 4px;border-right:1px solid #e8e8e8;">${p.pid}</div><div style="flex:1;padding:1px 4px;border-right:1px solid #e8e8e8;overflow:hidden;white-space:nowrap;">${p.name}</div><div style="width:52px;padding:1px 4px;border-right:1px solid #e8e8e8;">${cpuText}</div><div style="width:96px;padding:1px 4px;">${memText}</div>`;
      row.addEventListener('click', () => { selectedProc = p; renderProcesses(); });
      row.addEventListener('contextmenu', e => {
        e.preventDefault();
        selectedProc = p;
        renderProcesses();
        showCtxMenu(e.clientX, e.clientY, [
          { label: 'End Task', action: () => procToolbar.querySelector('#sm-kill-btn').click() },
          '-',
          { label: 'Copy PID', action: () => procToolbar.querySelector('#sm-copypid-btn').click() },
        ]);
      });
      procList.appendChild(row);
    });
    const ct = document.getElementById('sm-proc-count');
    if (ct) ct.textContent = procs.length;
  }

  procToolbar.querySelector('#sm-kill-btn').addEventListener('click', () => {
    if (!selectedProc) return;
    const action = endProcessAction(selectedProc);
    if (action === 'story') {
      if (selectedProc.pid === 512) {
        const result = killSoulDaemonProcess();
        selectedProc = null;
        renderProcesses();
        osAlert([result.message, ...(result.details || [])].filter(Boolean).join('\n'), result.ok ? 'Process Update' : 'Access Denied', 'icon:warning');
        return;
      }
      const dlgId = 'sm-killerr-' + Date.now();
      if (mkWin({ id:dlgId, title:'Access Denied', icon:'icon:warning', w:290, h:110, popup:true, menubar:false, statusbar:false })) {
        const db = document.getElementById('wb-' + dlgId);
        if (db) { db.style.cssText = 'padding:12px 14px;font-size:11px;'; db.innerHTML = `<p style="margin-bottom:10px;">Unable to terminate system process.<br><b>Access Denied</b> (PID: ${selectedProc.pid})</p><div style="text-align:center"><button style="${btnStyle}" onclick="closeWin('${dlgId}')">OK</button></div>`; }
      }
      return;
    }
    if (action === 'refused') {
      // kernelSignal said no - the kernel process itself (pid 1), or a
      // process that already exited between this row rendering and the
      // click landing. Match the terminal's KILL wording for the identical
      // case (apps/terminal.js) so the two surfaces agree about what
      // happened, instead of this button quietly doing nothing.
      osAlert(`Access denied: PID ${selectedProc.pid} cannot be terminated.`, 'Access Denied', 'icon:warning');
      return;
    }
    // action is 'closed' or 'signalled': endProcessAction already told the
    // window manager or the kernel what to do.
    selectedProc = null;
    renderProcesses();
  });
  procToolbar.querySelector('#sm-copypid-btn').addEventListener('click', () => {
    if (!selectedProc) return;
    navigator.clipboard.writeText(String(selectedProc.pid)).catch(() => {});
    const btn = procToolbar.querySelector('#sm-copypid-btn');
    const orig = btn.textContent; btn.textContent = 'Copied!';
    procSetTimeout('sysmon', () => { btn.textContent = orig; }, 800);
  });
  procToolbar.querySelector('#sm-refresh-btn').addEventListener('click', renderProcesses);

  function switchTab(tab) {
    activeTab = tab;
    if (tab === 'resources') {
      resPanel.style.display = 'block'; procPanel.style.display = 'none';
      tabRes.style.background = '#fff'; tabRes.style.borderColor = '#fff #808080 #c0c0c0 #fff';
      tabProc.style.background = '#c0c0c0'; tabProc.style.borderColor = '#fff #808080 #808080 #fff';
    } else {
      resPanel.style.display = 'none'; procPanel.style.display = 'flex';
      tabRes.style.background = '#c0c0c0'; tabRes.style.borderColor = '#fff #808080 #808080 #fff';
      tabProc.style.background = '#fff'; tabProc.style.borderColor = '#fff #808080 #c0c0c0 #fff';
      renderProcesses();
    }
  }
  switchTab('resources');

  mb.innerHTML = '';
  const viewSpan = document.createElement('span'); viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
  viewSpan.addEventListener('click', e => { e.stopPropagation(); showDropdown(viewSpan, [
    { label: 'Update Speed: Fast (0.5s)',   action: () => { updateInterval = 500;  restartSmTimer(); } },
    { label: 'Update Speed: Normal (1.5s)', action: () => { updateInterval = 1500; restartSmTimer(); } },
    { label: 'Update Speed: Slow (3s)',     action: () => { updateInterval = 3000; restartSmTimer(); } },
    { label: 'Update Speed: Paused',        action: () => { updateInterval = 0;    restartSmTimer(); } },
    '-',
    { label: 'Resources Tab', action: () => switchTab('resources') },
    { label: 'Processes Tab', action: () => switchTab('processes') },
  ]); });
  mb.appendChild(viewSpan);
  const optSpan = document.createElement('span'); optSpan.className = 'menu-item'; optSpan.textContent = 'Options';
  optSpan.addEventListener('click', e => { e.stopPropagation(); showDropdown(optSpan, [
    { label: (showSysProcs ? '\u2713 ' : '  ') + 'Show System Processes', action: () => { showSysProcs = !showSysProcs; if (activeTab === 'processes') renderProcesses(); } },
    '-',
    { label: 'Close', action: () => closeWin('sysmon') },
  ]); });
  mb.appendChild(optSpan);

  body.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { label: 'Resources', action: () => switchTab('resources') },
      { label: 'Processes', action: () => switchTab('processes') },
      '-',
      { label: updateInterval === 0 ? '\u25b6 Resume' : '\u23f8 Pause', action: () => { updateInterval = updateInterval === 0 ? 1500 : 0; restartSmTimer(); } },
      '-',
      { label: 'Close', action: () => closeWin('sysmon') },
    ]);
  });

  function smTick() {
    if (!wins['sysmon']) { clearInterval(smTimer); return; }
    lastCpuSample = instWindowSample(performance.now());
    let cpuTotal = 0;
    lastCpuSample.forEach(function (pct) { cpuTotal += pct; });
    getProcessList().forEach(function (p) {
      if (p.cpu != null) cpuTotal += p.cpu;
    });
    cpuTotal = Math.min(100, cpuTotal);

    const backend = typeof vfsGetBackend === 'function' ? vfsGetBackend() : null;
    const sb = backend && backend._superblock;
    const diskPct = sb
      ? ((sb.totalBlocks - fsCountFreeBlocks(sb)) / sb.totalBlocks) * 100
      : null;

    const values = { cpu: cpuTotal, disk: diskPct };
    METRICS.forEach(function (m) {
      const v = values[m.key];
      const bar = document.getElementById('smbar-' + m.key);
      const val = document.getElementById('smval-' + m.key);
      // A null reading renders as a dash, never as 0%. The superblock is
      // briefly absent after a failed write transaction discards it, and
      // painting 0% there would be a fabricated number.
      if (bar) { bar.style.width = (v == null ? 0 : v).toFixed(0) + '%'; bar.style.background = m.color; }
      if (val) { val.textContent = v == null ? '-' : v.toFixed(0) + '%'; }
    });
    const sec = Math.floor(performance.now() / 1000);
    const up = document.getElementById('sm-uptime');
    if (up) up.textContent = `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    const ct = document.getElementById('sm-proc-count');
    if (ct) ct.textContent = getProcessList().length;
    if (activeTab === 'processes') renderProcesses();
  }

  function restartSmTimer() {
    if (smTimer) clearInterval(smTimer);
    smTimer = null;
    if (updateInterval > 0) smTimer = procSetInterval('sysmon', smTick, updateInterval);
    if (wins['sysmon']) wins['sysmon']._interval = smTimer;
  }

  // Open the first window now so the first tick measures a real interval
  // rather than dividing by the time since page load.
  instWindowOpen(performance.now());
  restartSmTimer();
}

function openDefrag() {
  if (!mkWin({ id:'defrag', title:'DEFRAG.exe - Disk Defragmenter', icon:'icon:defrag', w:680, h:520, x:100, y:60 })) return;

  const mb   = document.getElementById('mb-defrag');
  const body = document.getElementById('wb-defrag');
  const ws   = document.getElementById('ws-defrag');
  body.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:5px;font-size:11px;overflow:hidden;';

  // One cell per block. 128x32 = 4096, matching FS_IDB_TOTAL_BLOCKS. The grid
  // area is wide and short (roughly 664x378 in a 680x520 window), so this
  // gives a 5x11px cell; a square 64x64 would give 8x3 and disappear after the
  // 1px inset.
  const COLS = 128, ROWS = 32, TOTAL = COLS * ROWS;
  // 0 = free, 1 = allocated, 2 = moving right now.
  const CELL_FREE = 0, CELL_USED = 1, CELL_MOVING = 2;
  const FREE_COLOR = '#ffffff', MOVING_COLOR = '#cc2200';

  const lastDefragTs = Math.max(0, Math.trunc(Number(defragState.lastDefragTs) || 0));
  const msSince = lastDefragTs ? Date.now() - lastDefragTs : null;
  const fragLevel = getDriveFragmentationLevel();

  // Which inode owns each block, so a contiguous file reads as one solid band
  // and a scattered one reads as speckle. That is what makes fragmentation
  // legible as a shape, which matters now that the number rounds to 0% in
  // almost every state.
  let cells = new Uint8Array(TOTAL);
  let owners = new Int32Array(TOTAL).fill(-1);

  // Hue derived arithmetically rather than from a palette: the file count is
  // unbounded, and 137.5 degrees is the golden angle, which keeps consecutive
  // inodes visually distinct instead of walking slowly around the wheel.
  function dfInodeHue(ino) { return (ino * 137.508) % 360; }

  async function dfReadDiskCells() {
    const backend = typeof vfsGetBackend === 'function' ? vfsGetBackend() : null;
    if (!backend || typeof backend._readInodeEntries !== 'function') return false;
    const sb = backend._superblock;
    if (!sb) return false;
    const next = new Uint8Array(TOTAL);
    const nextOwners = new Int32Array(TOTAL).fill(-1);
    const limit = Math.min(TOTAL, sb.totalBlocks);
    for (let i = 0; i < limit; i++) next[i] = fsBitGet(sb.freeBitmap, i) ? CELL_USED : CELL_FREE;
    (await backend._readInodeEntries()).forEach(([ino, inode]) => {
      (inode && inode.blocks || []).forEach(b => { if (b >= 0 && b < TOTAL) nextOwners[b] = ino; });
    });
    cells = next; owners = nextOwners;
    return true;
  }

  function timeAgo(ms) {
    if (!ms) return 'never';
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr${h !== 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
  }

  const initOptPct = getDriveOptimizationPercent();
  const initFragPct = Math.round(fragLevel * 100);

  // ── Drive info ─────────────────────────────────────────────────
  function dfDriveText() {
    const backend = typeof vfsGetBackend === 'function' ? vfsGetBackend() : null;
    const sb = backend && backend._superblock;
    if (!sb) return { capacity: '-', free: '-' };
    return {
      capacity: fmtSize(sb.totalBlocks * sb.blockSize),
      free: fmtSize(fsCountFreeBlocks(sb) * sb.blockSize),
    };
  }
  const drive0 = dfDriveText();
  const infoRow = document.createElement('div');
  infoRow.style.cssText = 'display:flex;gap:16px;align-items:center;border:2px solid;border-color:#808080 #fff #fff #808080;padding:3px 8px;background:#fff;flex-shrink:0;';
  infoRow.innerHTML = `<span>Drive: <b>C:\\</b></span><span id="df-cap">Capacity: ${drive0.capacity}</span><span id="df-free">Free: ${drive0.free}</span><span id="df-last" style="color:#555;">Last defrag: ${timeAgo(msSince)}</span><span id="df-frag" style="color:#555;">Fragmentation: ${initFragPct}%</span><span id="df-pct" style="margin-left:auto;font-weight:bold;">${initOptPct}% optimized</span>`;
  body.appendChild(infoRow);

  function dfRefreshStats() {
    const drive = dfDriveText();
    const capEl = document.getElementById('df-cap');
    const freeEl = document.getElementById('df-free');
    const fragEl = document.getElementById('df-frag');
    const pctEl = document.getElementById('df-pct');
    if (capEl) capEl.textContent = 'Capacity: ' + drive.capacity;
    if (freeEl) freeEl.textContent = 'Free: ' + drive.free;
    if (fragEl) fragEl.textContent = 'Fragmentation: ' + Math.round(getDriveFragmentationLevel() * 100) + '%';
    if (pctEl) pctEl.textContent = getDriveOptimizationPercent() + '% optimized';
  }

  // ── Canvas grid ────────────────────────────────────────────────
  const gridWrap = document.createElement('div');
  gridWrap.style.cssText = 'border:2px solid;border-color:#808080 #fff #fff #808080;background:#111;flex:1;min-height:0;overflow:hidden;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;';
  gridWrap.appendChild(canvas);
  body.appendChild(gridWrap);

  function drawGrid() {
    const W = gridWrap.clientWidth, H = gridWrap.clientHeight;
    if (!W || !H) return;
    const bw = Math.floor(W / COLS), bh = Math.floor(H / ROWS);
    if (!bw || !bh) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < TOTAL; i++) {
      if (cells[i] === CELL_MOVING) ctx.fillStyle = MOVING_COLOR;
      else if (cells[i] === CELL_FREE) ctx.fillStyle = FREE_COLOR;
      else if (owners[i] < 0) ctx.fillStyle = '#808080';
      else ctx.fillStyle = 'hsl(' + dfInodeHue(owners[i]).toFixed(1) + ',65%,45%)';
      ctx.fillRect((i % COLS) * bw + 1, Math.floor(i / COLS) * bh + 1, bw - 2, bh - 2);
    }
  }

  // ── Progress bar ───────────────────────────────────────────────
  const pbWrap = document.createElement('div');
  pbWrap.style.cssText = 'border:2px solid;border-color:#808080 #fff #fff #808080;height:18px;background:#c0c0c0;position:relative;overflow:hidden;flex-shrink:0;';
  const pbFill = document.createElement('div');
  pbFill.style.cssText = `position:absolute;left:0;top:0;height:100%;width:${initOptPct}%;background:#000080;`;
  const pbLabel = document.createElement('div');
  pbLabel.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;mix-blend-mode:difference;';
  pbLabel.textContent = initOptPct + '%';
  pbWrap.appendChild(pbFill); pbWrap.appendChild(pbLabel);
  body.appendChild(pbWrap);

  // ── File label ─────────────────────────────────────────────────
  const fileLabel = document.createElement('div');
  fileLabel.style.cssText = 'font-size:10px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;height:13px;';
  fileLabel.textContent = fragLevel < 0.05
    ? 'Disk is optimized. No defragmentation necessary.'
    : fragLevel < 0.3
      ? `Disk is ${initFragPct}% fragmented. Some defragmentation recommended.`
      : `Disk is ${initFragPct}% fragmented. Defragmentation recommended.`;
  body.appendChild(fileLabel);

  // ── Buttons ────────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;flex-shrink:0;';
  const startBtn = document.createElement('button');
  startBtn.className = 'dlg-btn primary'; startBtn.textContent = 'Start';
  const stopBtn = document.createElement('button');
  stopBtn.className = 'dlg-btn'; stopBtn.textContent = 'Stop'; stopBtn.disabled = true;
  btnRow.appendChild(startBtn); btnRow.appendChild(stopBtn);
  body.appendChild(btnRow);

  // ── Legend ─────────────────────────────────────────────────────
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:10px;font-size:10px;align-items:center;flex-shrink:0;';
  [[FREE_COLOR,'Free'],['hsl(200,65%,45%)','Allocated (by file)'],[MOVING_COLOR,'Moving']].forEach(([c,l]) => {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:flex;align-items:center;gap:3px;';
    const sq = document.createElement('span');
    sq.style.cssText = `width:12px;height:12px;background:${c};border:1px solid #808080;display:inline-block;flex-shrink:0;`;
    wrap.appendChild(sq); wrap.appendChild(document.createTextNode(l));
    legend.appendChild(wrap);
  });
  body.appendChild(legend);

  // Fire and forget: the window is already on screen, and a disk read that
  // fails leaves an all-free grid rather than blocking the app from opening.
  void dfReadDiskCells().then(ok => { if (ok) drawGrid(); });

  // ── Run ────────────────────────────────────────────────────────
  let running = false;

  startBtn.addEventListener('click', async () => {
    if (running) return;
    running = true; startBtn.disabled = true; stopBtn.disabled = false;
    startSoundLoop('defrag', { crossfade: DEFRAG_CROSSFADE_SEC });
    fileLabel.textContent = 'Analyzing C:\\ ...';
    if (ws) ws.textContent = 'Analyzing...';
    // Clear last run's bar before this one reports anything. A run that moves
    // nothing fires no onProgress, so without this it would still show the
    // previous run's 100%.
    pbFill.style.width = '0%';
    pbLabel.textContent = '0%';
    let lastMoved = -1;
    await dfReadDiskCells();
    drawGrid();

    const result = await fsRunCompaction({
      shouldStop: () => !running || !wins['defrag'],
      onProgress: (move, done, total) => {
        // Paint the block that just landed, so the animation marks a real
        // transaction rather than a timer tick. Only ONE cell is ever red:
        // the previous one reverts to its allocated colour first, or red
        // cells would accumulate across the whole run instead of showing
        // where the drive is working.
        if (lastMoved >= 0) cells[lastMoved] = CELL_USED;
        if (move.from >= 0 && move.from < TOTAL) { cells[move.from] = CELL_FREE; owners[move.from] = -1; }
        if (move.to >= 0 && move.to < TOTAL) {
          cells[move.to] = CELL_MOVING;
          owners[move.to] = move.ino;
          lastMoved = move.to;
        }
        const pct = Math.min(100, Math.round((done / total) * 100));
        pbFill.style.width = pct + '%';
        pbLabel.textContent = pct + '%';
        if (ws) ws.textContent = 'Defragmenting C:\\ - ' + pct + '%';
        fileLabel.textContent = 'Moving block ' + move.from + ' to ' + move.to;
        drawGrid();
      },
    });

    running = false;
    startBtn.disabled = false; stopBtn.disabled = true;
    stopSoundLoop('defrag', { fade: 0.6 });
    await dfReadDiskCells();
    drawGrid();
    dfRefreshStats();

    const lastEl = document.getElementById('df-last');
    if (lastEl) lastEl.textContent = 'Last defrag: just now';

    if (result.reason === 'no-space') {
      fileLabel.textContent = 'Cannot defragment: the drive has no free block to work in.';
      if (ws) ws.textContent = 'Cannot defragment';
    } else if (result.reason === 'nothing-to-do') {
      fileLabel.textContent = 'Disk is already contiguous. Nothing to move.';
      if (ws) ws.textContent = 'Nothing to do';
    } else if (result.stopped) {
      fileLabel.textContent = 'Stopped after ' + result.moved + ' of ' + result.total + ' blocks.';
      if (ws) ws.textContent = 'Stopped';
    } else if (result.reason === 'failed') {
      fileLabel.textContent = 'Defragmentation failed after ' + result.moved + ' blocks. The drive is unchanged from that point.';
      if (ws) ws.textContent = 'Failed';
    } else {
      pbFill.style.width = '100%'; pbLabel.textContent = '100%';
      // Blocks moved is the effort; the fragmentation pair is the result, and
      // reporting only the first is how a defragmenter ends up sounding busy
      // without saying whether it achieved anything. Rounded exactly like the
      // info row above so the two can never disagree on screen - including on
      // a barely-fragmented disk, where a real drop honestly reads 0% -> 0%.
      const pctOf = (lvl) => Math.round((lvl || 0) * 100) + '%';
      fileLabel.textContent = 'Defragmentation complete. ' + result.moved + ' blocks moved. ' +
        'Fragmentation ' + pctOf(result.fragBefore) + ' -> ' + pctOf(result.fragAfter) + '.';
      // The story entity has no inode and no blocks, so DEFRAG genuinely never
      // examined it. Say that, rather than claiming a move that was never
      // attempted, and only while it actually exists.
      if (ws) {
        ws.textContent = (typeof daemonStory === 'object' && daemonStory && !daemonStory.endingReached)
          ? 'Complete - 1 file could not be read: C:\\VOID\\[FILE NAME UNREADABLE]'
          : 'Complete';
      }
    }
  });

  stopBtn.addEventListener('click', () => {
    // fsRunCompaction polls shouldStop before each move, so clearing this is
    // all it takes: the run ends between transactions, leaving the disk
    // consistent and partly compacted, and the next run replans from there.
    running = false;
    stopBtn.disabled = true;
  });

  const dfResizeObserver = new ResizeObserver(() => drawGrid());
  dfResizeObserver.observe(gridWrap);
  const _origCloseDefrag = wins['defrag']?._onclose;
  if (wins['defrag']) wins['defrag']._onclose = () => {
    dfResizeObserver.disconnect();
    running = false;
    // Closing the window mid-run must take the drive noise with it; the run
    // stops itself on the same condition but has no way to say so.
    stopSoundLoop('defrag', { fade: 0.2 });
    if (_origCloseDefrag) _origCloseDefrag();
  };

  body.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { label: running ? '⏹ Stop' : '▶ Start', action: () => running ? stopBtn.click() : startBtn.click() },
      '-',
      { label: 'Close', action: () => closeWin('defrag') },
    ]);
  });

  // ── Menus ──────────────────────────────────────────────────────
  function dfDropdown(anchor, items) {
    const old = document.getElementById('active-dropdown'); if (old) old.remove();
    const rect = anchor.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
    dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
    items.forEach(item => {
      if (item === '-') { const s = document.createElement('div'); s.className = 'menu-dd-sep'; dd.appendChild(s); }
      else {
        const el = document.createElement('div'); el.className = 'menu-dd-item'; el.textContent = item.label;
        el.addEventListener('mousedown', e => { e.stopPropagation(); dd.remove(); item.action(); });
        dd.appendChild(el);
      }
    });
    document.body.appendChild(dd);
    procSetTimeout('defrag', () => document.addEventListener('mousedown', () => { const d = document.getElementById('active-dropdown'); if (d) d.remove(); }, { once: true }), 0);
  }

  mb.innerHTML = '';
  [
    { label: 'Drive', items: [
      // The plain drive art lives here, now that DEFRAG's own icon is the drive
      // being cleaned. The tick stays in the label: the gutter is the icon's
      // now, so it can no longer double as the selected-drive marker.
      { label: 'C:\\ (' + dfDriveText().capacity + ')  ✓', icon: 'icon:disk', action: () => { if (ws) ws.textContent = 'Drive C:\\ selected'; } },
      { label: 'D:\\ - [NOT FOUND]', icon: 'icon:disk', action: () => osAlert('Drive D:\\ is not available.\n\nIt may have never existed.', 'Drive Not Found', 'icon:warning') },
      '-',
      { label: 'Exit', action: () => closeWin('defrag') },
    ]},
    { label: 'Help', items: [
      { label: 'Help Topics', action: () => osAlert('DEFRAG.exe - Help\n\nClick Start to defragment drive C:\\.\n\nRepeated file edits, uploads, and deletes increase fragmentation over time.\n\nLower fragmentation reduces late-stage application distortion.\n\nNote: some system files cannot be moved.', 'Help Topics', 'icon:tip') },
      '-',
      { label: 'About DEFRAG.exe', action: () => osAlert('DEFRAG.exe - Disk Defragmenter\nsleepOS v1.0\n\nConsolidates fragmented files\nand free space on your hard disk.\n\nA small amount of the drive always remains unmovable.', 'About DEFRAG.exe', 'icon:defrag') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); dfDropdown(span, items); });
    mb.appendChild(span);
  });

  procSetTimeout('defrag', drawGrid, 80);
}

// ─────────────────────────────────────────────────────────────────
// BROWSER
// ─────────────────────────────────────────────────────────────────
function renderDaemonPanel() {
  const body = document.getElementById('wb-daemon');
  if (!body) return;
  applyDaemonWindowState();
  setWinTitle('daemon', daemonStory.endingReached ? 'daemon.core - Archive' : 'daemon.core - Containment');
  const telemetry = getContainmentTelemetry();
  const mirrorLockActive = telemetry.mirrorLockActive;
  const checklist = getContainmentChecklist();
  const status = daemonStory.endingReached
    ? 'Contained'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? 'Seal Interrupted'
      : daemonStageLabel(daemonStory.stage);
  const statusColor = daemonStory.endingReached
    ? '#006400'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? '#aa5500'
      : daemonStory.stage >= 5
        ? '#800080'
        : daemonStory.stage >= 4
          ? '#aa0000'
          : '#000080';
  const notes = [];
  if (daemonStory.endingReached) {
    notes.push('Containment complete. Nothing further to do here.');
  } else if (daemonStory.stage >= 7 && !mirrorLockActive) {
    notes.push('The seal lattice was ready, then the mirror lock dropped again.');
    notes.push('Restore MIRROR_LOCK to 1 before you run ?????.exe or delete void.tmp.');
  } else if (daemonStory.stage >= 7) {
    notes.push('The seal lattice is ready. Run ?????.exe to write SYS\\quarantine.sig, then delete void.tmp.');
  } else if (daemonStory.stage >= 5) {
    notes.push('You removed the anchor. The mirror is no longer deflected away from the user.');
    notes.push('Inspect void.tmp and CACHE\\mirror.dat. Read DOCS\\MIRROR_PROTOCOL.txt for the procedure. Restore MIRROR_LOCK when done.');
  } else if (daemonStory.stage >= 4) {
    notes.push('PID 512 stayed dead. Conditions got worse, not better.');
    notes.push('Lower MIRROR_LOCK in the registry, then delete SYS\\anchor.seed to open the channel. Inspect CACHE\\mirror.dat first.');
  } else if (daemonStory.stage >= 2) {
    notes.push('The watch layer answered your kill attempt. RESPAWN_LOCK must be cleared before PID 512 will stay down.');
  } else {
    notes.push('Open the raw read, then check DOCS for the first containment note.');
  }
  const gauge = value => `<div style="height:6px;border:1px solid #8f8f8f;background:#dadada;"><div style="height:100%;width:${Math.max(0, Math.min(100, value))}%;background:#000080;"></div></div>`;
  body.innerHTML = `
    <div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:11px;line-height:1.5;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div class="daemon-eye-large">${iconMarkup('icon:daemon')}</div>
        <div style="flex:1;">
          <div><b>File:</b> daemon.core</div>
          <div><b>Status:</b> <span style="color:${statusColor};font-weight:bold">${status}</span></div>
          <div><b>Containment:</b> <span style="color:${telemetry.rating.color};font-weight:bold">${telemetry.rating.code} / ${telemetry.rating.label}</span></div>
          <div><b>Observed:</b> ${daemonStory.openedDaemon ? 'yes' : 'no'}</div>
          <div><b>Last Event:</b> ${escHtml(daemonStory.lastEventText || 'none')}</div>
          <div><b>Mirror Lock:</b> ${telemetry.mirrorLockActive ? '1' : '0'}</div>
          <div><b>Respawn Lock:</b> ${telemetry.respawnLockActive ? '1' : '0'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Void Pressure</b> ${telemetry.pressure}</div>
          ${gauge(telemetry.pressure)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Lattice Stability</b> ${telemetry.lattice}</div>
          ${gauge(telemetry.lattice)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Signal Depth</b> ${telemetry.signalDepth}</div>
          ${gauge(telemetry.signalDepth)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Aperture Bias</b></div>
          <div style="margin-top:4px;color:${telemetry.bias === 'user-facing' ? '#8a0036' : telemetry.bias === 'sealed' ? '#0a7a2a' : '#005f73'};font-weight:bold;text-transform:uppercase;">${telemetry.bias}</div>
        </div>
      </div>
      <div style="border:1px solid #b0b0b0;background:#fff;padding:8px;min-height:78px;">
        ${notes.map(line => `<div>${escHtml(line)}</div>`).join('')}
      </div>
      ${daemonStory.stage >= 4 ? `
        <div style="border:1px solid #b0b0b0;background:#f7f7f7;padding:8px;">
          <div style="font-weight:bold;margin-bottom:4px;">Containment Checklist</div>
          ${checklist.map(item => `<div style="display:flex;align-items:center;gap:6px;color:${item.done ? '#0a662f' : '#555'};"><span style="font-weight:bold;width:12px;">${item.done ? '■' : '□'}</span><span>${escHtml(item.label)}</span></div>`).join('')}
        </div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        <button class="dlg-btn" onclick="openNotepad('daemon.core')">Raw Read</button>
        ${daemonStory.stage >= 4 && !daemonStory.endingReached ? `<button class="dlg-btn" onclick="openVoid()">Open void.tmp</button>` : ''}
      </div>
      <div style="text-align:right;">
        <button class="dlg-btn primary" onclick="closeWin('daemon')">Close</button>
      </div>
    </div>`;
  resizeDaemonWindow();
}

function resizeDaemonWindow() {
  const daemonWin = wins.daemon?.el;
  const body = document.getElementById('wb-daemon');
  if (!daemonWin || !body) return;
  if (wins.daemon.maximized) return;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) return;
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  const stage = daemonStory.stage || 0;
  const targetWidth = stage >= 7 ? 470 : stage >= 3 ? 450 : 430;
  const minHeight = stage >= 7 ? 500 : stage >= 3 ? 470 : 430;
  const maxWidth = Math.max(360, desktop.clientWidth - 24);
  const maxHeight = Math.max(320, desktop.clientHeight - 24);
  // Grow by however much the content actually overflows, and no more.
  //
  // This previously measured body.scrollHeight and added a padding constant,
  // then took Math.max against the window's current height. Because the body
  // grows with the window, every render computed a target taller than the last,
  // so the panel crept ~46px per Raw Read with no upper bound. Keying off the
  // overflow makes it idempotent: once the content fits, overflow is 0 and
  // repeated renders leave the size alone.
  const overflow = Math.max(0, Math.ceil(body.scrollHeight - body.clientHeight));
  const nextWidth = Math.min(maxWidth, Math.max(daemonWin.offsetWidth, targetWidth));
  const nextHeight = Math.min(maxHeight, Math.max(daemonWin.offsetHeight + overflow, minHeight));
  daemonWin.style.width = nextWidth + 'px';
  daemonWin.style.height = nextHeight + 'px';
  const maxLeft = Math.max(0, desktop.clientWidth - nextWidth);
  const maxTop = Math.max(0, desktop.clientHeight - nextHeight);
  const currentLeft = parseFloat(daemonWin.style.left) || 0;
  const currentTop = parseFloat(daemonWin.style.top) || 0;
  daemonWin.style.left = Math.max(0, Math.min(maxLeft, currentLeft)) + 'px';
  daemonWin.style.top = Math.max(0, Math.min(maxTop, currentTop)) + 'px';
}

function openDaemon() {
  daemonActivate('panel');
  const stage = daemonStory.stage || 0;
  const initialWidth = stage >= 7 ? 470 : stage >= 3 ? 450 : 430;
  const initialHeight = stage >= 7 ? 500 : stage >= 3 ? 470 : 430;
  if (!mkWin({ id:'daemon', title:'daemon.core - Containment', icon:'icon:daemon', w:initialWidth, h:initialHeight, x:200, y:110, menubar:false, statusbar:false }) && !document.getElementById('wb-daemon')) return;
  renderDaemonPanel();
}

function daemonVoidAction(mode) {
  const telemetry = getContainmentTelemetry();
  daemonVoidFeedMode = mode;
  if (mode === 'observe') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'The file is intact. What you are looking at is the aperture surface.'
      : daemonStory.stage >= 4
        ? 'The relay went quiet and this surface brightened at the same time.'
        : 'Nothing stable answers yet, but the file is taking a shape.';
  } else if (mode === 'measure') {
    daemonVoidFeed = [
      `containment: ${telemetry.rating.code} / ${telemetry.rating.label}`,
      `void pressure: ${telemetry.pressure}`,
      `lattice stability: ${telemetry.lattice}`,
      `signal depth: ${telemetry.signalDepth}`,
      `aperture bias: ${telemetry.bias}`,
      'disk locality: negative',
    ].join('\n');
  } else if (mode === 'listen') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'No words. Something on the reflected side is leaning against the room tone.'
      : daemonStory.stage >= 4
        ? 'You hear the shape of a voice through the monitor gap.'
        : 'Static. Then the suggestion of a room tone.';
  } else if (mode === 'trace') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'trace path:\n  user-facing aperture <- mirror offset <- unresolved source\n  return latency remains non-local'
      : daemonStory.stage >= 4
        ? 'trace path:\n  monitor gap -> pressure rise -> reflected surface'
        : 'No stable trace path yet.';
  } else if (mode === 'sample') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'sample:\n  carrier mismatch: confirmed\n  human voice match: negative\n  daemon-authored signature: false'
      : daemonStory.stage >= 4
        ? 'sample:\n  carrier unstable\n  monitor loss amplified the return path'
        : 'Sampling window too narrow.';
  } else if (mode === 'stabilize') {
    daemonVoidFeed = telemetry.mirrorLockActive
      ? daemonStory.quarantineSigned
        ? 'stabilize:\n  seal lattice catches for 0.8s\n  pressure drops in stepped increments'
        : 'stabilize:\n  mirror lock absorbs part of the return\n  pressure hesitates, then climbs again'
      : 'stabilize refused:\n  MIRROR_LOCK=0\n  aperture remains user-facing';
    triggerGlitch({ intensity: daemonStory.stage >= 7 ? 7 : daemonStory.stage >= 5 ? 5 : 4 });
  } else if (mode === 'pulse') {
    daemonVoidFeed = daemonStory.quarantineSigned
      ? 'The quarantine signature holds. The aperture recoils.'
      : daemonStory.stage >= 5
        ? 'A pulse returns before the machine feels ready for it, as if the file were farther away than the disk.'
        : 'The pulse dissipates without a readable return.';
    if (daemonStory.stage >= 5) triggerGlitch();
  }
  daemonRecordVoidAction(mode);
  const out = document.getElementById('void-readout');
  if (out) renderVoidReadout(out, daemonVoidFeed, telemetry);
}

function renderVoid() {
  const body = document.getElementById('wb-void');
  if (!body) return;
  applyDaemonWindowState();
  setWinTitle('void', daemonStory.endingReached ? 'void.tmp - Sealed' : 'void.tmp');
  body.style.cssText = 'background:#000;display:flex;flex-direction:column;overflow:hidden;padding:10px;gap:10px;';
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const pressure = telemetry.pressure;
  const summary = daemonStory.endingReached
    ? 'No active signal remains.'
    : daemonStory.stage >= 5
      ? `This file is the breach surface.\nUse the probes here to profile it.\n${getVoidObjectiveLine()}`
      : daemonStory.stage >= 4
        ? `Pressure rose after the daemon relay went quiet.\nUse Measure, Listen, or Trace to make the change legible.\n${getVoidObjectiveLine()}`
        : 'No stable observation channel yet.';
  const readout = daemonVoidFeed || summary;
  body.innerHTML = `
    <div style="border:1px solid #123512;background:#030703;color:#7fd37f;padding:8px;font-size:11px;line-height:1.5;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <div><b>CONTAINMENT:</b> ${telemetry.rating.code}</div>
        <div style="color:${telemetry.rating.color};font-weight:bold;">${telemetry.rating.label}</div>
      </div>
      <div>
        <div><b>BIAS:</b> ${telemetry.bias.toUpperCase()}</div>
        <div><b>QUARANTINE:</b> ${daemonStory.quarantineSigned ? 'present' : 'missing'}</div>
      </div>
      <div>
        <div><b>VOID PRESSURE:</b> ${pressure}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, pressure))}%;background:#6ab56a;"></div></div>
      </div>
      <div>
        <div><b>LATTICE:</b> ${telemetry.lattice}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, telemetry.lattice))}%;background:#7fd37f;"></div></div>
      </div>
      <div>
        <div><b>SIGNAL DEPTH:</b> ${telemetry.signalDepth}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, telemetry.signalDepth))}%;background:#9ee29e;"></div></div>
      </div>
      <div>
        <div><b>MIRROR LOCK:</b> ${telemetry.mirrorLockActive ? '1' : '0'}</div>
        <div><b>DELETE AUTH:</b> ${telemetry.deleteAuthorized ? 'yes' : 'no'}</div>
      </div>
      <div>
        <div><b>PROBES:</b> ${actions.length}/${VOID_ACTION_ORDER.length}</div>
        <div><b>PROFILE:</b> ${getVoidProfileLabel().toUpperCase()}</div>
      </div>
    </div>
    <div id="void-readout" style="flex:1;min-height:0;overflow:auto;border:1px solid #123512;background:#020402;color:#6ab56a;padding:10px;font-size:11px;line-height:1.7;white-space:pre-wrap;">${escHtml(readout)}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;">
      <button class="dlg-btn" onclick="daemonVoidAction('observe')">Observe</button>
      <button class="dlg-btn" onclick="daemonVoidAction('measure')">Measure</button>
      <button class="dlg-btn" onclick="daemonVoidAction('listen')">Listen</button>
      <button class="dlg-btn" onclick="daemonVoidAction('trace')">Trace</button>
      <button class="dlg-btn" onclick="daemonVoidAction('sample')">Sample</button>
      <button class="dlg-btn" onclick="daemonVoidAction('stabilize')">Stabilize</button>
      <button class="dlg-btn" onclick="daemonVoidAction('pulse')">Pulse</button>
      <button class="dlg-btn primary" onclick="closeWin('void')">Close</button>
    </div>`;
  renderVoidReadout(document.getElementById('void-readout'), readout, telemetry);
  resizeVoidWindow();
}

function resizeVoidWindow() {
  const voidWin = wins.void?.el;
  if (!voidWin || wins.void.maximized) return;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) return;
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  const targetWidth = daemonStory.stage >= 5 ? 560 : 540;
  const targetHeight = daemonStory.stage >= 5 ? 520 : 500;
  const maxWidth = Math.max(380, desktop.clientWidth - 24);
  const maxHeight = Math.max(360, desktop.clientHeight - 24);
  const nextWidth = Math.min(maxWidth, Math.max(voidWin.offsetWidth, targetWidth));
  const nextHeight = Math.min(maxHeight, Math.max(voidWin.offsetHeight, targetHeight));
  voidWin.style.width = nextWidth + 'px';
  voidWin.style.height = nextHeight + 'px';
  const maxLeft = Math.max(0, desktop.clientWidth - nextWidth);
  const maxTop = Math.max(0, desktop.clientHeight - nextHeight);
  const currentLeft = parseFloat(voidWin.style.left) || 0;
  const currentTop = parseFloat(voidWin.style.top) || 0;
  voidWin.style.left = Math.max(0, Math.min(maxLeft, currentLeft)) + 'px';
  voidWin.style.top = Math.max(0, Math.min(maxTop, currentTop)) + 'px';
}

function openVoid() {
  if (daemonStory.endingReached) {
    osAlert('void.tmp is no longer present.', 'void.tmp', 'icon:void');
    return;
  }
  daemonRecordInvestigation('void');
  const initialWidth = daemonStory.stage >= 5 ? 560 : 540;
  const initialHeight = daemonStory.stage >= 5 ? 520 : 500;
  if (!mkWin({ id:'void', title:'void.tmp', icon:'icon:void', w:initialWidth, h:initialHeight, x:200, y:110, menubar:false, statusbar:false }) && !document.getElementById('wb-void')) return;
  renderVoid();
}

function openUnknown() {
  const wid = 'unk-warn-' + Date.now();
  if (!mkWin({ id:wid, title:getExeDisplayName(), icon:'icon:unknown', w:320, h:190, x:220, y:130, menubar:false, statusbar:false, popup:true })) return;
  const ready = daemonStory.stage >= 7 && !daemonStory.endingReached && Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const signed = daemonStory.quarantineSigned;
  const inertMsg = daemonStory.stage < 4
    ? 'The launcher does not respond.<br><br>There is nothing here for it to do yet.'
    : daemonStory.stage < 6
    ? 'The launcher is inert.<br><br>The investigation is incomplete. Find the channel.'
    : 'The launcher is waiting.<br><br>MIRROR_LOCK must be restored before it will sign anything.';
  document.getElementById('wb-' + wid).innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">${iconMarkup('icon:unknown')}</div>
      <div class="dlg-text">
        ${signed
          ? 'SYS\\quarantine.sig is already present.<br><br>The launcher is waiting for the final delete.'
          : ready
          ? 'The quarantine launcher is armed.<br><br>Running <b>?????.exe</b> will write <b>SYS\\quarantine.sig</b>.'
          : inertMsg}
      </div>
    </div>
    <div class="dlg-btns">
      <button class="dlg-btn primary" onclick="closeWin('${wid}');runUnknown()">${signed ? 'Check Status' : ready ? 'Generate Signature' : 'Run Anyway'}</button>
      <button class="dlg-btn" onclick="closeWin('${wid}')">Cancel</button>
    </div>`;
}

function runUnknown() {
  let message = '';
  if (daemonStory.endingReached) {
    message = 'The quarantine launcher has been archived.\nThere is nothing left to sign.';
  } else if (daemonStory.stage < 4) {
    message = '?????.exe does not execute.\n\nThere is nothing for it to do yet.';
  } else if (daemonStory.stage < 6) {
    message = '?????.exe does not execute.\n\nThe investigation is incomplete. Find and inspect the channel before you use this.';
  } else if (daemonStory.stage < 7 || Number(getContainmentValue('MIRROR_LOCK')) !== 1) {
    message = '?????.exe does not execute.\n\nRestore MIRROR_LOCK to 1 first. The launcher will not sign an open lattice.';
  } else if (!daemonStory.quarantineSigned) {
    updateDaemonStory(story => {
      story.quarantineSigned = true;
      story.lastEventText = 'quarantine signature written';
      daemonVoidFeed = 'A signature passes through the aperture and the pressure drops.';
      daemonVoidFeedMode = '';
    }, {
      glitch: true,
    });
    message = 'quarantine.sig written.\n\nDelete void.tmp to complete containment.';
  } else {
    message = 'SYS\\quarantine.sig is already present.\n\nThe launcher has nothing else to do.';
  }
  const rid = 'unk-result-' + Date.now();
  if (!mkWin({ id:rid, title:'?????.exe', icon:'icon:unknown', w:360, h:220, x:180, y:110, menubar:false, statusbar:false })) return;
  document.getElementById('wb-' + rid).innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">${iconMarkup('icon:unknown')}</div>
      <div class="dlg-text" style="white-space:pre-line;">${escHtml(message)}</div>
    </div>
    <div class="dlg-btns"><button class="dlg-btn primary" onclick="closeWin('${rid}')">OK</button></div>`;
}

function openBrowser() {
  if (!mkWin({ id:'browser', title:'sleepWEB - Web Browser', icon:'icon:browser', w:640, h:460, x:80, y:50 })) return;

  const mb   = document.getElementById('mb-browser');
  const body = document.getElementById('wb-browser');
  const ws   = document.getElementById('ws-browser');
  body.style.cssText = 'display:flex;flex-direction:column;padding:0;overflow:hidden;';

  let hist = [], histIdx = -1;

  // ── home page ──────────────────────────────────────────────────
  function buildHome() {
    const projectLinks = PROJECTS.map(p =>
      `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${JSON.stringify(p.file).replace(/</g, '\\u003c')}},"*");return false;'>${p.emoji} ${escHtml(p.name)}</a>`
    ).join('');
    const favoriteLinks = browserFavorites
      .filter(fav => !DEFAULT_BROWSER_FAVORITE_URLS.has(fav.url.toLowerCase()))
      .map(fav => {
        const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
        const safeTitle = escHtml(fav.title || fav.url);
        return `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>&#9734; ${safeTitle}</a>`;
      }).join('');
    const webLinks = DEFAULT_BROWSER_FAVORITES.map(fav => {
      const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
      const safeTitle = escHtml(fav.title);
      // iconMarkup emits <img class="os-icon">, but this document is an iframe
      // srcdoc with its own stylesheet - os/os.css never reaches it - so .lnk img
      // below is what sizes these, not the .os-icon rule. The relative src
      // resolves because a srcdoc document inherits its parent's base URL.
      return `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>${iconMarkup(fav.homeIcon)}${safeTitle}</a>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff') format('woff');font-style:normal;font-weight:400;font-display:swap;}
@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff') format('woff');font-style:normal;font-weight:700;font-display:swap;}
:root{--sleep-font:'W95font',sans-serif;}
      body{margin:0;background:#c0c0c0;font-family: var(--sleep-font);font-size:12px;}
      h1{background:#000080;color:#fff;margin:0;padding:6px 12px;font-size:13px;}
      .sec{padding:6px 12px;}.sec h2{font-size:11px;margin:6px 0 4px;border-bottom:1px solid #808080;}
      .grid{display:flex;flex-wrap:wrap;gap:3px;}
      /* line-height matches the 16px icon so a chip carrying one is exactly as
         tall as a chip carrying only an emoji. Without it the Web row sits 1px
         taller than the Projects row above it. */
      .lnk{background:#fff;border:2px solid;border-color:#fff #808080 #808080 #fff;
           padding:1px 7px;font-size:11px;line-height:16px;text-decoration:none;color:#000;
           display:inline-flex;align-items:center;gap:4px;}
      .lnk:hover{background:#000080;color:#fff;}
      /* The web-link art is native 16x16, so this is a 1:1 draw and pixelated
         keeps it exact. The star on project links is a text glyph, not an img,
         and is unaffected by this rule. */
      .lnk img{width:16px;height:16px;image-rendering:pixelated;flex-shrink:0;}
    </style></head><body>
    <h1>&#127760; sleepWEB &#8212; Start Page</h1>
    <div class="sec"><h2>sleepOS Projects</h2><div class="grid">${projectLinks}</div></div>
    <div class="sec"><h2>The Web</h2><div class="grid">${webLinks}${favoriteLinks}</div></div>
</body></html>`;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'browser-toolbar';
  toolbar.innerHTML = `
    <button class="br-btn" id="br-back" title="Back" disabled>◀</button>
    <button class="br-btn" id="br-fwd"  title="Forward" disabled>▶</button>
    <button class="br-btn" id="br-stop" title="Stop">✕</button>
    <button class="br-btn" id="br-ref"  title="Refresh">↻</button>
    <button class="br-btn" id="br-home" title="Home">${iconMarkup('icon:home')}</button>
    <div class="br-vsep"></div>
    <span class="br-addr-label">Address:</span>
    <input class="br-addr" id="br-url" type="text" value="home:">
    <button class="br-btn" id="br-go">Go</button>
    <button class="br-btn" id="br-fav" title="Add to Favorites">${iconMarkup('icon:star')}</button>`;
  body.appendChild(toolbar);

  // ── iframe + error overlay ─────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#fff;';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation';
  wrap.appendChild(iframe);

  const errDiv = document.createElement('div');
  errDiv.id = 'br-err';
  errDiv.style.cssText = 'display:none;position:absolute;inset:0;background:#c0c0c0;padding:30px;';
  const errBox = document.createElement('div');
  errBox.style.cssText = 'background:#fff;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:16px;max-width:380px;margin:auto;font-size:11px;';
  errDiv.appendChild(errBox);
  wrap.appendChild(errDiv);

  function showError(url) {
    errBox.innerHTML = `
      <div class="br-err-icon">${iconMarkup('icon:error')}</div>
      <b>This page cannot be displayed</b><br><br>
      <span style="word-break:break-all;color:#444;">${url}</span><br><br>
      This site sent <code style="background:#eee;padding:1px 3px;">X-Frame-Options</code> or
      <code style="background:#eee;padding:1px 3px;">Content-Security-Policy</code> headers that
      block embedding.<br><br>
      To fix this on <b>your own sites</b>, add this header:<br>
      <code style="background:#eee;padding:2px 4px;display:block;margin:4px 0;">X-Frame-Options: ALLOWALL</code>
      <div style="margin-top:10px;display:flex;gap:6px;justify-content:center;">
        <button class="dlg-btn primary" id="br-err-tab">Open in New Tab</button>
        <button class="dlg-btn" id="br-err-ok">OK</button>
      </div>`;
    errDiv.style.display = 'block';
    document.getElementById('br-err-tab').onclick = () => window.open(url, '_blank');
    document.getElementById('br-err-ok').onclick  = () => { errDiv.style.display = 'none'; };
    if (ws) ws.textContent = 'Error: site blocked embedding';
  }
  body.appendChild(wrap);

  // ── navigate ───────────────────────────────────────────────────
  function updateNav() {
    document.getElementById('br-back').disabled = histIdx <= 0;
    document.getElementById('br-fwd').disabled  = histIdx >= hist.length - 1;
  }

  let lastAttemptedUrl = '';

  function navigate(url, push = true) {
    errDiv.style.display = 'none';
    if (!url || url === 'home:') {
      url = 'home:';
      document.getElementById('br-url').value = 'home:';
      iframe.removeAttribute('src');
      iframe.srcdoc = buildHome();
      if (ws) ws.textContent = 'sleepWEB Start Page';
    } else {
      if (!/^https?:\/\/|^data:|^about:/.test(url)) url = 'https://' + url;
      lastAttemptedUrl = url;
      document.getElementById('br-url').value = url;
      iframe.removeAttribute('srcdoc');
      iframe.src = url;
      if (ws) ws.textContent = 'Connecting to ' + (url.split('/')[2] || url);
    }
    if (push) { hist = hist.slice(0, histIdx + 1); hist.push(url); histIdx = hist.length - 1; }
    updateNav();
  }

  function syncUrl() {
    try {
      const loc = iframe.contentWindow.location.href;
      if (loc && loc !== 'about:blank' && loc !== 'about:srcdoc') {
        const bar = document.getElementById('br-url');
        if (bar && bar.value !== loc) {
          bar.value = loc;
          if (hist[histIdx] !== loc) {
            hist = hist.slice(0, histIdx + 1); hist.push(loc); histIdx = hist.length - 1;
            updateNav();
          }
        }
      }
    } catch(e) { /* cross-origin - cannot read URL */ }
  }

  // Poll to catch SPA pushState/hash navigation and link clicks
  const _urlPoll = procSetInterval('browser', syncUrl, 600);

  iframe.addEventListener('load', () => {
    syncUrl();
    if (ws) ws.textContent = 'Done';
  });

  // Clear poll when browser window closes
  document.getElementById('win-browser')?.addEventListener('remove', () => clearInterval(_urlPoll), { once: true });
  // Use MutationObserver to detect window removal
  new MutationObserver((_, obs) => {
    if (!document.getElementById('win-browser')) { clearInterval(_urlPoll); obs.disconnect(); }
  }).observe(document.getElementById('desktop'), { childList: true });
  iframe.addEventListener('error', () => showError(lastAttemptedUrl));

  // ── handle nav messages from srcdoc home page ──────────────────
  function onBrowserMsg(e) {
    if (e.data && e.data.type === 'browser-nav') navigate(e.data.url);
  }
  window.addEventListener('message', onBrowserMsg);
  // clean up when window closes
  const winEl = document.getElementById('win-browser');
  if (winEl) new MutationObserver((_, obs) => {
    if (!document.getElementById('win-browser')) {
      window.removeEventListener('message', onBrowserMsg); obs.disconnect();
    }
  }).observe(document.getElementById('desktop'), { childList: true });

  // ── button wiring ──────────────────────────────────────────────
  document.getElementById('br-back').addEventListener('click', () => {
    if (histIdx > 0) { histIdx--; navigate(hist[histIdx], false); }
  });
  document.getElementById('br-fwd').addEventListener('click', () => {
    if (histIdx < hist.length - 1) { histIdx++; navigate(hist[histIdx], false); }
  });
  document.getElementById('br-stop').addEventListener('click', () => {
    iframe.src = 'about:blank'; if (ws) ws.textContent = 'Stopped.';
  });
  document.getElementById('br-ref').addEventListener('click', () => {
    const u = hist[histIdx]; if (u === 'home:') { iframe.srcdoc = buildHome(); } else { iframe.src = iframe.src; }
    if (ws) ws.textContent = 'Refreshing...';
  });
  document.getElementById('br-home').addEventListener('click', () => navigate('home:'));
  document.getElementById('br-go').addEventListener('click', () => navigate(document.getElementById('br-url').value.trim()));
  document.getElementById('br-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') navigate(document.getElementById('br-url').value.trim());
  });

  // ── favorites helpers ──────────────────────────────────────────
  function currentUrl() { return hist[histIdx] || 'home:'; }
  function refreshHome() {
    if (currentUrl() === 'home:') iframe.srcdoc = buildHome();
  }
  function addToFavorites() {
    const url = currentUrl();
    if (url === 'home:') return;
    if (browserFavorites.some(fav => fav.url.toLowerCase() === url.toLowerCase())) {
      if (ws) ws.textContent = 'Site is already in Favorites.';
      return;
    }
    osPrompt('Save to Favorites as:', document.getElementById('br-url').value, 'Add to Favorites', title => {
      if (!title) return;
      browserFavorites.push({ title, url });
      saveFavorites();
      refreshHome();
      if (ws) ws.textContent = 'Added to Favorites.';
    }, 'icon:star');
  }

  document.getElementById('br-fav').addEventListener('click', addToFavorites);

  // ── browser body right-click ───────────────────────────────────
  body.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { label: '◀ Back',    disabled: histIdx <= 0,               action: () => document.getElementById('br-back').click() },
      { label: '▶ Forward', disabled: histIdx >= hist.length - 1, action: () => document.getElementById('br-fwd').click() },
      { label: '↻ Refresh', action: () => document.getElementById('br-ref').click() },
      '-',
      { label: 'Add to Favorites', icon: 'icon:star', disabled: currentUrl() === 'home:', action: addToFavorites },
      '-',
      { label: 'Home', icon: 'icon:home', action: () => navigate('home:') },
      { label: 'Open in New Tab', disabled: currentUrl() === 'home:', action: () => window.open(currentUrl(), '_blank') },
    ]);
  });

  // ── menu bar ───────────────────────────────────────────────────
  function brDropdown(anchor, items) {
    const old = document.getElementById('active-dropdown'); if (old) old.remove();
    const rect = anchor.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
    dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
    items.forEach(item => {
      if (item === '-') {
        const s = document.createElement('div'); s.className = 'menu-dd-sep'; dd.appendChild(s);
      } else {
        const el = document.createElement('div'); el.className = 'menu-dd-item'; el.textContent = item.label;
        el.addEventListener('mousedown', e => { e.stopPropagation(); dd.remove(); item.action(); });
        dd.appendChild(el);
      }
    });
    document.body.appendChild(dd);
    procSetTimeout('browser', () => document.addEventListener('mousedown', () => { const d = document.getElementById('active-dropdown'); if (d) d.remove(); }, { once: true }), 0);
  }

  mb.innerHTML = '';
  [
    { label: 'File', items: [
      { label: 'Open Location...', action: () => osPrompt('Enter URL:', 'https://', 'Open Location', u => { if (u) navigate(u); }, 'icon:browser') },
      '-',
      { label: 'Close', action: () => closeWin('browser') },
    ]},
    { label: 'View', items: [
      { label: 'Home',    action: () => navigate('home:') },
      { label: 'Refresh', action: () => document.getElementById('br-ref').click() },
      { label: 'Stop',    action: () => document.getElementById('br-stop').click() },
      '-',
      { label: 'View Source', action: () => {
        try {
          const src = iframe.contentDocument.documentElement.outerHTML;
          const w = window.open(''); w.document.write('<pre style="white-space:pre-wrap;font-size:12px;">' + src.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>');
        } catch(e) { osAlert('Cannot view source of cross-origin pages.', 'View Source', 'icon:error'); }
      }},
    ]},
    { label: 'Help', items: [
      { label: 'About sleepWEB', action: () => osAlert('sleepWEB - Web Browser\nsleepOS v1.0\n\nNote: many modern sites block\nbeing loaded inside frames.', 'About sleepWEB', 'icon:browser') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); brDropdown(span, items); });
    mb.appendChild(span);
  });

  // Favorites menu (dynamic - built on open)
  const favSpan = document.createElement('span');
  favSpan.className = 'menu-item'; favSpan.textContent = 'Favorites';
  favSpan.addEventListener('click', e => {
    e.stopPropagation();
    const items = [
      { label: 'Add to Favorites', icon: 'icon:star', action: addToFavorites },
      { label: 'Clear All Favorites', icon: 'icon:recycle-full', action: () => {
        if (!browserFavorites.length) return;
        osConfirm('Clear all favorites?', 'Confirm', ok => {
          if (!ok) return;
          browserFavorites.length = 0; saveFavorites(); refreshHome(); if (ws) ws.textContent = 'Favorites cleared.';
        }, 'icon:recycle-full');
      }},
    ];
    if (browserFavorites.length) {
      items.push('-');
      browserFavorites.forEach((fav, i) => items.push({
        label: fav.title,
        action: () => navigate(fav.url),
      }));
    }
    brDropdown(favSpan, items);
  });
  mb.appendChild(favSpan);

  navigate('home:');
}

// ─────────────────────────────────────────────────────────────────
// GLITCH EFFECT
// ─────────────────────────────────────────────────────────────────
function triggerGlitch(options) {
  const desktop = document.getElementById('desktop');
  const windowsLayer = document.getElementById('windows-layer');
  const taskbar = document.getElementById('taskbar');
  const glitch = document.getElementById('glitch');
  const intensity = Number(options?.intensity) || 0;
  const subtle = !!options?.subtle;
  // Tracks the visual scaling below, so a subtle background flicker does not
  // arrive at the same volume as a full-intensity tear.
  playSound('glitch', {
    volume: subtle ? 0.4 : intensity >= 7 ? 1 : intensity >= 5 ? 0.78 : 0.58,
  });
  pulseDaemonWindows(intensity, { subtle });
  const targets = [desktop, windowsLayer, taskbar].filter(Boolean);
  const glitchClass = subtle ? 'glitching-soft' : 'glitching';
  targets.forEach(el => el.classList.add(glitchClass));
  setTimeout(() => targets.forEach(el => {
    el.classList.remove('glitching');
    el.classList.remove('glitching-soft');
  }), subtle ? 420 : intensity >= 7 ? 900 : intensity >= 5 ? 760 : 650);

  if (glitch) {
    glitch.style.display = 'block';
    glitch.style.background = intensity >= 7
      ? 'linear-gradient(90deg, rgba(255,0,120,0.14), transparent 22%, rgba(80,255,255,0.18) 58%, transparent 78%), repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 6px)'
      : intensity >= 5
        ? 'linear-gradient(90deg, rgba(255,0,80,0.09), transparent 28%, rgba(90,255,240,0.12) 64%, transparent 82%), repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 8px)'
        : 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent 50%, rgba(120,255,255,0.06)), repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 10px)';
    glitch.style.opacity = subtle
      ? intensity >= 7 ? '0.54' : intensity >= 5 ? '0.38' : '0.24'
      : intensity >= 7 ? '0.9' : intensity >= 5 ? '0.65' : '0.42';
    glitch.style.transform = subtle
      ? intensity >= 7 ? 'translateX(-2px)' : intensity >= 5 ? 'translateX(1px)' : 'translateX(0)'
      : intensity >= 7 ? 'translateX(-6px)' : intensity >= 5 ? 'translateX(4px)' : 'translateX(0)';
    setTimeout(() => {
      glitch.style.display = 'none';
      glitch.style.opacity = '';
      glitch.style.transform = '';
      glitch.style.background = '';
    }, subtle ? 110 : intensity >= 7 ? 180 : 130);
  }

  // Brief scanline intensify
  const crt = document.getElementById('crt');
  crt.style.opacity = subtle
    ? intensity >= 7 ? '1.55' : intensity >= 5 ? '1.35' : '1.22'
    : intensity >= 7 ? '2.45' : intensity >= 5 ? '2.2' : '2';
  setTimeout(() => { crt.style.opacity = '1'; }, subtle ? 150 : intensity >= 7 ? 260 : 180);
}

let endingRebootActive = false;
const ENDING_REBOOT_ANIM_MS = 2350;
const ENDING_REBOOT_TEXT_HOLD_MS = 2400;
function playContainmentEndingReboot() {
  if (endingRebootActive) return;
  endingRebootActive = true;
  closeStart();
  closeDropdown();
  closeCad();
  if (altTabActive) closeAltTab();

  stopSoundLoop('ambience', { fade: 0.7 });
  playSound('shutdown');

  const overlay = document.getElementById('ending-reboot');
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  }
  document.body.classList.add('final-rebooting');

  setTimeout(() => {
    const desktop = document.getElementById('desktop');
    const taskbar = document.getElementById('taskbar');
    const daemonFx = document.getElementById('daemon-fx');
    const bios = document.getElementById('bios');

    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (desktop) desktop.style.display = 'none';
    if (taskbar) taskbar.style.display = 'none';
    if (daemonFx) daemonFx.style.display = 'none';
    document.body.classList.remove('final-rebooting');

    if (bios) {
      bios.style.display = 'flex';
      bios.style.opacity = '1';
      bios.style.transition = 'none';
      bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);font-size:18px;color:#858585;white-space:pre;line-height:1.55;">
Containment complete.
Draining chroma channels...               [SEALED]
Archiving daemon.core...                 [OK]
Rebooting sleepOS shell...
      </div>`;
    }

    try { sessionStorage.setItem(FORCE_BOOT_SESSION_KEY, '1'); } catch (e) {}
    setTimeout(() => { window.location.replace('sleep-os.html'); }, ENDING_REBOOT_TEXT_HOLD_MS);
  }, ENDING_REBOOT_ANIM_MS);
}

// ─────────────────────────────────────────────────────────────────
// SHUTDOWN
// ─────────────────────────────────────────────────────────────────
function doShutdown() {
  const id = 'shutdown';
  if (!mkWin({ id, title:'Shut Down sleepOS', icon:'icon:standby', w:300, h:165,
               x:Math.floor(window.innerWidth/2)-150, y:Math.floor(window.innerHeight/2)-80,
               menubar:false, statusbar:false, popup:true })) return;
  document.getElementById('wb-shutdown').innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">${iconMarkup('icon:standby')}</div>
      <div class="dlg-text">
        What do you want the computer to do?<br><br>
        <select id="shutdown-sel" style="width:180px;font-size:11px;margin-top:2px;">
          <option value="off">Shut down</option>
          <option value="restart">Restart</option>
          <option value="sleep">Sleep</option>
          <option value="back">Return to Eve Net</option>
        </select>
      </div>
    </div>
    <div class="dlg-btns">
      <button class="dlg-btn primary" onclick="confirmShutdown()">OK</button>
      <button class="dlg-btn" onclick="closeWin('shutdown')">Cancel</button>
    </div>`;
}

// How long the shutdown screen is held before the machine actually goes.
//
// The floor is the old fixed value, and it is what runs whenever the jingle
// cannot play - muted, never unlocked, tab hidden. Below it the log is gone
// before it can be read.
const SHUTDOWN_MIN_HOLD_MS = 3200;
// A beat of quiet after the last note, so the screen does not vanish on it.
const SHUTDOWN_TAIL_MS = 350;
// Nothing may wedge a power-off. If the sound never reports back, this fires.
const SHUTDOWN_MAX_HOLD_MS = 12000;

function confirmShutdown() {
  const sel = document.getElementById('shutdown-sel');
  const val = sel ? sel.value : 'back';
  closeWin('shutdown');
  if (val === 'sleep') {
    // Sleep is not a power-off: enterIdleSleep ducks the ambience instead, and
    // a shutdown jingle here would contradict the machine still running.
    enterIdleSleep(MANUAL_SLEEP_WAKE_DELAY_MS);
    return;
  }

  stopSoundLoop('ambience', { fade: 0.9 });
  const startedAt = Date.now();
  const jingle = playSound('shutdown');

  const bios = document.getElementById('bios');
  bios.style.display = 'flex'; bios.style.opacity = '0'; bios.style.transition = 'opacity 0.6s';
  bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);font-size:18px;color:#888;white-space:pre;line-height:1.5;">
sleepOS - ${val === 'restart' ? 'Restarting' : 'Shutting Down'}...

Stopping soul_daemon.exe...              [OK]
Stopping dream_fragment.exe...           [OK]
Stopping unknown (PID 0333)...           [TIMEOUT]
Stopping unknown (PID 0334)...           [TIMEOUT]
Stopping unknown (PID 0335)...           [TIMEOUT]
Flushing corpus cache...                 [OK]
Unloading kernel modules...              [OK]
Saving system state...                   [OK]
  </div>`;
  document.getElementById('desktop').style.display = 'none';
  document.getElementById('taskbar').style.display = 'none';
  setTimeout(() => { bios.style.opacity = '1'; }, 30);

  let powered = false;
  const powerOff = () => {
    if (powered) return;
    powered = true;
    if (val === 'back') { window.location.href = '/'; return; }
    if (val === 'restart') { window.location.href = 'sleep-os.html'; return; }
    closeSleepOSTab();
  };

  // Restart and Return navigate somewhere the user is waiting on, and the
  // navigation tears the AudioContext down anyway, so holding six seconds for a
  // jingle that dies at the page boundary would just be six seconds of nothing.
  // Shutting down is the one exit with nothing after it, so it gets the whole
  // sound.
  if (val !== 'off') {
    setTimeout(powerOff, SHUTDOWN_MIN_HOLD_MS);
    return;
  }
  jingle.then(ms => {
    // Measured from before the sound was requested: the first play of the
    // jingle waits on a fetch and a decode, and that time is part of the hold
    // the user is already watching, not extra on top of it.
    const hold = Math.max(SHUTDOWN_MIN_HOLD_MS, ms + SHUTDOWN_TAIL_MS);
    setTimeout(powerOff, Math.max(0, hold - (Date.now() - startedAt)));
  });
  setTimeout(powerOff, SHUTDOWN_MAX_HOLD_MS);
}

// window.close() only works on a tab that script opened. Every current browser
// silently refuses it anywhere else - no exception to catch, no way to ask in
// advance - so on a tab the user opened themselves this does nothing at all,
// which is what "shut down" has been doing all along.
//
// The only detection available is noticing we are still running a moment later,
// and the honest thing to show then is the screen every machine of this vintage
// ended on.
function closeSleepOSTab() {
  window.close();
  setTimeout(showSafeToTurnOff, 500);
}

let safeToTurnOffShown = false;
function showSafeToTurnOff() {
  const bios = document.getElementById('bios');
  if (!bios || safeToTurnOffShown) return;
  // Re-entry would stack a second pair of wake listeners while the first pair
  // is already past its guard window, so the next input would reboot instantly
  // instead of being swallowed.
  safeToTurnOffShown = true;
  bios.style.transition = 'none';
  bios.style.opacity = '1';
  bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);text-align:center;padding:2rem;">
<span style="display:block;font-size:22px;color:#ffa733;line-height:1.6;">It's now safe to turn off<br>your computer.</span>
<span style="display:block;margin-top:2.5rem;font-size:11px;color:#4a4a4a;">press any key to restart</span>
</div>`;
  // A real machine needed the power switch. A browser tab that cannot be closed
  // and cannot be left is just broken, so the power switch is any key.
  const restart = () => {
    try { sessionStorage.setItem(FORCE_BOOT_SESSION_KEY, '1'); } catch (e) {}
    window.location.replace('sleep-os.html');
  };
  setTimeout(() => {
    document.addEventListener('keydown', restart, { once: true });
    document.addEventListener('pointerdown', restart, { once: true });
  }, 600);
}

// ─────────────────────────────────────────────────────────────────
// REGISTRY EDITOR
// ─────────────────────────────────────────────────────────────────
function openRegedit() {
  if (!mkWin({ id:'regedit', title:'Registry Editor', icon:'icon:regedit', w:580, h:380, x:90, y:70 })) return;
  const body = document.getElementById('wb-regedit');
  const ws   = document.getElementById('ws-regedit');
  const mb   = document.getElementById('mb-regedit');
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
  const REGEDIT_LOCKED_VALUE_NAMES = new Set(['OBSERVER_COUNT', 'ANCHOR_FILE', 'TEMPORAL_DRIFT']);

  const layout = document.createElement('div');
  layout.className = 'reg-layout';
  body.appendChild(layout);

  // ── Tree panel ─────────────────────────────────────────────────
  const tree = document.createElement('div');
  tree.className = 'reg-tree';
  layout.appendChild(tree);

  // ── Values panel ───────────────────────────────────────────────
  const vals = document.createElement('div');
  vals.className = 'reg-vals';
  layout.appendChild(vals);

  let selectedPath = null; // { hive, key }

  function isLockedRegValue(hive, keyPath, valName) {
    return REGEDIT_LOCKED_VALUE_NAMES.has(String(valName || '').toUpperCase());
  }

  function showLockedRegValueNotice(valName) {
    osAlert('The registry value "' + valName + '" is protected and cannot be modified.', 'Registry Editor', 'icon:regedit');
  }

  function buildTree() {
    tree.innerHTML = '';
    Object.keys(registryData).forEach(hive => {
      const hiveEl = document.createElement('div');
      hiveEl.style.cssText = 'margin-bottom:1px;';

      const hiveRow = document.createElement('div');
      hiveRow.className = 'reg-tree-item';
      hiveRow.innerHTML = '<span class="reg-tree-arrow">\u25b6</span><span class="reg-tree-icon">' + iconMarkup('icon:folder') + '</span>&nbsp;<span>' + hive + '</span>';
      let expanded = false;
      const childWrap = document.createElement('div');
      childWrap.style.paddingLeft = '12px';
      childWrap.style.display = 'none';

      hiveRow.addEventListener('click', () => {
        expanded = !expanded;
        childWrap.style.display = expanded ? '' : 'none';
        hiveRow.querySelector('.reg-tree-arrow').textContent = expanded ? '▼' : '▶';
      });

      Object.keys(registryData[hive]).forEach(keyPath => {
        const keyEl = document.createElement('div');
        keyEl.className = 'reg-tree-item';
        keyEl.innerHTML = '<span class="reg-tree-icon">' + iconMarkup('icon:folder-open') + '</span>&nbsp;<span>' + keyPath + '</span>';
        keyEl.addEventListener('click', e => {
          e.stopPropagation();
          tree.querySelectorAll('.reg-tree-item.selected').forEach(el => el.classList.remove('selected'));
          keyEl.classList.add('selected');
          selectedPath = { hive, key: keyPath };
          renderVals(hive, keyPath);
          if (ws) ws.textContent = hive + '\\' + keyPath;
        });
        childWrap.appendChild(keyEl);
      });

      hiveEl.appendChild(hiveRow);
      hiveEl.appendChild(childWrap);
      tree.appendChild(hiveEl);
    });
  }

  function renderVals(hive, keyPath) {
    vals.innerHTML = '';
    const data = registryData[hive][keyPath];
    const tbl = document.createElement('table');
    tbl.className = 'reg-vals-table';
    tbl.innerHTML = '<thead><tr><th style="width:180px;">Name</th><th style="width:100px;">Type</th><th>Data</th></tr></thead>';
    const tbody = document.createElement('tbody');

    Object.keys(data).forEach(valName => {
      const entry = data[valName];
      const locked = isLockedRegValue(hive, keyPath, valName);
      const tr = document.createElement('tr');
      tr.className = 'reg-val-row';
      // Value rows used to draw the generic text-file icon whatever the type
      // was, which made the type column the only way to tell a string from a
      // number. Real regedit distinguishes them in the icon, so the type is
      // readable at a glance down the column.
      const valIcon = entry.type === 'REG_SZ' ? 'icon:regedit-string' : 'icon:regedit-binary';
      tr.innerHTML = '<td class="reg-val-name">' + iconMarkup(valIcon) + escHtml(valName) + '</td><td>' + entry.type + '</td><td>' + escHtml(String(entry.value)) + '</td>';
      tr.addEventListener('dblclick', () => {
        if (locked) {
          showLockedRegValueNotice(valName);
          return;
        }
        editRegValue(hive, keyPath, valName);
      });
      tr.addEventListener('contextmenu', e => {
        e.preventDefault();
        tr.classList.add('selected');
        showCtxMenu(e.clientX, e.clientY, [
          { label: 'Modify', disabled: locked, action: () => editRegValue(hive, keyPath, valName) },
        ]);
        procSetTimeout('regedit', () => tr.classList.remove('selected'), 800);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    vals.appendChild(tbl);
  }

  function editRegValue(hive, keyPath, valName) {
    if (isLockedRegValue(hive, keyPath, valName)) {
      showLockedRegValueNotice(valName);
      return;
    }
    const entry = registryData[hive][keyPath][valName];
    const currentVal = String(entry.value);
    osPrompt('Edit value for: ' + valName, currentVal, 'Edit Registry Value', newVal => {
      if (newVal === null) return;
      if (entry.type === 'REG_DWORD') {
        entry.value = parseInt(newVal) || 0;
      } else {
        entry.value = newVal;
      }
      saveRegistry();
      applyRegistryEffects(hive, keyPath, valName, entry.value);
      renderVals(hive, keyPath);
    }, 'icon:regedit');
  }

  function applyRegistryEffects(hive, keyPath, valName, newValue) {
    if (hive === 'HKEY_SLEEPBOX_MACHINE') {
      if (keyPath === 'SYSTEM\\CurrentConfig') {
        if (valName === 'CRT_SCANLINES') {
          osSettings.crtScanlines = !!newValue;
          const crt = document.getElementById('crt');
          if (crt) crt.style.display = newValue ? '' : 'none';
        } else if (valName === 'VIDEO_DITHER') {
          osSettings.videoDither = !!newValue;
          document.querySelectorAll('.vp-dither').forEach(d => d.style.display = newValue ? '' : 'none');
        } else if (valName === 'CLOCK_FORMAT') {
          osSettings.clock12h = (newValue === '12h');
          updateClock();
        }
        saveSettings();
      } else if (keyPath === 'SOUL\\Metrics') {
        if (valName === 'SOUL_INTEGRITY') {
          const bar = document.getElementById('bar-soul');
          const val = document.getElementById('val-soul');
          const v = Math.max(0, Math.min(99, parseInt(newValue) || 0));
          if (bar) bar.style.width = v + '%';
          if (val) val.textContent = v + '%';
        } else if (valName === 'DAEMON_COUNT') {
          const count = parseInt(newValue) || 0;
          if (count !== 7) triggerGlitch({ intensity: Math.abs(count - 7) > 3 ? 6 : 3 });
          updateDaemonStory(story => {
            story.lastEventText = count > 7 ? 'daemon count elevated - ' + count : count < 7 ? 'daemon count reduced - ' + count : 'daemon count nominal';
          }, { forceSync: true });
          if (typeof renderDaemonPanel === 'function' && document.getElementById('wb-daemon')) renderDaemonPanel();
        } else if (valName === 'TEMPORAL_DRIFT') {
          triggerGlitch({ intensity: 3 });
          updateDaemonStory(story => { story.lastEventText = 'temporal drift set: ' + String(newValue); }, { forceSync: true });
          if (typeof renderDaemonPanel === 'function' && document.getElementById('wb-daemon')) renderDaemonPanel();
        }
      } else if (keyPath === 'VOID') {
        if (valName === 'VOID_PRESSURE_BASE') {
          const base = Math.max(0, Math.min(99, parseInt(newValue) || 0));
          triggerGlitch({ intensity: base > 50 ? 7 : base > 25 ? 5 : 2 });
          if (typeof renderVoid === 'function' && document.getElementById('wb-void')) renderVoid();
        } else if (valName === 'OBSERVER_COUNT') {
          const val = String(newValue).trim();
          if (val !== '[classified]' && val !== '') {
            triggerGlitch({ intensity: 8 });
            updateDaemonStory(story => { story.lastEventText = 'observer count declassified: ' + val; }, { forceSync: true });
          }
        }
      } else if (keyPath === 'Containment') {
        if (valName === 'RESPAWN_LOCK') {
          updateDaemonStory(story => {
            if (story.openedDaemon && !story.daemonStopped) {
              story.lastEventText = Number(newValue) === 0 ? 'respawn lock cleared' : 'respawn lock raised';
            }
          }, { forceSync: true });
        } else if (valName === 'MIRROR_LOCK') {
          updateDaemonStory(story => {
            if (Number(newValue) === 0) {
              if (story.stage >= 4) story.lastEventText = story.anchorDeleted ? 'mirror lattice lowered' : 'mirror lock lowered';
            } else if (story.anchorDeleted && story.stage >= 6) {
              story.mirrorLockRestored = true;
              story.lastEventText = 'mirror lattice restored';
            } else if (story.anchorDeleted) {
              story.lastEventText = 'mirror lock raised';
            }
          }, { forceSync: true, glitch: Number(newValue) === 0 && daemonStory.stage >= 5 });
        }
      }
    } else if (hive === 'HKEY_CURRENT_USER') {
      if (keyPath === 'Desktop' && valName === 'Wallpaper') {
        applyWallpaper(String(newValue), { updateRegistry: false, deferMissing: false });
      } else if (keyPath === 'SOFTWARE\\sleepOS') {
        if (valName === 'SkipBoot') {
          osSettings.skipBoot = !!newValue;
          saveSettings();
        } else if (valName === 'IdleSleepMinutes') {
          const normalized = normalizeIdleSleepMinutes(newValue);
          registryData[hive][keyPath][valName].value = normalized;
          saveRegistry();
          scheduleIdleSleep();
        }
      }
    }
  }

  // ── Menu bar ────────────────────────────────────────────────────
  mb.innerHTML = '';
  [
    { label: 'Registry', items: [
      { label: 'Export...', action: async () => {
        let txt = 'Windows Registry Editor Version 5.00\n\n';
        Object.keys(registryData).forEach(hive => {
          Object.keys(registryData[hive]).forEach(keyPath => {
            txt += '[' + hive + '\\' + keyPath + ']\n';
            const data = registryData[hive][keyPath];
            Object.keys(data).forEach(v => {
              const e = data[v];
              if (e.type === 'REG_DWORD') txt += '"' + v + '"=dword:' + (e.value >>> 0).toString(16).padStart(8,'0') + '\n';
              else txt += '"' + v + '"="' + String(e.value).replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"\n';
            });
            txt += '\n';
          });
        });
        const fname = 'registry_export.reg';
        // The success alert has to sit after the await and inside the guard.
        // Left where it was it would fire before the write resolved, and the OS
        // would cheerfully report an export that never happened.
        try {
          await vfsWriteFile(fname, txt, '');
        } catch (err) {
          osAlert(
            err.code === 'ENOSPC' ? 'Not enough space to export the registry.' : err.message,
            'Export Failed', 'icon:error'
          );
          return;
        }
        osAlert('Registry exported to:\nC:\\sleepOS\\' + fname, 'Export', 'icon:regedit');
      }},
      '-',
      { label: 'Close', action: () => closeWin('regedit') },
    ]},
    { label: 'Edit', items: [
      { label: 'Modify', disabled: !selectedPath, action: () => {
        if (!selectedPath) return;
        const keys = Object.keys(registryData[selectedPath.hive][selectedPath.key]);
        const editableKey = keys.find(valName => !isLockedRegValue(selectedPath.hive, selectedPath.key, valName));
        if (editableKey) editRegValue(selectedPath.hive, selectedPath.key, editableKey);
      }},
    ]},
    { label: 'Help', items: [
      { label: 'About Registry Editor', action: () => osAlert('Registry Editor\nsleepOS v0.9β\n\nModifying registry values affects\nlive system behavior.\n\nProceed with caution.', 'About', 'icon:regedit') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items); });
    mb.appendChild(span);
  });

  buildTree();
  if (ws) ws.textContent = 'My Computer';
}

// ─────────────────────────────────────────────────────────────────
// CALCULATOR
// ─────────────────────────────────────────────────────────────────
function openCalculator() {
  if (!mkWin({ id:'calc', title:'Calculator', icon:'icon:calc', w:240, h:300, x:200, y:120, menubar:true, statusbar:false })) return;
  const body = document.getElementById('wb-calc');
  const mb   = document.getElementById('mb-calc');
  body.style.cssText = 'padding:0;overflow:hidden;';

  let calcMode = 'dec'; // dec | hex | bin
  let calcExpr = '';
  let calcDisplay = '0';
  let calcOp = null;
  let calcPrev = null;
  let calcNewNum = true;

  const wrap = document.createElement('div');
  wrap.className = 'calc-body';
  body.appendChild(wrap);

  const display = document.createElement('div');
  display.className = 'calc-display';
  display.textContent = '0';
  wrap.appendChild(display);

  const subDisplay = document.createElement('div');
  subDisplay.style.cssText = 'font-size:10px;color:#555;text-align:right;min-height:14px;';
  wrap.appendChild(subDisplay);

  const modeRow = document.createElement('div');
  modeRow.className = 'calc-mode-row';
  ['dec','hex','bin'].forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'calc-mode-btn' + (m === calcMode ? ' active' : '');
    btn.textContent = m.toUpperCase();
    btn.setAttribute('data-mode', m);
    btn.addEventListener('click', () => {
      calcMode = m;
      modeRow.querySelectorAll('.calc-mode-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === m));
      updateDisplay();
      renderGrid();
    });
    modeRow.appendChild(btn);
  });
  wrap.appendChild(modeRow);

  const grid = document.createElement('div');
  grid.className = 'calc-grid';
  wrap.appendChild(grid);

  function getDisplayValue() {
    const n = parseFloat(calcDisplay);
    if (isNaN(n)) return calcDisplay;
    if (calcMode === 'hex') return '0x' + Math.trunc(n).toString(16).toUpperCase();
    if (calcMode === 'bin') return '0b' + Math.trunc(n).toString(2);
    return calcDisplay;
  }

  function updateDisplay() {
    display.textContent = getDisplayValue();
    if (calcOp && calcPrev !== null) {
      subDisplay.textContent = calcPrev + ' ' + calcOp;
    } else {
      subDisplay.textContent = '';
    }
  }

  function pressDigit(d) {
    if (calcNewNum) { calcDisplay = String(d); calcNewNum = false; }
    else { if (calcDisplay === '0' && d !== '.') calcDisplay = String(d); else calcDisplay += String(d); }
    updateDisplay();
  }

  function pressOp(op) {
    const cur = parseFloat(calcDisplay);
    if (calcOp && !calcNewNum && calcPrev !== null) {
      calcPrev = doCalc(calcPrev, cur, calcOp);
      calcDisplay = String(calcPrev);
    } else {
      calcPrev = cur;
    }
    calcOp = op;
    calcNewNum = true;
    updateDisplay();
  }

  function doCalc(a, b, op) {
    switch(op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      case '%': return a % b;
    }
    return b;
  }

  function pressEquals() {
    const cur = parseFloat(calcDisplay);
    if (calcOp && calcPrev !== null) {
      const result = doCalc(calcPrev, cur, calcOp);
      calcDisplay = isNaN(result) ? 'Error' : String(result);
      calcOp = null; calcPrev = null; calcNewNum = true;
      updateDisplay();
    }
  }

  function pressClear() {
    calcDisplay = '0'; calcOp = null; calcPrev = null; calcNewNum = true;
    updateDisplay();
  }

  function pressCE() {
    calcDisplay = '0'; calcNewNum = true; updateDisplay();
  }

  function pressBS() {
    if (calcNewNum || calcDisplay.length <= 1 || calcDisplay === 'Error') {
      calcDisplay = '0'; calcNewNum = true;
    } else {
      calcDisplay = calcDisplay.slice(0, -1) || '0';
    }
    updateDisplay();
  }

  function pressPlusMinus() {
    const n = parseFloat(calcDisplay);
    if (!isNaN(n) && n !== 0) { calcDisplay = String(-n); updateDisplay(); }
  }

  function renderGrid() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    grid.style.gridTemplateRows = 'repeat(5, 1fr)';

    const buttons = [
      ['CE','C','BS','/'],
      ['7','8','9','*'],
      ['4','5','6','-'],
      ['1','2','3','+'],
      ['+/-','0','.','='],
    ];

    if (calcMode === 'hex') {
      // Replace digits row 1 with hex letters
      buttons.unshift(['A','B','C','D']);
      buttons[1] = ['E','F','CE','C'];
      grid.style.gridTemplateRows = 'repeat(6, 1fr)';
    }

    buttons.forEach(row => {
      row.forEach(label => {
        const btn = document.createElement('button');
        const isOp  = ['+','-','*','/','%'].includes(label);
        const isEq  = label === '=';
        const isCl  = label === 'C' || label === 'CE';
        btn.className = 'calc-btn' + (isOp ? ' op' : '') + (isEq ? ' equals' : '') + (isCl ? ' clear' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
          if (/^[0-9A-F]$/.test(label)) pressDigit(label);
          else if (label === '.') { if (!calcDisplay.includes('.')) pressDigit('.'); }
          else if (isOp) pressOp(label);
          else if (isEq) pressEquals();
          else if (label === 'C') pressClear();
          else if (label === 'CE') pressCE();
          else if (label === 'BS') pressBS();
          else if (label === '+/-') pressPlusMinus();
        });
        grid.appendChild(btn);
      });
    });
    updateDisplay();
  }

  // Keyboard support
  const calcKeyHandler = e => {
    if (!wins['calc']) { document.removeEventListener('keydown', calcKeyHandler); return; }
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA') && focused.closest('#win-calc') === null) return;
    const map = {
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      '+':'+','-':'-','*':'*','/':'/',
      'Enter':'=','=':'=',
      'Backspace':'BS','Delete':'C','Escape':'C','.':'.',
    };
    if (map[e.key]) {
      e.preventDefault();
      const lbl = map[e.key];
      if (/^[0-9]$/.test(lbl)) pressDigit(lbl);
      else if (['+','-','*','/'].includes(lbl)) pressOp(lbl);
      else if (lbl === '=') pressEquals();
      else if (lbl === 'C') pressClear();
      else if (lbl === 'BS') pressBS();
      else if (lbl === '.') { if (!calcDisplay.includes('.')) pressDigit('.'); }
    }
  };
  document.addEventListener('keydown', calcKeyHandler);

  // Menu bar
  mb.innerHTML = '';
  const editSpan = document.createElement('span');
  editSpan.className = 'menu-item'; editSpan.textContent = 'Edit';
  editSpan.addEventListener('click', e => {
    e.stopPropagation();
    showDropdown(editSpan, [
      { label: 'Copy', action: () => navigator.clipboard?.writeText(display.textContent) },
      { label: 'Paste', action: () => navigator.clipboard?.readText().then(t => {
        const n = parseFloat(t);
        if (!isNaN(n)) { calcDisplay = String(n); calcNewNum = false; updateDisplay(); }
      })},
    ]);
  });
  mb.appendChild(editSpan);
  const viewSpan = document.createElement('span');
  viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
  viewSpan.addEventListener('click', e => {
    e.stopPropagation();
    showDropdown(viewSpan, [
      { label: (calcMode==='dec'?'* ':'  ')+'Decimal',  action: () => { calcMode='dec'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='dec')); updateDisplay(); renderGrid(); }},
      { label: (calcMode==='hex'?'* ':'  ')+'Hexadecimal', action: () => { calcMode='hex'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='hex')); updateDisplay(); renderGrid(); }},
      { label: (calcMode==='bin'?'* ':'  ')+'Binary',   action: () => { calcMode='bin'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='bin')); updateDisplay(); renderGrid(); }},
    ]);
  });
  mb.appendChild(viewSpan);

  renderGrid();
}

// ─────────────────────────────────────────────────────────────────
// RUN DIALOG
// ─────────────────────────────────────────────────────────────────
function openRunDialog() {
  const id = 'run-dialog';
  const p = _osDlgPos(360, 160);
  if (!mkWin({ id, title:'Run', icon:'icon:exe', w:360, h:160, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:10px;font-size:11px;';
  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div class="dlg-icon">${iconMarkup('icon:exe')}</div>
      <div style="flex:1;">
        <div style="margin-bottom:8px;line-height:1.5;">Type the name of a program to open it.</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="white-space:nowrap;">Open:</span>
          <input id="run-input" type="text" style="flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;padding:2px 4px;font-family:var(--sleep-font);font-size:11px;background:#fff;">
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:6px;">
      <button class="dlg-btn primary" id="run-ok">OK</button>
      <button class="dlg-btn" id="run-cancel">Cancel</button>
    </div>`;
  const inp = document.getElementById('run-input');
  const ok  = document.getElementById('run-ok');
  const can = document.getElementById('run-cancel');

  const RUN_MAP = {
    'notepad': openNotepad, 'notepad.exe': openNotepad,
    'terminal': openTerminal, 'terminal.exe': openTerminal,
    'calc': openCalculator, 'calc.exe': openCalculator,
    'calculator': openCalculator,
    'regedit': openRegedit, 'regedit.exe': openRegedit,
    'sysmon': openSysmon,
    'explorer': openExplorer, 'explorer.exe': openExplorer,
    'defrag': openDefrag, 'defrag.exe': openDefrag,
    'browser': openBrowser, 'browser.exe': openBrowser,
    'welcome': openWelcome, 'welcome.readme': openWelcome,
    'sysmon.exe': openSysmon,
    'void.tmp': openVoid, 'daemon.core': openDaemon,
    '?????.exe': openUnknown,
  };

  ok.addEventListener('click', () => {
    const v = inp.value.trim().toLowerCase();
    if (!v) return;
    closeWin(id);
    const fn = RUN_MAP[v];
    if (fn) { fn(); return; }
    // Four forms, matching what the registry's programProjectEntry (os/programs.js)
    // and the old findTerminalProject both accept: the file name, the file name
    // minus .html, the project name, and the project name with spaces hyphenated.
    // That last form used to be missing here, so a Run... of "sand-playground"
    // failed while START sand-playground (going through the registry) worked.
    const proj = PROJECTS.find(p =>
      p.file.toLowerCase() === v ||
      p.file.toLowerCase().replace('.html','') === v ||
      p.name.toLowerCase() === v ||
      p.name.toLowerCase().replace(/ /g, '-') === v
    );
    if (proj) { window.open(proj.file, '_blank'); return; }
    // The error icon, not the Run dialog's own executable one: this is a
    // failure, and every other failure in the OS is titled and iconed as one.
    osAlert('Cannot find program:\n"' + inp.value + '"\n\nMake sure the name is correct and try again.', 'Cannot Find Program', 'icon:error');
  });
  can.addEventListener('click', () => closeWin(id));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') ok.click();
    if (e.key === 'Escape') can.click();
  });
  setTimeout(() => inp.focus(), 40);
}

// ─────────────────────────────────────────────────────────────────
// SPACE+TAB / KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────
let altTabActive = false;
let altTabIdx = 0;
let altTabWinIds = [];
let spaceTabHeld = false;

function getAltTabWindowIds() {
  return Object.entries(wins)
    .filter(([, win]) => !win.minimized)
    .sort(([, a], [, b]) => (parseInt(b.el.style.zIndex, 10) || 0) - (parseInt(a.el.style.zIndex, 10) || 0))
    .map(([id]) => id);
}

function renderAltTab() {
  const box = document.getElementById('alttab-box');
  if (!box) return;
  if (!altTabWinIds.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '';
  const head = document.createElement('div');
  head.id = 'alttab-head';
  head.innerHTML = `
    <div id="alttab-title">Window Switcher</div>
    <div id="alttab-hint">Hold Space, tap Tab, release Space to select</div>`;
  box.appendChild(head);
  const strip = document.createElement('div');
  strip.id = 'alttab-strip';
  altTabWinIds.forEach((id, i) => {
    const w = wins[id];
    const item = document.createElement('div');
    item.className = 'alttab-item' + (i === altTabIdx ? ' focused' : '');
    item.innerHTML = '<div class="at-icon">' + iconMarkup(w.icon || 'icon:text') + '</div><div class="at-label">' + escHtml(w.title || id) + '</div>';
    item.addEventListener('click', () => {
      altTabIdx = i;
      commitAltTab();
    });
    strip.appendChild(item);
  });
  box.appendChild(strip);
}

function openAltTab(direction) {
  const ids = getAltTabWindowIds();
  if (ids.length === 0) return;
  const step = direction === -1 ? -1 : 1;
  altTabWinIds = ids;
  if (!altTabActive) altTabIdx = ids.length === 1 ? 0 : (step > 0 ? 1 : ids.length - 1);
  else altTabIdx = (altTabIdx + step + ids.length) % ids.length;
  renderAltTab();
  document.getElementById('alttab-overlay').classList.add('active');
  altTabActive = true;
}

function commitAltTab() {
  document.getElementById('alttab-overlay').classList.remove('active');
  altTabActive = false;
  const id = altTabWinIds[altTabIdx];
  if (id && wins[id]) {
    if (wins[id].minimized) unminWin(id);
    else focusWin(id);
  }
  altTabWinIds = [];
}

function closeAltTab() {
  document.getElementById('alttab-overlay').classList.remove('active');
  altTabActive = false;
  altTabIdx = 0;
  altTabWinIds = [];
  renderAltTab();
}

function closeCad() {
  document.getElementById('cad-overlay').classList.remove('active');
}
function cadAction(type) {
  closeCad();
  if (type === 'lock') {
    const lock = document.createElement('div');
    lock.id = 'lock-screen';
    lock.style.cssText = 'position:fixed;inset:0;z-index:99995;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
    lock.innerHTML = `
      <div class="lock-screen-icon">${iconMarkup('icon:lock')}</div>
      <div style="color:#ccc;font-size:13px;font-family:var(--sleep-font);">sleepOS is locked</div>
      <div style="color:#666;font-size:11px;font-family:var(--sleep-font);">Press any key or click to unlock</div>`;
    document.body.appendChild(lock);
    const unlock = () => { lock.remove(); };
    lock.addEventListener('click', unlock);
    lock.addEventListener('keydown', unlock);
    setTimeout(() => lock.addEventListener('keydown', unlock), 100);
  } else if (type === 'taskmgr') {
    openSysmon();
  } else if (type === 'shutdown') {
    doShutdown();
  }
}

// ── Global keyboard shortcuts ─────────────────────────────────────
document.addEventListener('keydown', e => {
  // Don't fire in inputs/textareas (except specific shortcuts)
  const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
  const key = String(e.key || '').toLowerCase();
  const secureAttention = e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && key === 'q';

  if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (!inInput) {
      spaceTabHeld = true;
      e.preventDefault();
    }
    return;
  }
  if (!inInput && e.key === 'Tab' && spaceTabHeld && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    openAltTab(e.shiftKey ? -1 : 1);
    return;
  }
  if (inInput && !secureAttention) return;

  // Ctrl+Shift+Q - secure attention sequence
  if (secureAttention) {
    e.preventDefault();
    document.getElementById('cad-overlay').classList.add('active');
    return;
  }

  // Escape - close context menus / dismiss overlays
  if (e.key === 'Escape') {
    closeDropdown();
    closeStart();
    const cad = document.getElementById('cad-overlay');
    if (cad.classList.contains('active')) cad.classList.remove('active');
    if (altTabActive) closeAltTab();
    return;
  }

});
document.addEventListener('keyup', e => {
  if (e.code !== 'Space') return;
  const wasHeld = spaceTabHeld;
  spaceTabHeld = false;
  if (!wasHeld || !altTabActive) return;
  e.preventDefault();
  commitAltTab();
});
window.addEventListener('blur', () => {
  spaceTabHeld = false;
  if (altTabActive) closeAltTab();
});

// ─────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────
function startDesktop() {
  document.getElementById('desktop').style.display = 'block';
  document.getElementById('taskbar').style.display = 'flex';
  const savedWp = getInitialWallpaperPath();
  if (savedWp) applyWallpaper(savedWp, { deferMissing: !isSystemWallpaperPath(savedWp) });
  applySettings();
  applyDaemonVisualState();
  setupIcons();
  initSystemAudio();
  // Silent unless the user already clicked or typed - most often to skip the
  // BIOS screen, which is exactly when a startup jingle belongs. On a cold load
  // that runs the boot text to the end, no gesture has happened and the browser
  // will not let audio start, so this is a no-op rather than a chime that fires
  // late. The ambience below has no such problem: it records the request and
  // begins at the first click.
  playSound('boot');
  startSoundLoop('ambience');
  armIdleSleep();
}
