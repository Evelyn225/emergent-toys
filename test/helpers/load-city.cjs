'use strict';
// Loads ASCII City's DOM-free sources ("pure" in tools/city-manifest.json) into a node vm.
// They are classic scripts, so their top-level const/let live in the context's global lexical
// scope rather than on the context object: read them with ev('expression').
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readCityManifest } = require('../../tools/build-city.cjs');

const ROOT = path.join(__dirname, '..', '..');

// Math.random is seeded (mulberry32) inside the vm, so a test sees the same city, traffic and people every run:
// a failure reproduces instead of coming and going. Pass a seed to try other worlds.
const SEEDED_RANDOM = `Math.random = (() => { let a = SEED >>> 0; return () => {
  a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;

function loadCity(seed = 1) {
  const ctx = vm.createContext({ console });
  vm.runInContext(SEEDED_RANDOM.replace('SEED', String(seed)), ctx);
  for (const rel of readCityManifest().pure)
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  const ev = expr => vm.runInContext(expr, ctx);
  return { ctx, ev };
}

module.exports = { loadCity };
