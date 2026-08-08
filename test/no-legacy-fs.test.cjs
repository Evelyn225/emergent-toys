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
const RETIRED = ['fsGetEntry', 'fsWriteTextFile', 'fsWriteBlobFile', 'fsCreateDir', 'fsGetDir', 'termFS'];

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
