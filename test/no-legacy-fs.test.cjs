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
  'loadBlobsFromStorage', 'readFileAsArrayBuffer'];

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
