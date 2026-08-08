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
// call sites this is not a persistence bug: vfsBootMount runs it on every boot
// from a constant, so its effect is regenerated rather than restored. Adding
// schedSave() here would commit a snapshot on every cold boot for no gain.
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

// Two call sites still mutate the shared tree directly rather than going
// through vfsWriteFile/vfsMkdir: os/daemon.js ensureFsDir and
// ensureStoryTextFile. A direct mutation never touches the VFS's own op queue,
// so vfsFlush would see nothing to commit and vfsHasPendingWrites would report
// false even though the tree changed underneath it. Queue a marker op so both
// stay correct - this is the same debounced commit the old schedSave/saveFS
// pair provided, just routed through the VFS. Retiring these two is tracked
// separately; converting ensureStoryTextFile is not a one-liner, because
// syncDaemonStoryFiles must stay synchronous and vfsWriteFile fragments the
// drive by default.
function schedSave() {
  if (typeof _vfsQueue === 'function') _vfsQueue({ op: 'legacy-write' }, 0);
}

function computeLegacyFragLevel(ms) {
  if (ms === null) return 0.68;
  const hours = ms / 3600000;
  if (hours < 0.01) return 0.02;
  return Math.min(0.9, 0.02 + 0.88 * Math.pow(hours / 168, 0.38));
}

function createDriveStateDefaults(fromLegacy) {
  const legacyTs = fromLegacy ? parseInt(localStorage.getItem(LEGACY_DEFRAG_KEY) || '0', 10) || 0 : 0;
  const msSince = legacyTs ? Date.now() - legacyTs : null;
  return {
    level: computeLegacyFragLevel(msSince),
    lastDefragTs: legacyTs,
    changeCount: 0,
    lastMutationTs: 0,
  };
}

function normalizeDriveState(saved) {
  const next = Object.assign(createDriveStateDefaults(false), saved || {});
  next.level = Math.max(0.02, Math.min(0.92, Number(next.level) || 0.68));
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

function getDriveFragmentationLevel() {
  return Math.max(0.02, Math.min(0.92, Number(defragState?.level) || 0.68));
}

function getDriveOptimizationPercent() {
  return Math.round((1 - getDriveFragmentationLevel()) * 100);
}

function increaseDriveFragmentation(amount, options) {
  const delta = Number(amount) || 0;
  if (!(delta > 0)) return getDriveFragmentationLevel();
  defragState.level = Math.min(0.92, getDriveFragmentationLevel() + delta);
  defragState.changeCount = Math.max(0, Math.trunc(Number(defragState.changeCount) || 0)) + 1;
  defragState.lastMutationTs = Date.now();
  saveDriveState();
  if (!options?.silent && typeof applyDaemonVisualState === 'function') applyDaemonVisualState();
  return defragState.level;
}

function optimizeDriveFragmentation(options) {
  const targetLevel = Math.max(0.02, Math.min(0.12, Number(options?.targetLevel) || 0.06));
  defragState.level = targetLevel;
  defragState.lastDefragTs = Date.now();
  saveDriveState();
  try { localStorage.setItem(LEGACY_DEFRAG_KEY, String(defragState.lastDefragTs)); } catch (e) {}
  if (!options?.silent && typeof applyDaemonVisualState === 'function') applyDaemonVisualState();
  return defragState.level;
}

// Async boot entry point. Called from the BIOS sequence before startDesktop.
async function vfsBootMount() {
  await vfsMount(createLocalStorageBackend(), {
    onChange: () => { document.dispatchEvent(new CustomEvent('fs-changed')); },
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
  loadBlobsFromStorage();
  // The load-time syncDaemonStory ran against the seed tree, which the mount
  // then replaced. Re-run it against the real tree so the story files and the
  // registry pointers agree. Same shape as the ensureFsDir call above.
  syncDaemonStory({ silent: true });
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

// beforeunload cannot await, and a pending commit sits behind a 400ms
// debounce, so `void vfsFlush()` here would silently drop up to 400ms of the
// user's work on close. The old saveFS wrote synchronously and always landed;
// losing that would be a data-loss regression in the one phase that exists to
// stop silently losing data.
//
// localStorage.setItem is synchronous, so write the snapshot directly. This
// deliberately reaches past the backend interface: it is the only place that
// does, and it is correct only because phase 2's backend is localStorage.
// PHASE 4 MUST REVISIT THIS - IndexedDB cannot be written synchronously at
// all, and the answer there is flushing on `visibilitychange` instead.
window.addEventListener('beforeunload', () => {
  // vfsIsMounted() is the load-bearing half of this guard. vfsMount publishes
  // _vfsBackend only after _vfsRoot holds real data, so this is what stops us
  // serializing the seed tree over a returning visitor's filesystem if they
  // close the tab during the BIOS sequence.
  if (!vfsIsMounted() || !vfsHasPendingWrites()) return;
  try {
    localStorage.setItem(LOCAL_FS_KEY, JSON.stringify(vfsSerializeTree()));
  } catch (e) { /* unload is too late to report anything useful */ }
});

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
