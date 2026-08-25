'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readManifest } = require('../tools/verify-split.cjs');

const ROOT = path.join(__dirname, '..');

// Phase 2 replaced these with the VFS. They are gone rather than deprecated
// because a second way to reach the filesystem is exactly how the tree and
// the persisted snapshot drift apart.
const RETIRED = ['fsGetEntry', 'fsWriteTextFile', 'fsWriteBlobFile', 'fsCreateDir', 'fsGetDir', 'termFS', 'schedSave',
  // Phase 4: fragmentation became a measurement, so the machinery that faked
  // it is gone. Listed here so it cannot creep back one call site at a time.
  'trackFragmentation', 'increaseDriveFragmentation', 'calcTextFragmentationDelta',
  'calcBlobFragmentationDelta', 'calcRemovalFragmentationDelta',
  // Task 9e: the media-IndexedDB blob mirror. Blocks (os/storage-idb.js) are
  // the durable store now; this whole second copy is gone, not just unused.
  'openMediaDb', 'storeBlobEntryInDb', 'removeBlobEntryFromDb', 'renameBlobEntryInDb',
  'moveBlobEntryInDb', 'copyBlobEntryInDb', 'moveBlobSubtreeInDb', 'loadBlobsFromIndexedDb',
  // Task 9f: the base64-in-localStorage blob mirror, the last one - blocks
  // are the sole blob store now. blobStorageKey, saveBlobEntry and friends
  // had nothing left to do once both halves of every function here were
  // gone; loadBlobsFromStorage's boot-restore job moved onto
  // loadBlobsFromBlocks directly. readFileAsArrayBuffer (os/media.js) was
  // saveBlobEntry's only caller's only reason to read a File's bytes twice.
  'blobStorageKey', 'saveBlobEntry', 'removeBlobEntry', 'renameBlobEntry',
  'moveBlobEntryStorage', 'copyBlobEntryStorage', 'moveBlobStorageSubtree',
  'loadBlobsFromStorage', 'readFileAsArrayBuffer',
  // Task 10: optimizeDriveFragmentation's targetLevel option. It asked for a
  // post-defrag number instead of measuring one, and it outlived the code that
  // honoured it - apps/defrag.js kept passing it for a whole phase while it
  // did nothing.
  'targetLevel',
  // Phase 5: DEFRAG drives fsRunCompaction directly now. This was its old
  // entry point and became unreachable the moment compaction became real -
  // everything it did except applyDaemonVisualState (obsolete since phase 4
  // gave the daemon its own corruption dial) is in fsRunCompaction's finally.
  'optimizeDriveFragmentation'];

test('no source reaches the filesystem outside the VFS', () => {
  const offenders = [];
  for (const rel of readManifest()) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;   // comments may name them
      RETIRED.forEach(name => {
        if (new RegExp('\\b' + name + '\\b').test(line)) {
          offenders.push(`${rel}:${i + 1}: ${name}`);
        }
      });
    });
  }
  assert.deepStrictEqual(offenders, [], 'legacy filesystem access:\n  ' + offenders.join('\n  '));
});

// os/daemon.js is not loadable in the vm harness, so its two direct-tree
// mutators cannot be covered by a behavioural test. Guard them at the source
// level instead: a pathless op is invisible to a backend that commits from ops
// alone, and the failure mode is silent - the story files simply stop
// persisting, with no error anywhere.
// The RETIRED list above catches a dead identifier coming back. It cannot
// catch the other half of the same bug, which is what actually shipped: the
// identifier went away and the UI simply hardcoded the number it used to
// produce. apps/defrag.js is not loadable in this harness - openDefrag builds
// a real DOM subtree through mkWin before any of its logic runs - so this is a
// source-level guard rather than a behavioural one. It is narrow on purpose:
// it asserts only that no percentage is written into one of the two drive
// stats as a literal, which is the precise shape of the regression.
test('DEFRAG.exe does not paint a hardcoded drive statistic', () => {
  const src = fs.readFileSync(path.join(ROOT, 'apps/defrag.js'), 'utf8');
  const offenders = [];
  src.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    // Only lines that write one of the two drive stats. The progress bar
    // (pbFill/pbLabel) is deliberately not matched - its 98% is a story beat
    // about a file that will not move, not a measurement of anything.
    if (!/df-frag|df-pct|Fragmentation:|% optimized/.test(line)) return;
    if (/\d+ ?%/.test(line)) offenders.push('apps/defrag.js:' + (i + 1) + ': ' + line.trim());
  });
  assert.deepStrictEqual(offenders, [], 'hardcoded drive statistic:\n  ' + offenders.join('\n  '));
  // Capacity and Free were string literals describing a 2 GB drive that never
  // existed. They must come from the superblock now.
  assert.ok(!/Capacity:\s*[\d,]+\s*MB/.test(src), 'Capacity is still a hardcoded string');
  assert.ok(!/Free:\s*[\d,]+\s*MB/.test(src), 'Free is still a hardcoded string');
  assert.ok(/fsRunCompaction/.test(src), 'Start does not run a real compaction');
  // The Drive menu label carried its own fabricated capacity for a whole phase
  // because the guard only looked at the info row's prefixes.
  assert.ok(!/\(\s*[\d,]{4,}\s*MB\s*\)/.test(src),
    'a hardcoded drive size is back in a menu label or similar');
});

// apps/defrag.js cannot be loaded in this harness - openDefrag builds a real
// DOM subtree through mkWin before any of its logic runs - so this is a
// source-level guard, narrow on purpose. It catches the exact regression this
// task exists to fix: a grid built from random numbers instead of the disk.
test('DEFRAG.exe builds its grid from the disk, not from random numbers', () => {
  const src = fs.readFileSync(path.join(ROOT, 'apps/defrag.js'), 'utf8');
  const offenders = [];
  src.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (/Math\.random/.test(line)) offenders.push(`apps/defrag.js:${i + 1}: ${line.trim()}`);
  });
  assert.deepStrictEqual(offenders, [], 'the block grid must render the real bitmap:\n  ' + offenders.join('\n  '));
  assert.ok(/fsBitGet|_readInodeEntries/.test(src), 'nothing in DEFRAG reads the real allocation map');
  assert.ok(/COLS\s*=\s*128/.test(src) && /ROWS\s*=\s*32/.test(src),
    'the grid must be 128x32, one cell per block on a 4096-block drive');
});

test('no source reintroduces the retired legacy-write pathless-op marker', () => {
  const offenders = [];
  for (const rel of readManifest()) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (/\blegacy-write\b/.test(line)) offenders.push(`${rel}:${i + 1}: legacy-write`);
    });
  }
  assert.deepStrictEqual(offenders, [], 'pathless ops:\n  ' + offenders.join('\n  '));
});

// The dirent key format (`parentIno + '/' + name`) was written out by hand in
// four places and parsed by hand in three more, across os/fs-format.js,
// os/storage-idb.js and os/fs-migrate.js. Nothing was wrong with any single
// copy - they agreed - but the format was spread across the codebase instead
// of owned by it, and changing it would have meant finding every copy.
//
// The spec named this exact failure in advance: os/storage-idb.js was to stay
// "well under a hundred lines; if it grows past that, logic has leaked out of
// the pure core and belongs back in it". It reached 437 lines, and this was
// the leak.
//
// Two checkable rules, both currently true with zero exceptions:
//   - only os/fs-format.js reads or writes an individual dirent by key
//     (naming the store for a schema or a transaction scope is not that, and
//     neither is scanning every row)
//   - only os/fs-format.js parses a key apart
//
// What this does NOT catch: a hand-built key passed through a variable, or a
// split written some other way. It catches the shapes that were actually
// there, which is what a guard can honestly promise.
test('the dirent key format lives in exactly one file', () => {
  const offenders = [];
  for (const rel of readManifest()) {
    if (rel === 'os/fs-format.js') continue;
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (/\.(get|put|del)\(\s*FS_STORE_DIRENTS/.test(line)) {
        offenders.push(`${rel}:${i + 1}: keyed dirent access outside fs-format`);
      }
      if (/indexOf\(\s*'\/'\s*\)/.test(line) && /key|dirent/i.test(line)) {
        offenders.push(`${rel}:${i + 1}: hand-parsed dirent key`);
      }
    });
  }
  assert.deepStrictEqual(offenders, [],
    'the dirent key shape belongs to os/fs-format.js - use _fsDirentKey / _fsDirentSplit:\n  '
    + offenders.join('\n  '));
});
