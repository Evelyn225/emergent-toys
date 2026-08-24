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
