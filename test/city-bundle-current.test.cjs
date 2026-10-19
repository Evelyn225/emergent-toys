'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { buildCity, OUT } = require('../tools/build-city.cjs');

// The bundle is committed and is what ascii-city.html runs, so a stale one ships.
test('ascii-city.bundle.js matches its sources', () => {
  assert.strictEqual(fs.readFileSync(OUT, 'utf8'), buildCity(), 'bundle is stale - run: npm run build');
});

// Every file goes into one script, so two top-level functions of the same name don't clash loudly: the later one
// quietly replaces the other everywhere (a held fishing rod's drawRod once took over every lamp post in the city).
test('no two city files declare the same top-level function', () => {
  const { readCityManifest } = require('../tools/build-city.cjs'), m = readCityManifest(), seen = new Map(), dup = [];
  for (const f of [...m.pure, ...m.dom])
    for (const [, name] of fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8').matchAll(/^(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/gm))
      if (seen.has(name)) dup.push(`${name}: ${seen.get(name)} and ${f}`); else seen.set(name, f);
  assert.deepStrictEqual(dup, []);
});
