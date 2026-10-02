'use strict';
// Loads ASCII City's DOM-free sources ("pure" in tools/city-manifest.json) into a node vm.
// They are classic scripts, so their top-level const/let live in the context's global lexical
// scope rather than on the context object: read them with ev('expression').
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readCityManifest } = require('../../tools/build-city.cjs');

const ROOT = path.join(__dirname, '..', '..');

function loadCity() {
  const ctx = vm.createContext({ console });
  for (const rel of readCityManifest().pure)
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  const ev = expr => vm.runInContext(expr, ctx);
  return { ctx, ev };
}

module.exports = { loadCity };
