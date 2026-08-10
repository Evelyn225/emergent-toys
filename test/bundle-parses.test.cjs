'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const { WORKER_OUT } = require('../tools/build.cjs');

// The browser loads sleep-os.bundle.js as ONE classic script, so every source
// file shares a single top-level scope. Two files each declaring `const FOO`
// is a SyntaxError that kills the whole OS at load time.
//
// Nothing else in this suite can catch that. syntax-check.test.cjs compiles
// each source in isolation, where the collision cannot exist by definition,
// and bundle-current.test.cjs only compares bytes. Only compiling the
// concatenated result sees it.
test('the concatenated bundle parses as a single classic script', () => {
  const src = fs.readFileSync(path.join(ROOT, 'sleep-os.bundle.js'), 'utf8');
  try {
    new vm.Script(src, { filename: 'sleep-os.bundle.js' });
  } catch (err) {
    assert.fail('sleep-os.bundle.js does not parse: ' + err.message);
  }
});

// The worker bundle is a second shared top-level scope, over 4 files
// (tools/worker-manifest.json), and until now had only the per-file check in
// test/worker-build.test.cjs - which compiles each source through
// `new Function(src)`, a more permissive parse than `new vm.Script` (it
// accepts a top-level `return`, among other things) and, being per-file,
// cannot see a collision across files by definition, same as
// syntax-check.test.cjs above.
//
// A collision here is a silent load-time SyntaxError inside a Worker realm
// with no console and no window.onerror: every SPAWN would just do nothing.
test('the concatenated worker bundle parses as a single classic script', () => {
  const src = fs.readFileSync(WORKER_OUT, 'utf8');
  try {
    new vm.Script(src, { filename: 'sleep-os-worker.bundle.js' });
  } catch (err) {
    assert.fail('sleep-os-worker.bundle.js does not parse: ' + err.message);
  }
});
