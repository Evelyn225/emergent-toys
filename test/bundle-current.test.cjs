'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { build, OUT } = require('../tools/build.cjs');

// A committed generated file is only safe if staleness is impossible to miss.
test('sleep-os.bundle.js matches its sources', () => {
  const onDisk = fs.readFileSync(OUT, 'utf8');
  assert.strictEqual(onDisk, build(), 'bundle is stale - run: npm run build');
});
