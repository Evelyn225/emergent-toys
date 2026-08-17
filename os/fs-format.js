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
