'use strict';
// Concatenate the manifest's source files into sleep-os.bundle.js.
// The bundle is what the browser executes, and it is byte-identical to the
// original inline script. One script means hoisting, scope, and execution
// order are preserved by construction rather than by testing.
//
// Do NOT replace the bundle with per-file <script src> tags. That was tried
// and reverted: function declarations don't hoist across <script> tag
// boundaries, and sleepOS calls functions at load time that are declared
// much later. test/verify-split.test.cjs enforces that sources are never
// loaded directly.
const fs = require('fs');
const path = require('path');
const { readManifest } = require('./verify-split.cjs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'sleep-os.bundle.js');

function build() {
  const manifest = readManifest();
  const parts = manifest.map(rel => fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  return parts.join('');
}

module.exports = { build, OUT };

if (require.main === module) {
  const out = build();
  fs.writeFileSync(OUT, out);
  console.log('built sleep-os.bundle.js: ' + Buffer.byteLength(out) + ' bytes from ' + readManifest().length + ' files');
}
