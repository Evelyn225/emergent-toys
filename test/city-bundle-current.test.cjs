'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { buildCity, OUT } = require('../tools/build-city.cjs');

// The bundle is committed and is what ascii-city.html runs, so a stale one ships.
test('ascii-city.bundle.js matches its sources', () => {
  assert.strictEqual(fs.readFileSync(OUT, 'utf8'), buildCity(), 'bundle is stale - run: npm run build');
});
