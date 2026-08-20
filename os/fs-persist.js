// ── Filesystem persistence ────────────────────────────────────────
const DRIVE_STATE_KEY = 'sleepOS-drive-state';
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
// It is now the ratio of extra block runs to total blocks, computed from the
// real allocation map. It is cached because reading it walks every inode and
// SYSMON asks often; fsRefreshFragmentation() is what recomputes.
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

// DEFRAG.exe calls this when the user runs an optimization pass. It records
// when the pass happened, which is what the "Last defrag" line reads, and then
// recomputes from the allocation map.
//
// It does NOT yet move any blocks, so the number it recomputes will barely
// change. That is deliberate and it is honest: actually rewriting blocks into
// contiguous runs is phase 5's job, per the master spec's phase order.
//
// The returned level is what DEFRAG.exe renders. It briefly did not: this
// function stopped honouring the targetLevel option its one caller passed, and
// that caller went on painting a hardcoded "Fragmentation: 2%" of its own, so
// the fake post-defrag drop survived in the UI after being deleted from the
// model. Inventing that number is the exact fiction this phase exists to
// delete, so the option is gone rather than ignored.
async function optimizeDriveFragmentation(options) {
  defragState.lastDefragTs = Date.now();
  saveDriveState();
  try { localStorage.setItem(LEGACY_DEFRAG_KEY, String(defragState.lastDefragTs)); } catch (e) {}
  const level = await fsRefreshFragmentation();
  if (!options?.silent && typeof applyDaemonVisualState === 'function') applyDaemonVisualState();
  return level;
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
