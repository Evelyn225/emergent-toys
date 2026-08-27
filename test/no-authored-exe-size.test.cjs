'use strict';
// Phase 6's regression guard. Phase 5 shipped with a fabricated drive
// capacity that had survived a whole phase, and phase 5b shipped with
// invented CPU numbers that had survived two. Both were caught by a grep-
// shaped guard exactly like this one. The eight system binaries now carry
// measured sizes; nothing may put an authored one back.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers/load-os.cjs');

test('ROOT_SYSTEM_FILE_META carries no size or date literals', () => {
  const src = fs.readFileSync(path.join(ROOT, 'os', 'daemon.js'), 'utf8');
  const match = /const ROOT_SYSTEM_FILE_META = \[([\s\S]*?)\];/.exec(src);
  assert.ok(match, 'ROOT_SYSTEM_FILE_META not found - if it was renamed, update this guard');
  const table = match[1];
  assert.ok(!/\bsize\s*:/.test(table), 'a size literal is back in ROOT_SYSTEM_FILE_META');
  assert.ok(!/\bdate\s*:/.test(table), 'a date literal is back in ROOT_SYSTEM_FILE_META');
  assert.ok(!/['"][\d,]{3,}['"]/.test(table), 'a hardcoded byte count is back in ROOT_SYSTEM_FILE_META');
});
