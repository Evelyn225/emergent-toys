'use strict';
// Splits the browser suite across CI runners (--require this; TEST_SHARD=2/4 runs the second of four). One file holds
// most of the suite's time, so it goes test by test, not file by file: each shard keeps every nth top-level test of
// every file, counting from a different place in each so files with only a test or two spread out as well. Every test
// lands in exactly one shard. Without TEST_SHARD it does nothing.
const Module = require('module');

const spec = /^(\d+)\/(\d+)$/.exec(process.env.TEST_SHARD || '');
if (process.env.TEST_SHARD && !spec) throw new Error(`TEST_SHARD should look like 2/4, not ${process.env.TEST_SHARD}`);
if (spec) {
  const k = +spec[1] - 1, n = +spec[2];
  if (!(n > 0 && k >= 0 && k < n)) throw new Error(`TEST_SHARD ${process.env.TEST_SHARD}: want i/n with 1 <= i <= n`);
  const load = Module._load;
  Module._load = function (request, parent, ...rest) {
    const real = load.call(this, request, parent, ...rest);
    if (request !== 'node:test' && request !== 'test' || !parent) return real;
    let i = [...parent.filename].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % n; // (where this file starts counting)
    const test = function (...args) { return i++ % n === k ? real.apply(this, args) : Promise.resolve(); };
    // test(...) and require('node:test').test(...) are both counted; before, after and the rest pass straight through
    return new Proxy(real, { apply: (_, self, args) => test.apply(self, args), get: (t, p) => p === 'test' ? test : t[p] });
  };
}
