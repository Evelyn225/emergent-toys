'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

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
