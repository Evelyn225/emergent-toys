// ── Filesystem persistence ────────────────────────────────────────
const FS_KEY = 'sleepOS-fs';
const DRIVE_STATE_KEY = 'sleepOS-drive-state';
const LEGACY_DEFRAG_KEY = 'sleepOS-defrag-time';
let _fsSaveTimer = null;

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

const SEEDED_DOCS_DATA = _serDir(termFS.subdirs.get('DOCS'));

function refreshSeededDocs() {
  termFS.dirs.add('DOCS');
  let docs = termFS.subdirs.get('DOCS');
  if (!docs) {
    docs = _desDir(SEEDED_DOCS_DATA);
    termFS.subdirs.set('DOCS', docs);
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

function saveFS() {
  try {
    const data = { dirs: [...termFS.dirs], files: {}, subdirs: {} };
    termFS.files.forEach((v, k) => { data.files[k] = v; });
    termFS.subdirs.forEach((v, k) => { data.subdirs[k] = _serDir(v); });
    localStorage.setItem(FS_KEY, JSON.stringify(data));
  } catch(e) { /* quota exceeded - silently ignore */ }
}

function schedSave() {
  clearTimeout(_fsSaveTimer);
  _fsSaveTimer = setTimeout(saveFS, 400);
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

function loadFS() {
  const raw = localStorage.getItem(FS_KEY);
  if (!raw) {
    refreshSeededDocs();
    refreshSeededWallpaperLibrary();
    refreshSeededHomeMedia();
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (data.dirs) data.dirs.forEach(d => termFS.dirs.add(d));
    if (data.files) Object.entries(data.files).forEach(([k, v]) => termFS.files.set(k, v));
    if (data.subdirs) Object.entries(data.subdirs).forEach(([k, v]) => termFS.subdirs.set(k, _desDir(v)));
    refreshSeededDocs();
    refreshSeededWallpaperLibrary();
    refreshSeededHomeMedia();
  } catch(e) { /* corrupted save - ignore */ }
}

loadFS();
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
window.addEventListener('beforeunload', saveFS);
document.addEventListener('fs-changed', schedSave);
