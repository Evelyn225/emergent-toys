// Virtual filesystem. Metadata (path resolution, stat, listing, existence) is
// served synchronously from an in-memory tree. File content reads and all
// writes are async, because phase 4 moves them to IndexedDB.
//
// The API is path-based and never exposes an inode number. That is deliberate:
// it lets phase 4 replace the internal representation with the inode/dirent
// model without touching a single call site.

// Error carrying a POSIX-style code. Callers branch on `.code`, never on the
// message. Codes in use: ENOENT, EEXIST, ENOTDIR, EISDIR, ENOSPC, EINVAL.
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
