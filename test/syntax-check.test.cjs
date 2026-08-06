'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readManifest } = require('../tools/verify-split.cjs');

const ROOT = path.join(__dirname, '..');

// Byte-exact concatenation does NOT imply each file is individually valid:
// a cut landing mid-function yields two files that concatenate perfectly and
// neither of which parses. Every <script src> must parse standalone, so each
// extracted file is compiled on its own here.
test('every extracted file parses standalone as a classic script', () => {
  const failures = [];
  for (const rel of readManifest()) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    try {
      new vm.Script(src, { filename: rel });
    } catch (err) {
      failures.push(`${rel}: ${err.message}`);
    }
  }
  assert.deepStrictEqual(failures, [], 'files failed to parse:\n  ' + failures.join('\n  '));
});
