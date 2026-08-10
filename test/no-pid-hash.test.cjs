'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readManifest } = require('../tools/verify-split.cjs');
const ROOT = path.join(__dirname, '..');

// Phase 3 replaced hashed window ids with real pids. These are gone rather than
// deprecated because a second source of pids is exactly how ps starts lying again.
const RETIRED = ['pidFromId', 'winIdByPid'];

test('no source invents a pid', () => {
  const offenders = [];
  for (const rel of readManifest()) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      RETIRED.forEach(name => {
        if (new RegExp('\\b' + name + '\\b').test(line)) offenders.push(`${rel}:${i + 1}: ${name}`);
      });
    });
  }
  assert.deepStrictEqual(offenders, [], 'invented pids:\n  ' + offenders.join('\n  '));
});
