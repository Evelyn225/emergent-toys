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

async function fsDeleteEntry(store, sb, parentIno, name) {
  const key = _fsDirentKey(parentIno, name);
  const ino = await store.get(FS_STORE_DIRENTS, key);
  if (ino === undefined) return false;
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
async function fsReadTree(store) {
  const sb = await store.get(FS_STORE_SUPERBLOCK, 'sb');
  const dirents = await store.scan(FS_STORE_DIRENTS);
  const byParent = new Map();
  dirents.forEach(([key, ino]) => {
    const slash = key.indexOf('/');
    const parent = Number(key.slice(0, slash));
    const name = key.slice(slash + 1);
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
