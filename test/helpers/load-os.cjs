'use strict';
// sleepOS sources are classic scripts that declare globals. Loading one into
// a vm context makes its `function` declarations context properties, which is
// how the tests reach them. `const` and `let` do NOT become properties, so
// anything a test needs must be declared with `function`.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function makeLocalStorageStub(quotaBytes) {
  const map = new Map();
  const limit = Number.isFinite(quotaBytes) ? quotaBytes : Infinity;
  function used() {
    let n = 0;
    map.forEach((v, k) => { n += k.length + v.length; });
    return n;
  }
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) {
      k = String(k); v = String(v);
      const projected = used() - (map.has(k) ? k.length + map.get(k).length : 0) + k.length + v.length;
      if (projected > limit) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(k, v);
    },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    _map: map,
    _used: used,
  };
}

function makeDocumentStub() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners.get(type) || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(evt) {
      (listeners.get(evt.type) || []).forEach(fn => fn(evt));
      return true;
    },
    getElementById() { return null; },
    _listeners: listeners,
  };
}

function makeOsContext(overrides) {
  overrides = overrides || {};
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    JSON,
    Map,
    Set,
    Error,
    localStorage: makeLocalStorageStub(overrides.quotaBytes),
    document: makeDocumentStub(),
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: 5 * 1024 * 1024 }) } },
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} },
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = (init || {}).detail; }
    },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.__evalSource = function (src, filename) {
    new vm.Script(src, { filename: filename || 'inline' }).runInContext(ctx);
  };
  Object.keys(overrides).forEach(k => {
    if (k !== 'quotaBytes') ctx[k] = overrides[k];
  });
  return ctx;
}

function loadOsSources(ctx, relPaths) {
  relPaths.forEach(rel => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    ctx.__evalSource(src, rel);
  });
  return ctx;
}

// Objects and arrays created inside a vm context carry that realm's
// prototypes, and assert.deepStrictEqual compares prototypes. Round-tripping
// through JSON rebuilds the value with host prototypes so a structural
// comparison against a plain literal works. Use it on anything a vm-loaded
// source returned.
function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = { makeOsContext, loadOsSources, makeLocalStorageStub, ROOT, plain };
